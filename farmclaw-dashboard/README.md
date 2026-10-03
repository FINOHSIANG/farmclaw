# Farmclaw Digital Farm Dashboard

Vue 3 + MapLibre/AMap/Three.js 数字孪生前端。它以 `gyrate/digitalFarm` 的地图与三维场景为基座，
通过 Farmclaw WebSocket observer 协议接入节点拓扑和农业遥测；在 Electron 桌面模式下，AI 指令与会话优先由官方 DSH 承接。

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

默认 provider 是无需 Key 的 OpenFreeMap + MapLibre。只有切换为 `VITE_MAP_PROVIDER=amap` 时才需要填写 `VITE_AMAP_KEY`。

同一套 Vue 构建产物同时服务浏览器和 `desktop-shell/`。浏览器模式保持原 WebSocket 指令协议；桌面模式通过 `window.farmclawDesktop` 的窄 preload API 使用 DSH，且继续连接网关接收遥测。DSH 不可用时会自动回退到网关，不改变地图、HUD 和业务面板交互。

界面包含 AI 托管专题：观察、辅助、自动三种模式，以及可解释任务、人工审批、安全护栏、紧急停止和审计记录。当前真实设备控制保持 Dry Run，高风险动作不会自动执行。

底部 AI 指令栏支持本地农业顾问、运维工程师和安防分析选择，并支持文件/图片本地预览。当前网关没有文件上传服务，附件只发送 `uploaded:false` 元数据，不代表文件已上传或 Agent 已切换到后端服务。

AI 托管内提供独立“模型与知识库设置”按钮与专用管理视图：当前本地规则基线和有机农业规则包可用，未接入的 Provider/向量知识库会保持“未配置”并阻止伪激活。配置来源会写入新生成任务，API Key 和知识原文不进入浏览器。

产值预测专题支持种植业、水产养殖、未分类和具体品类筛选，并与 MapLibre 预测点联动。展示值是无量纲演示预测指数，不代表真实财务收入。

生产态势面板展示作物、批次、阶段进度和五项环境检查；健康摘要基于当前遥测快照，不代表现场生产系统的质量判定。

MapLibre 业务标注支持生产品类聚合、产值指数摘要、安防中文状态、园区设施名称、缩放分级、碰撞避让和点击详情。仓储、服务站、检测中心和摄像头使用差异化形状；运营设备目录进一步区分水利控制、环境控制、肥液、水产和传感设备，同时保留独立状态点和文字。

安全专题以电子围栏作为防区范围唯一边线：园区周界与 `border.geojson` 一致，核心温室围栏与 18 个 `greenhouse.geojson` 温室面域一致，不再显示穿过检测中心的旧矩形蓝线。

运营保障专题包含资源消耗、设备运行与农机监测三个只读看板：资源按日/周/月展示水、电、肥液演示基线，设备目录展示状态筛选、负载、累计运行与最近信号，农机目录展示五类运行状态、任务进度、速度、油量/电量、今日与累计工时、维护计划、异常说明和地图双向定位。界面会区分 `gateway-observation` 网关观测、`demo-baseline` 固定设施基线与 `demo-machinery` 农机演示遥测，不把演示目录表述为现场 PLC 或车辆状态。

数字孪生空间对象弹窗支持对象级“预警 + 摄像头观测”联动：预警区展示等级、标题、证据、建议和观测时间；摄像头区展示可信快照或浏览器可播放的视频流、识别结论、置信度和指标。只有可信来源、摄像头在线、观测时间在两分钟内且画面实际开始播放后才显示 `LIVE`；断流、断网、离线或过期会自动降级。POND-062 保留明确标注的演示样例，其他未绑定对象不再生成相机编号或置信度。

运营看板数据模型可通过以下命令校验：

```powershell
npm run test:operations
npm run test:machinery
npm run test:twin-observation
npm run test:facility-icons
npm run test:ai-registry
npm run test:hud-events
npm run test:command-composer
npm run test:desktop-bridge
npm run test:production-dashboard
```

更多启动、架构和许可说明见项目根目录 `README.md` 与 `docs/THIRD_PARTY_NOTICES.md`。
