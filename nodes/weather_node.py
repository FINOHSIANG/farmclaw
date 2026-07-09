import asyncio
import random
import sys
import os
from typing import Dict, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.base_node import BaseNode
from core.organic_models import resolve_field


def get_weather_forecast(**kwargs) -> Dict[str, Any]:
    """模拟获取农业气象预报 (暴露为 Skill: weather.get_forecast)。

    返回今天/明天的天气以及一条有机种植农事提示 (organic_advisory)，
    并附带 field_id / crop_batch_id，便于与田块和批次关联。
    """
    location = kwargs.get("location") or kwargs.get("field_id", "farm_default")
    field = resolve_field(location)

    print(f"[Weather] 气象服务节点正在抓取 {field['name']} 的天气数据...")

    conditions = ["晴朗", "降雨", "多云", "毛毛雨"]
    forecast_today = random.choice(conditions)
    precip = random.randint(0, 100) if forecast_today != "降雨" else random.randint(70, 100)

    if forecast_today == "降雨":
        advisory = "近期有降雨，建议暂停灌溉与叶面施用，巡检注意排水与病害预防。"
    elif precip >= 40:
        advisory = "降水概率偏高，有机农事操作请避开降雨窗口，投入品使用后需记录间隔期。"
    else:
        advisory = "天气晴好，适合巡检、影像归档与有机投入品登记。"

    return {
        "location": field["name"],
        "field_id": field["field_id"],
        "crop_batch_id": field["crop_batch_id"],
        "today": {
            "condition": forecast_today,
            "high_temp": round(random.uniform(20.0, 35.0), 1),
            "low_temp": round(random.uniform(10.0, 19.0), 1),
            "precip_chance": precip,
        },
        "tomorrow": {
            "condition": random.choice(conditions),
            "high_temp": round(random.uniform(20.0, 35.0), 1),
            "low_temp": round(random.uniform(10.0, 19.0), 1),
        },
        "organic_advisory": advisory,
    }


if __name__ == "__main__":
    node = BaseNode(node_id="farm_weather_service_v1")
    node.register_skill("weather.get_forecast", get_weather_forecast)

    try:
        asyncio.run(node.connect_and_run())
    except KeyboardInterrupt:
        print("气象节点关闭。")
