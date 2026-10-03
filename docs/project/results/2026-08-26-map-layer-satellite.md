# 地图图层层级与卫星图切换成果

日期：2026-08-26
任务：`../tasks/TASK-0019-map-layer-satellite.md`

## 交付结果

- 风险热力图透明度由约 0.8 降至 0.40–0.44，标注与设施图标继续绘制在热力图上方。
- 新增卫星图按钮，OpenFreeMap 模式使用 Esri World Imagery 公共影像瓦片；高德模式也支持 TileLayer.Satellite 开关。
- 卫星影像位于地图背景之上、农田/建筑业务图层之下，不会遮挡业务标注。
- 专题切换不会重置卫星图状态；按钮使用 `aria-pressed` 同步开关状态。

## 验证

- `npm run test:map-controls`
- `npm run test:alert-center`
- `npm run build`
- Playwright：1440×900 卫星影像开启/关闭、瓦片 200、Esri 署名、按钮和事件流状态；390×900 无水平溢出；控制台 0 error / 0 warning。
- 独立 verifier 复核通过：专题切换保留卫星状态，热力图降透明后地块与标注可读，桌面与移动端开关状态一致。
