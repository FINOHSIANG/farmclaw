# Farmclaw 数字孪生智慧农场

Farmclaw 是一个面向现代农业场景的分布式控制与调度原型。当前前端以
[`gyrate/digitalFarm`](https://github.com/gyrate/digitalFarm) 的数字农场地图为视觉基座，
保留 Farmclaw 原有的 Python WebSocket 农业遥测网关、边缘节点与有机农业领域模型，
并引入 VoltGUI `dev` 分支采用的 Electron + 官方 DSH 控制面，形成“数字孪生场景 +
本地 Agent 会话 + 实时农业数据适配”的融合版本。

## 融合架构

- `desktop-shell/`：Electron 44 薄壳，使用官方 `@deepseek-ai/dsh` 管理 Agent 会话、指令、工具和持久化；只向 Vue 暴露窄 preload API。
- `gateway/`：WebSocket 农业数据适配层，负责节点注册、遥测/RPC 和观察者事件广播；浏览器模式继续兼容原聊天协议。
- `core/`：Farmclaw AI 控制与有机农业领域模型。
- `nodes/`、`plugins/`：IoT、天气等边缘节点和技能实现。
- `farmclaw-dashboard/`：Vue 3 数字孪生前端；默认使用无需 Key 的 OpenFreeMap + MapLibre，亦可切换 AMap/Loca + Three.js；通过观察者协议实时接收节点拓扑、遥测和 AI 消息。
- `farmclaw-dashboard/public/static/`：农田 GeoJSON、无人机模型、3D Tiles、纹理和图标等数字农场场景资产。

桌面模式下，AI 指令优先发送到官方 DSH；Python 网关仍同时连接并持续接收节点拓扑、农业遥测和对象观测。DSH 启动或请求失败时，指令自动回退到原网关并写入系统事件流。直接在浏览器打开前端时不会加载桌面权限，行为保持原有 WebSocket 模式。

### 安防能力

- 电子围栏：园区周界绑定园区边界范围，核心温室围栏绑定实际温室面域；仓储、水岸保留独立防区，支持单区/全局布防撤防、显隐和告警确认。
- 摄像头点位：在线、离线、维护、告警状态，支持地图聚焦、视场角、详情和点位显隐。
- 空间对象弹窗会同时展示对象级预警、处置建议、摄像头识别结果、置信度和观测时间；支持接入可信快照或浏览器原生可播放的视频地址。只有在线、时间新鲜、来源可信且已开始播放的画面才标记 `LIVE`。
- 安全操作和对象观测会写入实时事件流。当前摄像头状态预览为演示界面，不包含真实视频流或凭据。

### AI 托管

- 支持观察、辅助托管、自动托管三种模式，默认使用“辅助托管 + Dry Run”。
- 根据遥测新鲜度、温湿度、光照、pH、节点健康和安防告警生成可解释任务，并展示风险、置信度、依据和建议动作。
- 支持人工批准、拒绝、紧急停止、恢复、安全护栏和审计记录。
- 自动模式只提交低风险巡检或数字孪生模拟；中高风险始终需要人工批准，且界面会区分“已提交”“已模拟”和真实设备执行结果。
- AI 托管提供独立“模型与知识库设置”按钮，可进入专用管理视图查看当前执行引擎、知识来源及配置版本；新任务记录模型、知识库和版本来源。
- 当前实际可用项为本地规则基线与内置有机农业规则包。Provider 和向量知识库示例保持“未配置”，不会伪装成真实模型或索引服务。
- API Key、模型端点和知识原文不得进入前端环境变量、浏览器存储或审计日志；真实模型与 RAG 接入需要服务端密钥、路由、文档接入和向量检索服务。
- 底部 AI 指令栏支持本地农业顾问、运维工程师和安防分析三种对话路由；文件/图片当前仅做本地预览，发送到网关的附件字段明确为未上传元数据。

### 产值预测分类

- 支持按“全部产业 / 种植业 / 水产养殖 / 未分类”查看，并可继续筛选具体作物或水产品类。
- 面板展示综合预测指数、高潜力点、品类占比和相对表现，筛选会同步更新地图预测点。
- 当前数据为无量纲演示预测指数，不代表销售额、利润或真实财务收入。

### 专业控制台界面

- 深色数字孪生地图和克制的工业科技视觉，业务专题与地图工具分离。
- AI、安防和生产态势使用统一的运营检查器语言；桌面保持信息密度，移动端使用保留地图视野的底部工作面板。
- 系统事件流支持桌面端收起/展开，收起时保留事件数量和展开入口，不停止事件接收。
- 设计规则和可复用令牌记录在 `PRODUCT.md`、`DESIGN.md` 与 `farmclaw-dashboard/src/style/theme.css`。

### 地图标注

- 生产专题按作物/水产品类聚合标注，产值专题显示品类预测指数和样本数。
- 安防标注显示摄像头、围栏和设施的名称/中文状态，告警、离线和维护优先呈现。
- 标注具有缩放分级、碰撞避让和可点击详情，并使用文字、形状与颜色共同表达状态。
- 园区设施按仓储、服务站、检测中心使用不同形状，摄像头使用独立镜头图标；类别由形状表达，状态继续由状态点、颜色和中文表达。

### 生产态势详情

- 生产面板展示当前田块、作物、批次、生产阶段与阶段进度。
- 环境检查按温度、土壤水分、空气湿度、光照和 pH 分项展示正常、关注或待采集状态，并标明基于当前遥测快照。

### 运营保障看板

- 资源消耗看板按今日、本周、本月展示水（m³）、电（kWh）和肥液（L）的当前值、目标偏差、趋势与四分区明细。
- 设施设备运转看板展示运行中、待机、预警、离线汇总，可按状态筛选，并提供负载、累计运行、最近信号和设备编号。
- 农机监测看板独立展示 7 台演示农机，覆盖作业中、待机、充电中、异常、离线五类状态，并显示任务进度、速度、油量/电量、今日与累计工时、作业模式、维护计划和异常说明；卡片与数字孪生地图支持双向定位。
- 数字孪生空间对象弹窗（如水产塘口、种植地块、温室）支持“对象预警 + 摄像头观测”双区展示；POND-062 提供可复现且明确标注的高风险演示样例，其他未绑定对象不生成虚构相机数据；网关收到 `twin_observation` / `camera_observation` 后可无刷新更新弹窗。
- 资源、固定设施与农机目录均明确标注演示来源；网关在线、节点数和更新时间仅来自 `gateway-observation`，不代表真实水表、电表、肥液计量、PLC 或车辆状态。

### 对象观测消息（接入约定）

网关观察者可发送以下消息更新空间对象弹窗，前端以 `twin_id` 作为稳定主键：

```json
{
  "type": "twin_observation",
  "twin_id": "POND-062",
  "alert": { "level": "attention", "count": 2, "title": "水质波动" },
  "camera": {
    "id": "CAM-POND-062",
    "status": "online",
    "snapshot_url": "https://example.invalid/latest.jpg",
    "result": "鱼群活动回升",
    "confidence": 97,
    "observed_at": "2026-09-02T18:05:00+08:00"
  }
}
```

`stream_url`、`snapshot_url` 默认只接受看板同源的 `http(s)` 地址；跨域地址必须使用 HTTPS，并把精确 origin 配置到 `VITE_TWIN_MEDIA_ALLOWED_ORIGINS`（逗号分隔）。前端拒绝 `blob:`、`data:`、协议相对地址、带账号密码的 URL 和 HTTPS 页面的混合内容，并以 `no-referrer` 加载媒体。生产接入仍需在网关侧完成鉴权、短期签名、转码、隐私遮挡和访问审计；前端只负责观测展示，不提供远程启停或摄像头控制。

观测消息默认采用 `patch` 合并，未传字段保持不变；发送 `observation_mode: "snapshot"` 可替换同一对象的完整观测快照。可通过 `clear_alert`、`clear_camera_media`、`clear_camera_result`、`clear_camera_metrics` 或 `clear_camera` 清理旧状态。对象编号、文本长度和前端缓存数量均有限制，`warning` / `attention` 即使未携带数量也会进入预警事件流。

## 环境要求

- Python 3.8+
- Node.js 20.19+
- 桌面运行时固定使用 Node.js 26.8.1、pnpm 12.1.0、Electron 44.0.0 和 `@deepseek-ai/dsh` 0.1.5-rc.3
- OpenFreeMap 默认模式无需地图 Key

安装 Python 依赖：

```powershell
pip install websockets aioconsole
```

配置并安装前端：

```powershell
Copy-Item farmclaw-dashboard/.env.example farmclaw-dashboard/.env.local
Set-Location farmclaw-dashboard
npm install
```

默认会加载 OpenFreeMap 免费矢量地图和 Farmclaw GeoJSON 业务图层，无需注册或配置 Key。
如需切回上游高德三维场景，在 `.env.local` 设置 `VITE_MAP_PROVIDER=amap` 并填写 `VITE_AMAP_KEY`。

## 启动

在项目根目录启动网关、IoT、天气与 AI 节点：

```powershell
.\start_all.ps1
```

另开终端启动数字孪生前端：

```powershell
Set-Location farmclaw-dashboard
npm run dev
```

默认访问 `http://localhost:5173/#/index`。也可运行 `python simulate.py` 注入模拟数据。

桌面模式先构建前端，再启动 Electron：

```powershell
Set-Location desktop-shell
npx --yes pnpm@12.1.0 install --frozen-lockfile
npm run build
npm start
```

桌面壳加载同一份 `farmclaw-dashboard/dist`，不会维护另一套界面。模型凭据由官方 DSH 自身的 credentials/settings 机制管理，不应写入前端环境变量或仓库。

## 验证

```powershell
python tests/test_flow.py
Set-Location desktop-shell
npx --yes node@26.8.1 node_modules/typescript/bin/tsc --noEmit
npx --yes node@26.8.1 --test src/*.test.ts
npx --yes node@26.8.1 scripts/build.mjs
Set-Location farmclaw-dashboard
npm run test:desktop-bridge
npm run test:ai
npm run test:ai-registry
npm run test:map-labels
npm run test:facility-icons
npm run test:value
npm run test:security
npm run test:operations
npm run test:twin-observation
npm run build
```

## 上游来源与许可提醒

本次融合基于 `gyrate/digitalFarm` 提交
`c8f47dcbd516551d87b7067664af31ba6fed2742`。该上游仓库当前未声明许可证；在公开分发、商业使用或再许可之前，
需要由项目所有者取得明确授权。详见 [`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md)。

桌面 Agent 控制面参考 `zuohuadong/volt-gui` `dev` 分支提交
`427e7130269f320f85b4fbd3708fb48970c07648` 的 Electron/官方 DSH 架构，按 MIT License 使用；Farmclaw 保留 Vue 数字孪生前端，没有复制其 Svelte 界面。
