import asyncio
import sys
import os
from typing import Dict, Any

# 将父目录加入路径，便于 from core.organic_models import ...
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nodes.base_node import BaseNode
from core.organic_models import build_sensor_reading, resolve_field


def read_sensor_data(**kwargs) -> Dict[str, Any]:
    """模拟读取农业传感器数据 (暴露为 Skill: sensor.read_data)。

    支持的 metric (sensor_type):
      - temperature    温度
      - soil_moisture  土壤水分
      - humidity       空气湿度
      - ph             土壤酸碱度
      - light          光照强度 (lux)
      - ec             电导率 (dS/m)

    返回标准遥测结构，包含 field_id / crop_batch_id / metric / value / unit /
    captured_at / source_node，可被 Dashboard 的 ingestTelemetry 直接消费，
    也符合开发方案定义的田块级遥测规范。
    """
    metric = kwargs.get("sensor_type") or kwargs.get("metric")
    field_id = kwargs.get("field_id") or kwargs.get("location", "greenhouse-1")

    if not metric:
        return {"error": "缺少参数 sensor_type"}

    reading = build_sensor_reading(metric, field_id)
    field = resolve_field(field_id)
    print(f"[IoT] 读取 {field['name']}({field['field_id']}) 的 {metric} -> {reading}")
    return reading


if __name__ == "__main__":
    node = BaseNode(node_id="farm_iot_sensors_v1")
    node.register_skill("sensor.read_data", read_sensor_data)

    try:
        asyncio.run(node.connect_and_run())
    except KeyboardInterrupt:
        print("物联网节点关闭。")
