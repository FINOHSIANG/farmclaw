# digitalFarm 基座融合交付记录

## 摘要

Farmclaw dashboard 已从 Svelte 原型切换为 `digitalFarm` 的 Vue 数字孪生地图基座，
同时保留并接入 Farmclaw 的 WebSocket 网关、节点拓扑、农业遥测、AI 事件与指令能力。

## 交付内容

- Vue 3 + Vite + AMap/Loca + Three.js 前端入口和上游地图图层。
- 农田、水域、作物、风险、产值、无人机、3D Tiles 等静态场景资产。
- `FarmclawHud.vue` 与 `useFarmclawBridge.js` 实时控制面。
- `VITE_AMAP_KEY` / `VITE_FARMCLAW_WS_URL` 配置模板与无 Key 降级体验。
- 节点离线事件广播、第三方来源说明、任务契约与 ADR。

## 验证证据

- 前端 `npm run build` 通过。
- Python 离线测试与模块编译通过。
- Playwright 桌面/移动冒烟通过；模拟器注入后读数和事件流可见。
- `git diff --check` 通过；未发现上游硬编码 AMap Key。

## 已知缺口

- 上游仓库及 `gl-layers` 编译产物许可证未明确。
- AMap/Loca 需要有效 Key 和域名白名单，当前环境未验证真实地图瓦片加载。
- npm audit endpoint 被当前镜像返回 404，依赖安全审计待单独在可用 registry 执行。
- Three.js 产物较大，尚未进行按路由拆包与低端设备性能调优。

## 后续任务

1. 取得上游和 `gl-layers` 明确授权并补充许可证文件。
2. 配置生产 AMap Key、白名单与代理策略。
3. 将遥测字段映射到地图 Feature 的 `field_id`，支持按田块高亮和风险图层增量更新。
4. 拆分上游单体 `index.vue`、按需加载 3D Tiles，并执行真实 WebGL 性能测试。
