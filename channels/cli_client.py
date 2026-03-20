import asyncio
import websockets
import json
import logging
from aioconsole import ainput

logging.basicConfig(level=logging.ERROR) # 降低日志级别，以免影响终端界面

async def chat_client():
    uri = "ws://127.0.0.1:18789"
    try:
        async with websockets.connect(uri) as ws:
            
            # 注册为只收发消息的 Client
            register_payload = {
                "type": "register",
                "node_id": "cli_client_frontend",
                "skills": []
            }
            await ws.send(json.dumps(register_payload))
            
            # 启动一个后台任务来不断接收并打印来自 Gateway/Agent 的消息
            async def receive_messages():
                async for message in ws:
                    try:
                        data = json.loads(message)
                        if data.get("type") == "chat":
                            print(f"\nFARMCLAW🤖: {data.get('content')}\n")
                            print("-" * 50)
                            print("农民👨‍🌾: ", end='', flush=True) # 重新打印提示符
                    except Exception as e:
                        pass
            
            recv_task = asyncio.create_task(receive_messages())
            
            print("================================================")
            print("           欢迎使用 FARMCLAW 分布式控制终端")
            print("================================================")
            print("连接已就绪。输入 'exit' 或 'quit' 退出。\n")
            
            while True:
                user_input = await ainput("农民👨‍🌾: ")
                if user_input.lower() in ['exit', 'quit']:
                    break
                
                if not user_input.strip():
                    continue
                    
                # 将用户的聊天消息通过 Gateway 发送出去，让后面的 Agent 来接手
                chat_payload = {
                    "type": "chat",
                    "content": user_input
                }
                await ws.send(json.dumps(chat_payload))
            
            recv_task.cancel()
    except Exception as e:
        print(f"无法连接到 Gateway: {e}")

if __name__ == "__main__":
    asyncio.run(chat_client())
