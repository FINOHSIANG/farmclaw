# 免费地图接入交付记录

## 摘要

Farmclaw 数字孪生前端已默认使用 OpenFreeMap + MapLibre GL JS，不再要求用户申请地图 Key。
原 AMap/Loca/Three.js provider 保留为可选兼容模式。

## 交付内容

- MapLibre provider adapter：`farmclaw-dashboard/src/utils/freeMap.js`。
- OpenFreeMap Positron 矢量底图与自动 attribution。
- 农田、鱼塘、水域、建筑、温室、作物、热力风险、产值、服务点、边界、无人机和越界 GeoJSON 图层。
- 生产/安全/产值专题切换、回中心、无人机动画、越界告警弹窗。
- `VITE_MAP_PROVIDER` 和 `VITE_MAP_STYLE_URL` 配置；默认无需 Key，可切换 AMap。
- 供应商、许可、无 SLA、境内网络和自托管建议文档。

## 验证证据

- OpenFreeMap style URL 返回 HTTP 200；浏览器 style/tiles 加载成功并显示 attribution。
- `npm run build` 通过；MapLibre 被拆成独立异步 chunk。
- Playwright 桌面与 390×900 移动 viewport 均渲染成功，无框架错误。
- 生产/产值专题、无人机巡航、越界告警均完成交互验证。
- Python 遥测离线测试通过；网关在线联调可继续运行。
- `git diff --check` 和硬编码上游 AMap Key 扫描通过。

## 已知缺口

- OpenFreeMap 公共实例按现状提供，无生产 SLA；大陆生产环境建议自托管或使用境内 CDN。
- 默认无卫星影像；如需卫星底图，应采用明确授权的数据源。
- OpenFreeMap 公共 style 在当前 MapLibre 版本会输出 3 条“数值为 null”的非阻断 worker warning；地图与业务交互不受影响。
- 两个 provider 分别产生约 1.06MB 和 1.29MB 的异步/入口 chunk，后续仍需做 WebGL 性能优化。
- GeoJSON 与底图已完成视觉对齐抽查，但不能代替权威测绘校核。

## 后续任务

1. 为生产部署准备自托管 OpenMapTiles/PMTiles 或境内兼容 style URL。
2. 增加 provider adapter 自动化测试和 GeoJSON 图层截图回归。
3. 继续拆分原 `digitalFarm` 单体页面与 Three.js/gl-layers 依赖。
