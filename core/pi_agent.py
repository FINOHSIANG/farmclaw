import asyncio
import json
import logging
import os
import sys
import uuid
import websockets
from typing import Dict, Any, Optional

# 允许直接执行 `python core/pi_agent.py` 时导入项目根模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.organic_models import (
    organic_recommendation,
    resolve_field,
    DEFAULT_FIELD_ID,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] PiAgent: %(message)s")


class PiAgentNode:
    """
    独立化的大脑节点 (Pi Agent)，不直接处理终端 I/O，只连接到 Gateway。
    它接收并回复用户消息，主动请求网关背后其他节点挂载的能力 (RPC Skills)。

    首版采用规则基线 + 有机种植知识包，输出"可解释建议"而非自动控制设备，
    与 docs/organic-ai-development-plan.md 的 MVP 边界一致。
    """

    def __init__(self, ws_url: str = "ws://127.0.0.1:18789"):
        self.node_id = "pi_agent_core"
        self.ws_url = ws_url
        self.ws = None
        self.conversation_history = []

        # 存放等待响应的 RPC Future
        self.pending_rpcs: Dict[str, asyncio.Future] = {}

    async def _handle_messages(self):
        async for message in self.ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                # 来自频道的前端聊天广播
                if msg_type == "chat":
                    user_text = data.get("content")
                    logging.info(f"收到用户输入: '{user_text}'")

                    async def _handle_chat(text):
                        response_text = await self.process_input(text)
                        if response_text:
                            await self.ws.send(json.dumps({
                                "type": "chat",
                                "content": response_text,
                            }))

                    asyncio.create_task(_handle_chat(user_text))

                # 收到了自己发起的工具调用的结果
                elif msg_type == "rpc_response":
                    req_id = data.get("id")
                    if req_id in self.pending_rpcs:
                        future = self.pending_rpcs.pop(req_id)

                        if data.get("status") == "success":
                            future.set_result(data.get("result"))
                        else:
                            future.set_exception(Exception(data.get("error")))
                    else:
                        logging.warning(f"收到无法匹配的 RPC 回调: {req_id}")

            except Exception as e:
                logging.error(f"处理网关消息时出错: {e}")

    async def call_skill(self, skill_name: str, **kwargs) -> Any:
        """通过 Gateway 异步调用其他节点的函数"""
        req_id = str(uuid.uuid4())
        future = asyncio.get_running_loop().create_future()
        self.pending_rpcs[req_id] = future

        rpc_payload = {
            "type": "rpc_request",
            "id": req_id,
            "skill": skill_name,
            "kwargs": kwargs,
        }

        logging.info(f"正在向网关请求调用能力: {skill_name}({kwargs})")
        await self.ws.send(json.dumps(rpc_payload))

        try:
            result = await asyncio.wait_for(future, timeout=10.0)
            return result
        except asyncio.TimeoutError:
            self.pending_rpcs.pop(req_id, None)
            raise Exception(f"请求超时: {skill_name}")

    # ---- 以下为有机农业 AI 的规则基线决策 ----

    @staticmethod
    def _has_any(text: str, keys) -> bool:
        return any(k in text for k in keys)

    def _format_telemetry(self, reading: Dict[str, Any]) -> str:
        location = reading.get("location", "当前田块")
        metric = reading.get("metric") or reading.get("sensor", "")
        value = reading.get("value")
        unit = reading.get("unit", "")
        status = reading.get("status", "normal")
        batch = reading.get("crop_batch_id", "")
        label = {
            "temperature": "温度",
            "soil_moisture": "土壤水分",
            "humidity": "空气湿度",
            "light": "光照强度",
            "ph": "土壤酸碱度",
            "ec": "电导率",
        }.get(metric, metric)
        line = f"{location}（批次 {batch}）当前{label}为 {value}{unit}，状态 {status}。"
        return line

    def _format_irrigation_advice(self, reading: Dict[str, Any], weather: Dict[str, Any]) -> str:
        value = reading.get("value")
        status = reading.get("status", "")
        condition = weather.get("today", {}).get("condition", "")
        batch = reading.get("crop_batch_id", "")
        if status == "dry - needs water" and condition != "降雨":
            return (
                f"土壤偏干（{value}%）且今日{condition}，建议人工确认后开启滴灌补水约 20-30 分钟，"
                "保持有机种植的节水与土壤保墒。"
            )
        if condition == "降雨":
            return f"今日预计{condition}，建议暂缓灌溉，避免夜间高湿诱发病害（批次 {batch}）。"
        return f"当前土壤水分{value}%处于健康区间，暂不需要灌溉（批次 {batch}）。"

    def _format_weather(self, weather: Dict[str, Any]) -> str:
        today = weather.get("today", {})
        tomorrow = weather.get("tomorrow", {})
        advisory = weather.get("organic_advisory", "")
        return (
            f"农场今日天气 {today.get('condition')}，最高约 {today.get('high_temp')}°C，"
            f"降水概率 {today.get('precip_chance')}%；明日预计 {tomorrow.get('condition')}。"
            f"{advisory}"
        )

    def _greeting(self) -> str:
        return (
            "您好，我是 FARMCLAW 有机农业 AI 决策中心。"
            "我可以帮您查看温度、土壤水分、光照、pH 等遥测，"
            "或给出病虫害巡检、灌溉、采收预测与有机追溯建议。"
            "所有动作均需人工确认，不会自动控制设备。"
        )

    async def process_input(self, user_text: str) -> str:
        """
        基于规则基线的有机农业问答与工具调度。
        识别遥测、病虫害、长势、灌溉、采收、追溯等意图，
        通过 RPC 调用 IoT/气象节点获取依据，再组织可解释的建议。
        """
        self.conversation_history.append({"role": "user", "content": user_text})
        text = (user_text or "").lower()
        field_id = DEFAULT_FIELD_ID  # MVP 默认聚焦 1 号温室，后续可按上下文切换
        parts = []

        try:
            # 1. 有机认证 / 追溯 (纯知识，无需传感)
            if self._has_any(text, ["追溯", "溯源", "认证", "trace"]):
                parts.append(organic_recommendation("traceability", field_id))

            # 2. 病虫害
            elif self._has_any(text, ["虫", "病", "pest"]):
                parts.append(organic_recommendation("pest", field_id))

            # 3. 采收预测
            elif self._has_any(text, ["采收", "收获", "harvest"]):
                parts.append(organic_recommendation("harvest", field_id))

            # 4. 长势评估
            elif self._has_any(text, ["长势", "生长", "growth"]):
                parts.append(organic_recommendation("growth", field_id))

            # 5. 灌溉 / 土壤水分 (需要传感 + 气象)
            elif self._has_any(text, ["灌溉", "浇水", "干", "湿", "moisture", "irrigation", "水"]):
                reading = await self.call_skill(
                    "sensor.read_data", sensor_type="soil_moisture", field_id=field_id
                )
                parts.append(self._format_telemetry(reading))
                weather = await self.call_skill("weather.get_forecast", location=field_id)
                parts.append(self._format_irrigation_advice(reading, weather))

            # 6. 温度
            elif self._has_any(text, ["温度", "温", "热", "冷", "temp"]):
                reading = await self.call_skill(
                    "sensor.read_data", sensor_type="temperature", field_id=field_id
                )
                parts.append(self._format_telemetry(reading))

            # 7. 光照
            elif self._has_any(text, ["光", "照", "light"]):
                reading = await self.call_skill(
                    "sensor.read_data", sensor_type="light", field_id=field_id
                )
                parts.append(self._format_telemetry(reading))

            # 8. pH
            elif ("ph" in text) or ("酸碱" in user_text):
                reading = await self.call_skill(
                    "sensor.read_data", sensor_type="ph", field_id=field_id
                )
                parts.append(self._format_telemetry(reading))

            # 9. 气象
            elif self._has_any(text, ["天气", "雨", "weather"]):
                weather = await self.call_skill("weather.get_forecast", location=field_id)
                parts.append(self._format_weather(weather))

            else:
                parts.append(self._greeting())

        except Exception as e:
            logging.error(f"处理逻辑内部错误: {e}")
            parts.append(
                "抱歉，我在调用底层传感器或气象服务时遇到网络错误。"
                "已降级为规则建议：" + organic_recommendation("general", field_id)
            )

        response_text = " ".join(parts)
        self.conversation_history.append({"role": "assistant", "content": response_text})
        return response_text

    async def connect_and_run(self):
        while True:
            try:
                logging.info(f"Pi Agent 正在接入网关: {self.ws_url}...")
                async with websockets.connect(self.ws_url) as ws:
                    self.ws = ws

                    register_payload = {
                        "type": "register",
                        "node_id": self.node_id,
                        "skills": [],
                    }
                    await self.ws.send(json.dumps(register_payload))
                    logging.info("Pi Agent 成功接入系统控制面！进入在线监听模式...")

                    await self._handle_messages()

            except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError):
                logging.warning("与网关的连接已断开，3秒后重连...")
                await asyncio.sleep(3)
            except Exception as e:
                logging.error(f"未知的连接异常: {e}")
                await asyncio.sleep(3)


if __name__ == "__main__":
    agent = PiAgentNode()
    try:
        asyncio.run(agent.connect_and_run())
    except KeyboardInterrupt:
        print("Agent 已关闭")
