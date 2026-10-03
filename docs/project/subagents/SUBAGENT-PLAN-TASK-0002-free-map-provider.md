# TASK-0002 子 Agent 分工计划

日期：2026-08-25
关联任务：`TASK-0002-free-map-provider.md`
状态：已完成

## 适用性判断

- 是否需要子 Agent：是
- 判断理由：涉及外部地图服务选择、许可/归属、真实浏览器网络和多图层兼容验证。
- 风险等级：中

## 分工

| 角色 | 目标 | 写权限 | 交付物 |
| --- | --- | --- | --- |
| Explorer | 比较免费地图方案、条款、国内可用性和 GeoJSON 兼容性 | 只读 | 推荐报告与引用链接 |
| Orchestrator | 实现 MapLibre provider、图层与 UI 集成 | 任务范围 | 代码、文档、验证证据 |
| Verifier | 独立检查构建、浏览器行为、许可归属和回归 | 只读 | PASS/FAIL 报告 |

## 裁决与恢复

- 默认选择无需 Key、支持矢量与 GeoJSON、保留 OSM attribution 的方案。
- 外部 style 不可用时展示明确错误并允许切回 AMap 或配置其他 MapLibre style URL。
- Verifier 的阻断问题必须修复后才能关闭任务。
