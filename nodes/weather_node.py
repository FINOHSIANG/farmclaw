import asyncio
import random
import sys
import os
from typing import Dict, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.base_node import BaseNode

def get_weather_forecast(**kwargs) -> Dict[str, Any]:
    """模拟获取气象数据的函数 (暴露为 Skill)"""
    location = kwargs.get("location", "farm_default")
    
    print(f"[Weather] 气象服务节点正在抓取 {location} 的天气数据...")
    
    conditions = ["晴朗", "降雨", "多云", "毛毛雨"]
    forecast_today = random.choice(conditions)
    
    return {
        "location": location,
        "today": {
            "condition": forecast_today,
            "high_temp": round(random.uniform(20.0, 35.0), 1),
            "low_temp": round(random.uniform(10.0, 19.0), 1),
            "precip_chance": random.randint(0, 100) if forecast_today != "降雨" else random.randint(70, 100)
        },
        "tomorrow": {
            "condition": random.choice(conditions),
            "high_temp": round(random.uniform(20.0, 35.0), 1),
            "low_temp": round(random.uniform(10.0, 19.0), 1)
        }
    }


if __name__ == "__main__":
    node = BaseNode(node_id="farm_weather_service_v1")
    node.register_skill("weather.get_forecast", get_weather_forecast)
    
    try:
        asyncio.run(node.connect_and_run())
    except KeyboardInterrupt:
        print("气象节点关闭。")
