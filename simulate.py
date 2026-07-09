import asyncio
import json
import websockets
import random
import uuid
import os
import sys

# 向 FARMCLAW 网关注入模拟活动，为 Svelte Dashboard 提供有机农业预览数据。
#
# 约定：
# - 技能名与真实节点保持一致：sensor.read_data / weather.get_forecast，
#   这样即使同时启动真实 iot_node / weather_node，网关也能正确路由。
# - rpc_response.result 采用与 core.organic_models.build_telemetry 一致的结构，
#   Dashboard 的 ingestTelemetry 可直接消费 (temperature/soil_moisture/light/ph)。

GATEWAY_URI = "ws://127.0.0.1:18789"

# 将仓库根加入路径，复用共享遥测模型，避免模拟形状与节点漂移
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.organic_models import build_sensor_reading  # noqa: E402
from nodes.weather_node import get_weather_forecast   # noqa: E402


async def _send_rpc_roundtrip(agent_ws, target_ws, skill, kwargs, result):
    """发起一次 RPC 请求并由模拟节点立即回包 (Dashboard 作为 observer 可看到全程)。"""
    req_id = str(uuid.uuid4())
    await agent_ws.send(json.dumps({
        "type": "rpc_request",
        "id": req_id,
        "skill": skill,
        "kwargs": kwargs,
    }))
    await asyncio.sleep(1.5)
    await target_ws.send(json.dumps({
        "type": "rpc_response",
        "id": req_id,
        "status": "success",
        "result": result,
    }))


async def simulate_activity():
    try:
        async with websockets.connect(GATEWAY_URI) as user_ws, \
                   websockets.connect(GATEWAY_URI) as agent_ws, \
                   websockets.connect(GATEWAY_URI) as iot_ws, \
                   websockets.connect(GATEWAY_URI) as weather_ws:

            print("Registering mock nodes...")
            await user_ws.send(json.dumps({"type": "register", "node_id": "web_client", "role": "client"}))
            await agent_ws.send(json.dumps({"type": "register", "node_id": "pi_agent_core", "role": "node", "skills": []}))
            await iot_ws.send(json.dumps({
                "type": "register",
                "node_id": "farm_iot_sensors_v1",
                "role": "node",
                "skills": ["sensor.read_data"],
            }))
            await weather_ws.send(json.dumps({
                "type": "register",
                "node_id": "farm_weather_service_v1",
                "role": "node",
                "skills": ["weather.get_forecast"],
            }))

            await asyncio.sleep(2)

            # 覆盖四种遥测维度 + 有机主题，循环驱动 Dashboard 面板
            telemetry_fields = ["greenhouse-1", "field-a", "orchard-b"]
            telemetry_metrics = ["temperature", "soil_moisture", "light", "ph"]

            organic_chats = [
                ("1号温室需要灌溉吗？", "结合土壤湿度与降雨概率，建议人工确认后再开启滴灌，避免夜间高湿。"),
                ("B区果园有病虫害风险吗？", "温湿度组合偏高，建议检查叶背新梢，优先使用粘虫板与生物防治。"),
                ("有机番茄批次什么时候采收？", "结合积温曲线，预计进入首采窗口，请提前准备追溯二维码。"),
                ("帮我查一下有机追溯链路。", "批次已覆盖播种建档、投入品登记与巡检影像，本地哈希存证完成。"),
            ]

            for i in range(12):
                print(f"--- Iteration {i + 1} ---")

                # 每轮先注入一条遥测 (temperature/soil_moisture/light/ph 轮询)
                fid = telemetry_fields[i % len(telemetry_fields)]
                metric = telemetry_metrics[i % len(telemetry_metrics)]
                reading = build_sensor_reading(metric, fid)
                metric_label = {"temperature": "温度", "soil_moisture": "土壤水分",
                                "light": "光照", "ph": "酸碱度"}.get(metric, metric)
                user_q = f"看一下 {fid} 的 {metric_label}"
                await user_ws.send(json.dumps({"type": "chat", "content": user_q}))
                await asyncio.sleep(1.0)
                await agent_ws.send(json.dumps({"type": "chat", "content": f"正在读取 {fid} 的 {metric} 传感器..."}))
                await _send_rpc_roundtrip(
                    agent_ws, iot_ws, "sensor.read_data",
                    {"sensor_type": metric, "field_id": fid},
                    reading,
                )
                await asyncio.sleep(1.0)
                await agent_ws.send(json.dumps({
                    "type": "chat",
                    "content": f"{reading['location']}（批次 {reading['crop_batch_id']}）"
                               f"{metric_label}为 {reading['value']}{reading['unit']}，状态 {reading['status']}。",
                }))

                await asyncio.sleep(2.0)

                # 每轮再注入一条有机主题对话
                user_msg, agent_reply = organic_chats[i % len(organic_chats)]
                print(f"User: {user_msg}")
                await user_ws.send(json.dumps({"type": "chat", "content": user_msg}))
                await asyncio.sleep(1.0)
                print(f"Agent: {agent_reply}")
                await agent_ws.send(json.dumps({"type": "chat", "content": agent_reply}))

                # 偶尔注入一次气象预报 RPC，丰富事件流
                if i % 3 == 0:
                    weather_result = get_weather_forecast(location=fid)
                    await _send_rpc_roundtrip(
                        agent_ws, weather_ws, "weather.get_forecast",
                        {"location": fid},
                        weather_result,
                    )

                sleep_time = random.uniform(4, 7)
                print(f"Waiting {sleep_time:.1f}s...\n")
                await asyncio.sleep(sleep_time)

    except ConnectionRefusedError:
        print("Error: Could not connect to Gateway. Please ensure server.py is running.")
    except Exception as e:
        print(f"Simulation error: {e}")


if __name__ == "__main__":
    print("Starting FARMCLAW Organic AI Simulation Generator...")
    asyncio.run(simulate_activity())
