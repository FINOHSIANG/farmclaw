# 系统事件面板可收起成果

日期：2026-08-26
任务：`../tasks/TASK-0014-collapsible-event-stream.md`

## 交付结果

- 系统事件面板右上角增加收起/展开按钮。
- 收起后保留 EVENT STREAM、系统事件标题和实时数量；事件列表隐藏，地图可视区域释放。
- 展开后恢复完整事件列表；按钮名称和 `aria-expanded` 随状态同步。
- 收起状态为界面本地状态，不影响网关事件接收、事件数量或事件顺序。

## 验证

- `npm run test:hud-events`
- `npm run test:map-labels`
- `npm run test:facility-icons`
- `npm run test:security`
- `npm run test:operations`
- `npm run test:ai`
- `npm run test:ai-registry`
- `npm run test:value`
- `npm run build`
- `python tests/test_flow.py`
- Playwright：1440×900 展开/收起/再次展开，390×900 无遮挡，控制台 0 error / 0 warning。
- `git diff --check`

## 已知边界

- 390px 断点沿用既有策略隐藏事件面板；移动端不会显示收起按钮，但不会影响地图和底部导航。
