"""有机农业数字化种植 AI 系统 - 共享数据模型 (MVP)。

为 IoT 节点、Pi Agent 与 simulate.py 提供统一的遥测结构与轻量规则建议，
与 docs/organic-ai-development-plan.md 定义的标准遥测结构保持一致：
field_id / crop_batch_id / metric / value / unit / captured_at / source_node。

本模块只做纯函数的数据组装与规则基线，不触碰网络与持久化，
便于单测和后续替换为真实模型适配器。
"""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any, Dict, Optional


# 田块 / 作物批次目录 (与 Dashboard App.svelte 的 fields 对齐，便于后端 Mock 联动)
FIELD_CATALOG: Dict[str, Dict[str, Any]] = {
    "greenhouse-1": {
        "field_id": "greenhouse-1",
        "name": "1号温室",
        "crop": "有机番茄 春茬",
        "crop_batch_id": "ORG-2024-01",
        "stage": "坐果期",
    },
    "field-a": {
        "field_id": "field-a",
        "name": "A区露地",
        "crop": "有机生菜 夏茬",
        "crop_batch_id": "ORG-2024-02",
        "stage": "营养生长期",
    },
    "orchard-b": {
        "field_id": "orchard-b",
        "name": "B区果园",
        "crop": "有机蓝莓",
        "crop_batch_id": "ORG-2024-03",
        "stage": "膨果期",
    },
}

# 兼容旧调用方使用的 location 别名 (greenhouse_1 / field_A / farm_default ...)
LEGACY_LOCATION_MAP: Dict[str, str] = {
    "greenhouse_1": "greenhouse-1",
    "greenhouse-1": "greenhouse-1",
    "field_A": "field-a",
    "field-a": "field-a",
    "field_a": "field-a",
    "orchard_B": "orchard-b",
    "orchard-b": "orchard-b",
    "farm_default": "greenhouse-1",
}

DEFAULT_FIELD_ID = "greenhouse-1"


def resolve_field(field_id: Optional[str]) -> Dict[str, Any]:
    """根据 field_id 返回田块元信息；未命中时回退到默认温室。"""
    if field_id and field_id in FIELD_CATALOG:
        return FIELD_CATALOG[field_id]
    legacy = LEGACY_LOCATION_MAP.get((field_id or "").strip(), DEFAULT_FIELD_ID)
    return FIELD_CATALOG[legacy]


def now_iso() -> str:
    """UTC ISO8601 时间戳，作为遥测采集时刻。"""
    return datetime.now(timezone.utc).isoformat()


# 各指标的模拟范围与状态判定 (规则基线，后续可替换为模型适配器)
SENSOR_PROFILES: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "unit": "°C",
        "range": (15.0, 35.0),
        "status": lambda v: "high-temp" if v > 32.0 else ("low-temp" if v < 18.0 else "normal"),
    },
    "soil_moisture": {
        "unit": "%",
        "range": (20.0, 60.0),
        "status": lambda v: "dry - needs water" if v < 30.0 else ("over-wet" if v > 55.0 else "normal"),
    },
    "humidity": {
        "unit": "%",
        "range": (40.0, 90.0),
        "status": lambda v: "normal",
    },
    "light": {
        "unit": "lux",
        "range": (6000.0, 18000.0),
        "status": lambda v: "low-light" if v < 8000.0 else "normal",
    },
    "ph": {
        "unit": "",
        "range": (5.5, 7.5),
        "status": lambda v: "acidic" if v < 6.0 else ("alkaline" if v > 7.2 else "normal"),
    },
    "ec": {
        "unit": "dS/m",
        "range": (0.8, 2.0),
        "status": lambda v: "normal",
    },
}


def mock_sensor_value(metric: str) -> float:
    profile = SENSOR_PROFILES.get(metric)
    if not profile:
        raise ValueError(f"未知的传感器类型: {metric}")
    low, high = profile["range"]
    return round(random.uniform(low, high), 1)


def sensor_status(metric: str, value: float) -> str:
    profile = SENSOR_PROFILES.get(metric)
    if not profile:
        return "normal"
    return profile["status"](value)


def build_telemetry(
    metric: str,
    value: float,
    unit: str,
    field_id: Optional[str] = None,
    crop_batch_id: Optional[str] = None,
    status: str = "normal",
    source_node: str = "farm_iot_sensors_v1",
) -> Dict[str, Any]:
    """构造一条标准遥测记录。

    返回结构同时满足：
    - Dashboard ingestTelemetry (sensor/value/location)
    - 开发方案要求的 field_id/crop_batch_id/metric/unit/captured_at/source_node
    """
    field = resolve_field(field_id)
    return {
        "sensor": metric,
        "metric": metric,
        "location": field["name"],
        "field_id": field["field_id"],
        "crop_batch_id": crop_batch_id or field["crop_batch_id"],
        "crop": field["crop"],
        "stage": field["stage"],
        "value": value,
        "unit": unit,
        "status": status,
        "captured_at": now_iso(),
        "source_node": source_node,
    }


def build_sensor_reading(metric: str, field_id: Optional[str] = None) -> Dict[str, Any]:
    """生成一条完整的模拟传感器读数，供 IoT 节点 skill 与 simulate 复用。"""
    profile = SENSOR_PROFILES.get(metric)
    if not profile:
        return {"error": f"未知的传感器类型: {metric}"}
    value = mock_sensor_value(metric)
    status = sensor_status(metric, value)
    return build_telemetry(
        metric=metric,
        value=value,
        unit=profile["unit"],
        field_id=field_id,
        status=status,
    )


# 轻量有机农业建议 (规则基线)。topic 支持中英文关键词。
def organic_recommendation(topic: str, field_id: Optional[str] = None) -> str:
    """根据主题生成有机种植建议文本。

    所有建议均强调人工确认、投入品合规与追溯归档，
    与开发方案"首版不自动控制设备、只生成建议"的边界一致。
    """
    field = resolve_field(field_id)
    name = field["name"]
    batch = field["crop_batch_id"]
    crop = field["crop"]
    stage = field["stage"]
    t = (topic or "").lower()

    if any(k in t for k in ["虫", "病", "pest", "病害", "虫害"]):
        return (
            f"{name}（{crop}，批次 {batch}，{stage}）病虫害风险巡检建议："
            "优先采用粘虫板、性诱剂和生物防治；若必须使用生物农药，"
            "请核对有机允许投入品清单并记录安全间隔期，动作需人工确认后执行。"
        )
    if any(k in t for k in ["长势", "生长", "growth"]):
        return (
            f"{name} 当前处于{stage}，结合温湿度与光照综合评估长势正常；"
            f"建议保留巡检影像归档，作为批次 {batch} 的有机追溯依据。"
        )
    if any(k in t for k in ["灌溉", "浇水", "moisture", "irrigation", "水"]):
        return (
            f"{name}（批次 {batch}）灌溉建议：依据土壤湿度与未来降雨概率决定补水时机，"
            "避免夜间高湿诱发病害；有机种植强调节水与土壤保墒，需人工确认后开启滴灌。"
        )
    if any(k in t for k in ["采收", "收获", "harvest"]):
        return (
            f"{name}（批次 {batch}）采收预测：结合积温与历史批次曲线给出首采窗口，"
            "采前请确认有机认证与追溯材料齐套，并预留生成批次二维码。"
        )
    if any(k in t for k in ["追溯", "溯源", "认证", "trace", "traceability"]):
        return (
            f"批次 {batch} 的有机追溯链路包含：播种建档、投入品登记、巡检影像、采收二维码；"
            "首版使用本地事件台账与哈希摘要存证，暂不接入联盟链。"
        )
    return (
        f"{name} 有机种植提示：遵循有机标准，所有农事与投入品需录入批次 {batch} 台账，"
        "AI 建议仅供参考，设备动作需人工确认。"
    )
