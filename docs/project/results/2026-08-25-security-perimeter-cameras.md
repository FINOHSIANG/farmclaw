# 电子围栏与摄像头点位交付记录

## 摘要

安全巡防专题已升级为可操作的安防控制面，包含电子围栏分区、摄像头点位、设备状态、告警确认和事件流反馈。

## 交付内容

- `security.geojson`：4 个电子围栏、8 个摄像头、12 个唯一安防对象。
- MapLibre 图层：围栏填充/边界、摄像头光圈/标签、摄像头视场角。
- 安防地图 API：围栏布撤防、全部布撤防、图层显隐、告警确认、摄像头/围栏聚焦和点位点击。
- `SecurityPanel.vue`：安防统计、摄像头/围栏标签页、状态列表、演示预览和操作入口。
- 操作事件：`SECURITY.SELECT/ACK/ARM/DISARM/CAMERA_LAYER/FENCE_LAYER`。
- 安防 GeoJSON 数据校验脚本与 `npm run test:security`。

## 验证证据

- `npm run test:security`：4 fences、8 cameras、12 unique ids，PASS。
- `npm run build`：PASS。
- Playwright 桌面与 390×900 移动端：安全专题、摄像头聚焦/视场角、告警确认、围栏全部撤防/布防、围栏显隐、地图弹窗均通过。
- 浏览器无运行时错误或框架错误覆盖层；仅保留已知 OpenFreeMap style worker warning。
- Python 离线遥测测试与模块编译通过。

## 已知缺口

- 围栏和点位是演示数据，投产前必须替换为现场测绘和设备台账。
- 状态保存在前端运行时，刷新后恢复演示初始值；尚未接入数据库和权限审计。
- 摄像头预览不是 RTSP/GB28181 实时流，不包含录像、PTZ 或鉴权。
- AMap provider 未同步完整新安防面板交互；默认 OpenFreeMap provider 是本次验收路径。

## 后续任务

1. 增加后端安防 API、告警持久化、权限和审计日志。
2. 通过媒体网关接入 GB28181/WebRTC/HLS，令前端只持有短期播放引用。
3. 增加围栏在线编辑、现场坐标导入和规则排程。
