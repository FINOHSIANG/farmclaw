# TASK-0013 子 Agent 分工计划

创建日期：2026-08-26
主控：Codex `/root`

## 分工

- Explorer：只读检查园区边界、围栏数据、地图图层与面板范围口径，提交最小改动建议。
- Orchestrator：实现数据、地图、UI、测试和项目记录修改，保护现有融合改动。
- Verifier：实现完成后独立只读复核数据一致性、桌面/移动端交互和回归命令。

## 边界

- 子 Agent 不得使用 agmesh，不得提交、推送或回退用户改动。
- Explorer 与 Verifier 只读；主控负责所有写入与最终裁决。
- 以 `border.geojson` 为范围事实源，不凭视觉重新绘制边界。

## 验证

- `npm run test:security`
- `npm run test:map-labels`
- `npm run test:facility-icons`
- `npm run build`
- `python tests/test_flow.py`
- Playwright 1440×900、390×900
- `git diff --check`
