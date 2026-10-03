# TASK-0012 子 Agent 分工计划

创建日期：2026-08-25
主控：Codex `/root`

## 分工

- Explorer：只读识别设施数据、可靠分类字段、两地图引擎渲染边界和验收。
- Executor：实现纯分类/SVG注册表和自动化校验，不改地图渲染、组件与文档。
- Verifier：独立只读复核图标映射、地图与设备列表、交互、响应式和回归。
- Orchestrator：负责 GeoJSON 显式分类、MapLibre/AMap 接线、设备列表 UI、文档和最终裁决。

## 权限与验证

- Executor 仅修改 `src/utils/facilityIcons.js`、`scripts/validate-facility-icons.mjs` 和 `package.json` 测试脚本。
- 不提交、推送或部署，不覆盖用户已有融合改动。
- 验证：`test:facility-icons`、`test:map-labels`、`test:security`、`test:operations`、`test:ai`、`test:value`、构建、Playwright 桌面/移动和 `git diff --check`。
