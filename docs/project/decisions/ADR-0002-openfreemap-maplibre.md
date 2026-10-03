# ADR-0002 默认使用 OpenFreeMap + MapLibre

日期：2026-08-25
状态：已接受

## 背景

原 `digitalFarm` 地图依赖高德 Web JS API Key；当前项目没有 Key，默认预览只能显示降级 HUD。
项目需要一个无需注册、无需密钥、能承载现有 GeoJSON 和交互图层的免费地图接口。

## 决策

- 默认 provider 使用 MapLibre GL JS。
- 默认 style 使用 `https://tiles.openfreemap.org/styles/positron`，让高对比业务图层更清晰。
- 使用现有 GeoJSON 构建农田、水域、建筑、温室、作物、热力、产值、无人机等业务图层。
- 保留 OSM/OpenMapTiles/OpenFreeMap attribution，不遮挡或删除地图归属。
- `VITE_MAP_STYLE_URL` 可替换为自托管或其他 MapLibre-compatible style；`VITE_MAP_PROVIDER=amap` 可切回原实现。

## 选择原因

- 无 API Key，可直接浏览器访问。
- MapLibre 为开源渲染引擎，支持矢量瓦片、GeoJSON、热力、挤出与动画。
- 比直接使用 OSM 公共 raster tile 更适合数字孪生图层，也避免把 OSM 标准瓦片服务当作无约束 CDN。

## 后果

- 本地预览不再被 AMap Key 阻断。
- 生产环境仍依赖外部公共服务；高流量或强 SLA 场景应改为自托管 style/tiles。
- 原 AMap/Loca/Three.js 高级场景保留，但不再是默认 provider。
