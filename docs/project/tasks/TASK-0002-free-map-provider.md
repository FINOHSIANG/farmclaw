# TASK-0002 免费地图接入

创建日期：2026-08-25
状态：已完成

## 目标

- 为数字农场接入无需 API Key 的免费地图服务，并设为默认地图模式。
- 保留 AMap 模式作为可选兼容路径。
- 让现有农田、鱼塘、水域、建筑、温室、作物、风险、产值、服务点、无人机与越界数据可在免费地图中展示和切换。

## 非目标

- 不承诺第三方公共瓦片服务的 SLA 或中国大陆网络质量。
- 不在本阶段自建瓦片服务器或离线地图包。
- 不移除原 digitalFarm AMap/Loca/Three.js 代码。

## 范围与依赖

- 默认方案：MapLibre GL JS + OpenFreeMap Positron vector style。
- 数据：现有 `public/static/mock/*.geojson`。
- 配置：`VITE_MAP_PROVIDER`、`VITE_MAP_STYLE_URL`；AMap 模式继续使用 `VITE_AMAP_KEY`。

## 实施计划

1. 核验供应商接口、条款和浏览器可访问性。
2. 增加 MapLibre provider adapter 与 GeoJSON 图层。
3. 将专题、回中心、无人机和越界操作路由到当前 provider。
4. 更新 HUD、环境模板和使用说明。
5. 构建、浏览器桌面/移动端 QA、独立 verifier 审查。

## 验证计划

- `npm run build`
- 浏览器真实访问 OpenFreeMap style/tiles，无框架错误。
- 验证默认地图、专题切换、无人机、越界与移动 viewport。
- `python tests/test_flow.py`

## 回滚方案

- 将 `VITE_MAP_PROVIDER` 设置为 `amap` 可切回原 provider。
- 删除 MapLibre adapter 和依赖即可恢复原行为。

## 风险

- OpenFreeMap 为公共服务，生产高流量场景应评估自托管或签约 SLA。
- 免费地图数据基于 OpenStreetMap，需要保留归属声明。
- 中国大陆跨境网络可用性需在实际部署地验证。

## 验证结论

- 独立 verifier：PASS，无阻断/P0/P1 问题。
- 真实 style、tile、sprite、font 和 13 个 GeoJSON 请求均返回成功。
- 独立审查发现的 null 权重过滤与越界状态生命周期问题已修复。
