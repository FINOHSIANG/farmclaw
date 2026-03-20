import asyncio
import json
import logging
import websockets
from typing import Dict, Any, Callable, Coroutine
import traceback

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] Node: %(message)s")

class BaseNode:
    """
    边缘节点基类。任何继承它的类都会自动注册到 Gateway, 
    并暴露自己的功能(Skills)供中央网络调用。
    """
    def __init__(self, node_id: str, ws_url: str = "ws://127.0.0.1:18789"):
        self.node_id = node_id
        self.ws_url = ws_url
        self.skills: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}
        self.ws = None

    def register_skill(self, name: str, func: Callable[[Dict[str, Any]], Dict[str, Any]]):
        """向节点注册一项可以执行的技能 (Tool)"""
        self.skills[name] = func

    async def _handle_messages(self):
        async for message in self.ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "rpc_request":
                    skill_name = data.get("skill")
                    req_id = data.get("id")
                    kwargs = data.get("kwargs", {})
                    
                    logging.info(f"收到 RPC 请求: {skill_name}({kwargs})")
                    
                    if skill_name in self.skills:
                        try:
                            # 实际上可能需要考虑到异步技能，这里简化为普通函数
                            result = self.skills[skill_name](**kwargs)
                            response = {
                                "type": "rpc_response",
                                "id": req_id,
                                "status": "success",
                                "result": result
                            }
                            await self.ws.send(json.dumps(response))
                        except Exception as e:
                            err_trace = traceback.format_exc()
                            logging.error(f"技能执行报错: {err_trace}")
                            await self.ws.send(json.dumps({
                                "type": "rpc_response",
                                "id": req_id,
                                "status": "error",
                                "error": str(e)
                            }))
                            
            except Exception as e:
                logging.error(f"解析消息时出现错误: {e}")

    async def connect_and_run(self):
        """连接到网关并保持生命"""
        while True:
            try:
                logging.info(f"正在连接到 Gateway {self.ws_url}...")
                async with websockets.connect(self.ws_url) as ws:
                    self.ws = ws
                    
                    # 发送注册报文
                    register_payload = {
                        "type": "register",
                        "node_id": self.node_id,
                        "skills": list(self.skills.keys())
                    }
                    await self.ws.send(json.dumps(register_payload))
                    
                    logging.info(f"节点 '{self.node_id}' 已成功连接并注册 {list(self.skills.keys())} 能力")
                    
                    # 持续监听收到的消息
                    await self._handle_messages()

            except websockets.exceptions.ConnectionClosed:
                 logging.warning("连接已关闭，3秒后尝试重连...")
                 await asyncio.sleep(3)
            except Exception as e:
                 logging.error(f"连接失败: {e}，3秒后尝试重连...")
                 await asyncio.sleep(3)
