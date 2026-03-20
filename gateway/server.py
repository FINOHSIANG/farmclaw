import asyncio
import json
import logging
from typing import Dict, Any, Set
import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

class GatewayServer:
    """
    FARMCLAW 中心网关服务 (借鉴 OpenClaw 控制面架构)
    负责所有的 WebSocket 连接、节点注册和消息/RPC 路由。
    """
    def __init__(self, host="127.0.0.1", port=18789):
        self.host = host
        self.port = port
        
        # 记录所有活跃的 WebSocket 连接
        self.active_connections: Set[websockets.WebSocketServerProtocol] = set()
        
        # 记录所有的观察者大屏连接
        self.observers: Set[websockets.WebSocketServerProtocol] = set()
        
        # 注册的节点信息: { node_id: { "ws": WebSocketServerProtocol, "skills": [skill_names] } }
        self.nodes: Dict[str, Dict[str, Any]] = {}

        # 挂起的 RPC 请求字典, 用于做回调路由: { request_id: caller_ws }
        self.pending_requests: Dict[str, websockets.WebSocketServerProtocol] = {}

    async def handle_client(self, websocket):
        """处理新接入的 WebSocket 连接"""
        self.active_connections.add(websocket)
        logging.info(f"新终端连接: {websocket.remote_address}")
        client_node_id = None

        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get("type")

                # 将收到的每一条消息都抄送给所有的观察者客户端 (无损日志流)
                await self._notify_observers(data, source_node=client_node_id or "Anonymous")

                # 1. 节点注册 (Node Register)
                if msg_type == "register":
                    client_node_id = data.get("node_id")
                    node_role = data.get("role", "node")
                    
                    if node_role == "observer":
                        self.observers.add(websocket)
                        logging.info(f"大屏观察者已接入: {websocket.remote_address}")
                        
                        # 向新观察者发送当前系统的全部拓扑结构
                        topology_payload = {
                            "type": "topology_update",
                            "nodes": [nid for nid in self.nodes.keys()]
                        }
                        await websocket.send(json.dumps(topology_payload))
                    else:
                        skills = data.get("skills", [])
                        self.nodes[client_node_id] = {
                            "ws": websocket,
                            "skills": skills
                        }
                        logging.info(f"节点注册成功: [{client_node_id}], 提供能力: {skills}")
                        await websocket.send(json.dumps({"type": "register_ack", "status": "ok"}))
                        
                        # 通知所有观察者有新节点加入了
                        await self._notify_observers({"type": "node_joined", "node_id": client_node_id, "skills": skills})


                # 2. 聊天消息广播 (Chat Broadcast)
                elif msg_type == "chat":
                    logging.info(f"收到聊天内容来自 {client_node_id or 'Client'}: {data.get('content')}")
                    # 将聊天消息广播给除发送者之外的所有人 (比如广播给 Agent 节点处理)
                    await self._broadcast(message, exclude=websocket)

                # 3. 远程过程调用请求 (RPC Tool Call Request)
                elif msg_type == "rpc_request":
                    skill_name = data.get("skill")
                    target_node_ws = self._find_node_for_skill(skill_name)
                    
                    if target_node_ws:
                        req_id = data.get("id")
                        # 记录这个请求的发起者，为了以后把结果还给它
                        self.pending_requests[req_id] = websocket
                        # 转发请求给提供该能力的 Node
                        logging.info(f"路由 RPC 请求 [{skill_name}] 到对应节点")
                        await target_node_ws.send(message)
                    else:
                        # 没找到对应的节点能力
                        logging.warning(f"未能找到提供 `{skill_name}` 能力的注册节点")
                        await websocket.send(json.dumps({
                            "type": "rpc_response",
                            "id": data.get("id"),
                            "error": f"Skill {skill_name} not found."
                        }))

                # 4. 远程过程调用响应 (RPC Tool Call Response)
                elif msg_type == "rpc_response":
                    req_id = data.get("id")
                    caller_ws = self.pending_requests.pop(req_id, None)
                    if caller_ws:
                         logging.info(f"成功将 RPC 响应路由回请求者")
                         await caller_ws.send(message)
                    else:
                         logging.warning(f"收到无法匹配的 RPC 响应: {req_id}")

        except websockets.exceptions.ConnectionClosed as e:
            logging.info(f"终端断开: {websocket.remote_address} ( {e} )")
        except Exception as e:
            logging.error(f"处理消息时发生错误: {e}")
        finally:
            # 清理连接
            if client_node_id and client_node_id in self.nodes:
                logging.info(f"节点注销: [{client_node_id}]")
                del self.nodes[client_node_id]
            self.active_connections.remove(websocket)
            if websocket in self.observers:
                self.observers.remove(websocket)

    async def _notify_observers(self, data: dict, source_node: str = None):
        """将事件包装后广播给所有的 Observer 面板"""
        if not self.observers:
            return
            
        payload = {
            "type": "system_event",
            "source": source_node,
            "original_message": data
        }
        encoded = json.dumps(payload)
        for obs in list(self.observers):
            try:
                await obs.send(encoded)
            except Exception:
                pass

    def _find_node_for_skill(self, skill_name: str) -> websockets.WebSocketServerProtocol:
        """根据需要的能能力(Skill)，寻找注册了该能力的 WebSocket 连接"""
        for node_id, info in self.nodes.items():
            if skill_name in info.get("skills", []):
                return info["ws"]
        return None

    async def _broadcast(self, message: str, exclude=None):
        """广播消息"""
        for conn in self.active_connections.copy():
            if conn != exclude:
                try:
                    await conn.send(message)
                except Exception:
                    pass

    async def start_server(self):
        logging.info(f"FARMCLAW Gateway 控制平面正在启动 ws://{self.host}:{self.port} ...")
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()  # run forever

if __name__ == "__main__":
    gateway = GatewayServer()
    asyncio.run(gateway.start_server())
