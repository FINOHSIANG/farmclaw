import asyncio
import websockets
import json

async def run_test():
    uri = "ws://127.0.0.1:18789"
    try:
        async with websockets.connect(uri) as ws:
            # 注册
            await ws.send(json.dumps({"type": "register", "node_id": "test_client", "skills": []}))
            
            # 发送提问
            print("[Test Client] 发送问题: '今天大棚的温度是多少'")
            await ws.send(json.dumps({
                "type": "chat",
                "content": "今天大棚的温度是多少"
            }))
            
            # 等待回复
            while True:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(response)
                if data.get("type") == "chat":
                    print(f"[Test Client] 收到回复: {data.get('content')}")
                    break
                    
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
