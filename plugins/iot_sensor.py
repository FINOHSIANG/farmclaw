from typing import Any, Dict
from .base import BasePlugin
import random

class IoTSensorPlugin(BasePlugin):
    """
    模拟从农业物联网设备（如土壤湿度、温度等传感器）读取数据。
    """
    
    @property
    def name(self) -> str:
        return "iot_sensor"

    @property
    def description(self) -> str:
        return (
            "获取农场的实时传感器数据。"
            "输入参数 'sensor_type' (例如：'soil_moisture' (土壤湿度), 'temperature' (温度), 'humidity' (环境湿度), 'ph' (酸碱度)) "
            "以及可选的 'location' (例如：'greenhouse_1' (1号温室), 'field_A' (A块农田))."
        )

    def execute(self, sensor_type: str, location: str = "farm_default") -> Dict[str, Any]:
        """
        返回看似真实的随机农业传感器数据的模拟实现。
        """
        # 在真实的业务场景下，这会去调用智能农业系统的API（如大疆农业、自定义MQTT代理等）
        print(f"[物联网插件] 正在从 {location} 读取 {sensor_type} 数据...")
        
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

        # 映射地点名为中文显示
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
