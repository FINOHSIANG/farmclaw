import asyncio
import json
import websockets
import random
import time
import uuid

# A script to inject mock activity into the FARMCLAW gateway to populate the Svelte Dashboard

GATEWAY_URI = "ws://127.0.0.1:18789"

async def simulate_activity():
    try:
        # Create separate connections for different simulated actors
        async with websockets.connect(GATEWAY_URI) as user_ws, \
                   websockets.connect(GATEWAY_URI) as agent_ws, \
                   websockets.connect(GATEWAY_URI) as iot_ws, \
                   websockets.connect(GATEWAY_URI) as weather_ws:

            # 1. Register Mock Nodes
            print("Registering mock nodes...")
            await user_ws.send(json.dumps({"type": "register", "node_id": "web_client", "role": "client"}))
            await agent_ws.send(json.dumps({"type": "register", "node_id": "pi_agent_core", "role": "node", "skills": []}))
            await iot_ws.send(json.dumps({"type": "register", "node_id": "farm_iot_sensors_v1", "role": "node", "skills": ["sensor.get_temperature", "sensor.get_moisture"]}))
            await weather_ws.send(json.dumps({"type": "register", "node_id": "farm_weather_service_v1", "role": "node", "skills": ["weather.get_forecast"]}))
            
            await asyncio.sleep(2)

            scenarios = [
                {
                    "user_msg": "帮我看看现在大棚一号的温度如何？",
                    "agent_reply": "正在尝试连接大棚一号的传感器...",
                    "skill": "sensor.get_temperature",
                    "target_ws": iot_ws,
                    "target_node": "farm_iot_sensors_v1",
                    "mock_result": {"temperature": random.randint(20, 35)},
                    "agent_final": "大棚一号现在的温度是正常的运行范围。"
                },
                {
                    "user_msg": "土壤是不是变干了？",
                    "agent_reply": "让我去读取一下湿度传感器。",
                    "skill": "sensor.get_moisture",
                    "target_ws": iot_ws,
                    "target_node": "farm_iot_sensors_v1",
                    "mock_result": {"soil_moisture": random.randint(30, 80)},
                    "agent_final": "当前的土壤湿度适中，不需要立刻灌溉。"
                },
                {
                    "user_msg": "明天农场会下雨吗？",
                    "agent_reply": "我正在查询气象服务的数据...",
                    "skill": "weather.get_forecast",
                    "target_ws": weather_ws,
                    "target_node": "farm_weather_service_v1",
                    "mock_result": {"summary": "明天预计有多云转晴，降水概率 15%"},
                    "agent_final": "根据气象数据，明天大概率不会下雨，是多云转晴的好天气。"
                }
            ]

            for i in range(10): # Run 10 loops of random activity
                scenario = random.choice(scenarios)
                print(f"--- Iteration {i+1} ---")
                
                # User asks
                print(f"User: {scenario['user_msg']}")
                await user_ws.send(json.dumps({"type": "chat", "content": scenario["user_msg"]}))
                await asyncio.sleep(1.5)

                # Agent acknowledges
                print(f"Agent: {scenario['agent_reply']}")
                await agent_ws.send(json.dumps({"type": "chat", "content": scenario['agent_reply']}))
                await asyncio.sleep(1)

                # Agent calls RPC
                req_id = str(uuid.uuid4())
                print(f"Agent calls RPC: {scenario['skill']}")
                await agent_ws.send(json.dumps({
                    "type": "rpc_request",
                    "id": req_id,
                    "skill": scenario['skill']
                }))
                
                # Wait a bit then Mock Node responds
                await asyncio.sleep(2)
                print(f"Node {scenario['target_node']} responds RPC")
                await scenario['target_ws'].send(json.dumps({
                    "type": "rpc_response",
                    "id": req_id,
                    "result": scenario["mock_result"]
                }))
                
                await asyncio.sleep(1.5)

                # Agent sends final chat response
                print(f"Agent: {scenario['agent_final']}")
                await agent_ws.send(json.dumps({"type": "chat", "content": scenario['agent_final']}))
                
                # Wait before next random activity
                sleep_time = random.uniform(4, 8)
                print(f"Waiting {sleep_time:.1f}s...\n")
                await asyncio.sleep(sleep_time)

    except ConnectionRefusedError:
        print("Error: Could not connect to Gateway. Please ensure server.py is running.")
    except Exception as e:
        print(f"Simulation error: {e}")

if __name__ == "__main__":
    print("Starting FARMCLAW Simulation Generator...")
    asyncio.run(simulate_activity())
