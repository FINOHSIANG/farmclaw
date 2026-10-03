# 设施图标差异化成果

日期：2026-08-25
任务：`../tasks/TASK-0012-facility-icon-differentiation.md`

## 交付结果

- 园区设施按仓储、服务站、检测中心显示三种不同图标，共 6 点，显式分类计数为 3 / 2 / 1。
- 8 个摄像头使用统一摄像头形状，外围 halo、状态色和中文继续表达告警、在线、离线和维护状态。
- 运营设备目录的 8 台设备覆盖水利控制、环境控制、肥液、水产、传感五类图标，类别与状态语义分离。
- MapLibre 图标、标签、显隐、点击弹窗和选择效果已接通；受控图标不会被通用透明占位图静默替代。
- AMap 服务设施已静态接入同一套 SVG 分类图标；本地无 AMap Key，因此未声明完成在线 AMap 渲染验证。

## 数据边界

- 未给缺少用途字段的建筑和温室面域推断类别。
- 未将没有坐标的运营设备投放到地图。
- 图标不包含脚本、事件处理器或外链资源；未知类型安全回退为通用设施。

## 验证

- `npm run test:facility-icons`
- `npm run test:map-labels`
- `npm run test:security`
- `npm run test:operations`
- `npm run test:ai`
- `npm run test:ai-registry`
- `npm run test:value`
- `npm run build`
- `python tests/test_flow.py`
- `git diff --check`
- Playwright：1440×900 与 390×900；设备筛选、摄像头聚焦和弹窗交互通过，控制台 0 error / 0 warning。

## 已知限制

- AMap/Loca 需要有效 `VITE_AMAP_KEY` 才能进行真实在线渲染验收。
- 运营设备数据仍为明确标记的演示目录，不代表现场 PLC 的真实开停机状态。
