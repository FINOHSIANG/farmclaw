import json
from typing import List, Dict, Any
from plugins.base import BasePlugin
from plugins.iot_sensor import IoTSensorPlugin
from plugins.weather import WeatherPlugin

class FarmclawAgent:
    """
    FARMCLAW 的核心调度器 (Core orchestrator)。
    负责接收用户输入，决定调用哪些插件（工具），并组织回复返回给用户。
    """
    def __init__(self):
        self.plugins: Dict[str, BasePlugin] = {}
        self._register_default_plugins()
        self.conversation_history = []
        
    def _register_default_plugins(self):
        self.register_plugin(IoTSensorPlugin())
        self.register_plugin(WeatherPlugin())

    def register_plugin(self, plugin: BasePlugin):
        self.plugins[plugin.name] = plugin

    def get_system_prompt(self) -> str:
        tools_desc = "\n".join([f"- {name}: {p.description}" for name, p in self.plugins.items()])
        return f"""你是 FARMCLAW，一个专门为农业场景打造的自主 AI 助手。
你可以使用以下工具：
{tools_desc}

你的目标是帮助农民高效管理他的农场。
如果你需要获取农业数据，请调用相应的工具。
"""

    def process_input(self, user_text: str) -> str:
        """
        处理用户的文本。在真实的系统中，此处会去调用大语言模型 (LLM)。
        在这里，我们使用简单的规则路由 (heuristic mock) 来演示 AI 的工作流决策过程。
        """
        self.conversation_history.append({"role": "user", "content": user_text})
        
        print(f"\n[Agent 内部思考] 正在解析: '{user_text}'...")
        
        user_text_lower = user_text.lower()
        response_text = ""
        
        # 1. 意图分发与工具执行 (模拟 LLM 行为)
        if "干" in user_text_lower or "湿" in user_text_lower or "浇水" in user_text_lower or "moisture" in user_text_lower:
            print("[Agent 决策] 决定调用工具: iot_sensor (参数: soil_moisture - 土壤水分)")
            sensor_data = self.plugins["iot_sensor"].execute(sensor_type="soil_moisture", location="greenhouse_1")
            
            response_text += f"{sensor_data['location']} 目前的土壤湿度为 {sensor_data['value']}{sensor_data['unit']}。 "
            if sensor_data['status'] == "dry - needs water":
                response_text += "土壤状态比较干燥。 "
                
                # 检查天气以决定是否应该浇水
                print("[Agent 决策] 决定调用工具: weather_forecast (气象预报)")
                weather_data = self.plugins["weather_forecast"].execute("farm_default")
                if weather_data['today']['condition'] == "Rain":
                    response_text += "但是气象数据显示今天预计有降雨，因此我建议您先不要开启灌溉系统。"
                else:
                    response_text += f"今天的天气预报是 {weather_data['today']['condition']}。我建议立即开启滴灌系统 30 分钟进行补水。"
            else:
                response_text += "土壤水分处于正常健康水平。"
                
        elif "天气" in user_text_lower or "雨" in user_text_lower or "weather" in user_text_lower:
            print("[Agent 决策] 决定调用工具: weather_forecast (气象预报)")
            weather_data = self.plugins["weather_forecast"].execute("farm_default")
            response_text += f"农场今天的天气预报是 {weather_data['today']['condition']}，最高气温约 {weather_data['today']['high_temp']}°C。 "
            response_text += f"明天预计会是 {weather_data['tomorrow']['condition']}。"
            
        elif "温" in user_text_lower or "热" in user_text_lower or "冷" in user_text_lower or "temp" in user_text_lower:
            print("[Agent 决策] 决定调用工具: iot_sensor (参数: temperature - 温度)")
            sensor_data = self.plugins["iot_sensor"].execute(sensor_type="temperature", location="greenhouse_1")
            response_text += f"{sensor_data['location']} 当前的温度是 {sensor_data['value']}{sensor_data['unit']}。"

        else:
            response_text = "您好，我是 FARMCLAW。我可以帮您检查传感器的状态（比如：土壤湿度、温室温度）或者查询本地农业气象。请问您的农场今天需要什么帮助？"

        self.conversation_history.append({"role": "assistant", "content": response_text})
        return response_text
