from typing import Any, Dict
from .base import BasePlugin
import random

class WeatherPlugin(BasePlugin):
    """
    模拟调用农业气象预报 API。
    """
    
    @property
    def name(self) -> str:
        return "weather_forecast"

    @property
    def description(self) -> str:
        return (
            "获取农场今天和明天的专属农业天气预报。"
            "输入参数 'location' (例如：'farm_default' (默认农场), 'field_A' (A块农田))."
        )

    def execute(self, location: str = "farm_default") -> Dict[str, Any]:
        """
        返回天气预报信息的模拟实现。
        """
        # 在真实的业务场景下，这会去调用如中国气象局、OpenWeatherMap等专业的农业天气预报API
        print(f"[气象预报] 正在抓取 {location} 的天气数据...")
        
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
