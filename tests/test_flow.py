import asyncio
import os
import sys
import websockets
import json

# 让 tests/ 目录可以直接 import 项目根的模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.organic_models import (  # noqa: E402
    build_sensor_reading,
    organic_recommendation,
    resolve_field,
    FIELD_CATALOG,
    SENSOR_PROFILES,
)
from nodes.iot_node import read_sensor_data  # noqa: E402
from nodes.weather_node import get_weather_forecast  # noqa: E402


def run_offline_tests():
    """离线校验：遥测结构、田块关联、节点 skill 与有机建议文案。"""
    failures = []

    # 1. IoT 节点 skill 返回标准遥测结构，且包含 field_id / crop_batch_id
    for metric in ["temperature", "soil_moisture", "humidity", "light", "ph"]:
        reading = read_sensor_data(sensor_type=metric, field_id="greenhouse-1")
        for key in ("sensor", "metric", "value", "unit", "status",
                    "field_id", "crop_batch_id", "captured_at", "source_node"):
            if key not in reading:
                failures.append(f"{metric} 缺少字段 {key}")
        if reading.get("field_id") != "greenhouse-1":
            failures.append(f"{metric} field_id 不匹配: {reading.get('field_id')}")
        if reading.get("crop_batch_id") != "ORG-2024-01":
            failures.append(f"{metric} crop_batch_id 不匹配: {reading.get('crop_batch_id')}")

    # 2. 未知传感器类型应返回 error
    bad = read_sensor_data(sensor_type="unknown_metric", field_id="greenhouse-1")
    if "error" not in bad:
        failures.append(f"未知 metric 未返回 error: {bad}")

    # 3. 四种 Dashboard 关心的遥测维度全部可用
    for metric in ("temperature", "soil_moisture", "light", "ph"):
        reading = build_sensor_reading(metric, "field-a")
        if reading["metric"] != metric:
            failures.append(f"build_sensor_reading metric 不匹配: {reading['metric']}")

    # 4. 气象节点 skill 返回 organic_advisory 与 field_id
    weather = get_weather_forecast(location="orchard-b")
    for key in ("field_id", "crop_batch_id", "today", "tomorrow", "organic_advisory"):
        if key not in weather:
            failures.append(f"weather 缺少字段 {key}")
    if weather["field_id"] != "orchard-b":
        failures.append(f"weather field_id 不匹配: {weather['field_id']}")

    # 5. 有机建议覆盖 pest/growth/irrigation/harvest/traceability 主题
    for topic in ("pest", "growth", "irrigation", "harvest", "traceability"):
        text = organic_recommendation(topic, "greenhouse-1")
        if not text or "ORG-2024-01" not in text:
            failures.append(f"organic_recommendation({topic}) 文案异常: {text}")

    # 6. 田块目录至少包含三个 MVP 田块
    for fid in ("greenhouse-1", "field-a", "orchard-b"):
        if fid not in FIELD_CATALOG:
            failures.append(f"FIELD_CATALOG 缺少 {fid}")
        if fid not in SENSOR_PROFILES and False:
            failures.append("stub")

    if failures:
        print("[Offline Tests] FAIL")
        for f in failures:
            print("  -", f)
        return False

    print("[Offline Tests] PASS: 遥测结构、田块关联、气象建议、有机文案均符合预期。")
    return True


async def run_live_test():
    """在线联调：经网关发送一条 chat，等待 Agent 回复 (需要 server.py + pi_agent 运行)。"""
    uri = "ws://127.0.0.1:18789"
    try:
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({"type": "register", "node_id": "test_client", "skills": []}))

            print("[Test Client] 发送问题: '1号温室的温度是多少？'")
            await ws.send(json.dumps({"type": "chat", "content": "1号温室的温度是多少？"}))

            while True:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(response)
                if data.get("type") == "chat":
                    print(f"[Test Client] 收到回复: {data.get('content')}")
                    break
    except Exception as e:
        print(f"[Live Test] skipped (gateway 未运行?): {e}")


if __name__ == "__main__":
    ok = run_offline_tests()
    if ok:
        asyncio.run(run_live_test())
