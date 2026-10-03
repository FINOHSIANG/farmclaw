# 顶部大屏模式成果

日期：2026-08-26
任务：`../tasks/TASK-0020-top-fullscreen.md`

## 交付结果

- 顶部系统状态区新增“大屏”按钮，进入后变为“退出大屏”。
- 真实监听 `fullscreenchange`，支持 ESC 退出后状态自动回落。
- 全屏切换后触发 MapLibre/AMap 尺寸刷新。
- 中等宽度状态栏改用稳定类名，避免新增入口影响 ACTIVE NODES / FIELD SCOPE 隐藏逻辑。

## 验证

- `npm run test:fullscreen`
- `npm run test:map-controls`
- 全量前端校验、构建、仓库级离线流程通过。
- Playwright：1440×900 真实进入/退出全屏与事件流、390×900 顶部布局无溢出、控制台 0 error / 0 warning。
