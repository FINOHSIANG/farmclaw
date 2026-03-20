import asyncio
import random
import sys
import os
from typing import Dict, Any

# 将父目录加入路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.base_node import BaseNode

def read_sensor_data(**kwargs) -> Dict[str, Any]:
    """模拟读取传感器数据的函数 (暴露为 Skill)"""
    sensor_type = kwargs.get("sensor_type")
    location = kwargs.get("location", "farm_default")
    
    print(f"[IoT] 物联网节点正在从 {location} 读取 {sensor_type} 数据...")
    
    value = 0.0
    unit = ""
    status = "normal"
    
    if sensor_type == "soil_moisture":
        value = round(random.uniform(20.0, 60.0), 1)
        unit = "%"
        if value < 30.0: status = "dry - needs water"
    elif sensor_type == "temperature":
        value = round(random.uniform(15.0, 35.0), 1)
        unit = "°C"
    elif sensor_type == "humidity":
        value = round(random.uniform(40.0, 90.0), 1)
        unit = "%"
    elif sensor_type == "ph":
        value = round(random.uniform(5.5, 7.5), 1)
        unit = ""
    else:
        return {"error": f"未知的传感器类型: {sensor_type}"}

    location_map = {
        "greenhouse_1": "1号温室",
        "field_A": "A块农田",
        "farm_default": "农田区"
    }
    display_location = location_map.get(location, location)

    return {
        "sensor": sensor_type,
        "location": display_location,
        "value": value,
        "unit": unit,
        "status": status
    }


if __name__ == "__main__":
    node = BaseNode(node_id="farm_iot_sensors_v1")
    node.register_skill("sensor.read_data", read_sensor_data)
    
    try:
        asyncio.run(node.connect_and_run())
    except KeyboardInterrupt:
        print("物联网节点关闭。")
