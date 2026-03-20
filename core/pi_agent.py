import asyncio
import json
import logging
import uuid
import websockets
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] PiAgent: %(message)s")

class PiAgentNode:
    """
    独立化的大脑节点 (Pi Agent)，不直接处理终端 I/O，只连接到 Gateway。
    它接收并回复用户消息，主动请求网关背后其他节点挂载的能力 (RPC Skills)。
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
                            # 思考结束，打字回终端
                            reply_payload = {
                                "type": "chat",
                                "content": response_text
                            }
                            await self.ws.send(json.dumps(reply_payload))
                            
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
            "kwargs": kwargs
        }
        
        logging.info(f"正在向网关请求调用能力: {skill_name}({kwargs})")
        await self.ws.send(json.dumps(rpc_payload))
        
        # 等待 Gateway 将对应节点执行结果返回
        try:
             # 超时控制
            result = await asyncio.wait_for(future, timeout=10.0)
            return result
        except asyncio.TimeoutError:
            self.pending_rpcs.pop(req_id, None)
            raise Exception(f"请求超时: {skill_name}")

    async def process_input(self, user_text: str) -> str:
        """
        重构后的输入处理逻辑，它必须使用异步模式调用网络工具
        """
        self.conversation_history.append({"role": "user", "content": user_text})
        user_text_lower = user_text.lower()
        response_text = ""
        
        try:
            if "干" in user_text_lower or "湿" in user_text_lower or "浇水" in user_text_lower or "moisture" in user_text_lower:
                sensor_data = await self.call_skill("sensor.read_data", sensor_type="soil_moisture", location="greenhouse_1")
                
                response_text += f"{sensor_data['location']} 目前的土壤湿度为 {sensor_data['value']}{sensor_data['unit']}。 "
                if sensor_data['status'] == "dry - needs water":
                    response_text += "土壤状态比较干燥。 "
                    
                    weather_data = await self.call_skill("weather.get_forecast", location="farm_default")
                    if weather_data['today']['condition'] == "Rain":
                        response_text += "但是气象数据显示今天预计有降雨，因此我建议您先不要开启灌溉系统。"
                    else:
                        response_text += f"今天的天气预报是 {weather_data['today']['condition']}。我建议立即开启滴灌系统 30 分钟进行补水。"
                else:
                    response_text += "土壤水分处于正常健康水平。"
                    
            elif "天气" in user_text_lower or "雨" in user_text_lower or "weather" in user_text_lower:
                weather_data = await self.call_skill("weather.get_forecast", location="farm_default")
                response_text += f"农场今天的天气预报是 {weather_data['today']['condition']}，最高气温约 {weather_data['today']['high_temp']}°C。 "
                response_text += f"明天预计会是 {weather_data['tomorrow']['condition']}。"
                
            elif "温" in user_text_lower or "热" in user_text_lower or "冷" in user_text_lower or "temp" in user_text_lower:
                sensor_data = await self.call_skill("sensor.read_data", sensor_type="temperature", location="greenhouse_1")
                response_text += f"{sensor_data['location']} 当前的温度是 {sensor_data['value']}{sensor_data['unit']}。"

            else:
                response_text = "您好，我是 FARMCLAW 分布式大脑。我可以帮您检查传感器的状态或查询气象。请问您的农场今天需要什么帮助？"

        except Exception as e:
            logging.error(f"处理逻辑内部错误: {e}")
            response_text = "抱歉，我在尝试调用底层硬件或外部服务时遇到了网络错误。"
            
        self.conversation_history.append({"role": "assistant", "content": response_text})
        return response_text

    async def connect_and_run(self):
        while True:
            try:
                logging.info(f"Pi Agent 正在接入网关: {self.ws_url}...")
                async with websockets.connect(self.ws_url) as ws:
                    self.ws = ws
                    
                    # 注册为拥有处理能力，但自身不暴露 RPC Skill 的特殊节点
                    register_payload = {
                        "type": "register",
                        "node_id": self.node_id,
                        "skills": []
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
