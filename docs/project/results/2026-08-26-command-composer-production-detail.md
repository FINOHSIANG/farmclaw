# 对话编辑器与生产态势详情成果

日期：2026-08-26
任务：`../tasks/TASK-0015-command-composer-production-detail.md`

## 交付结果

- AI 指令栏支持三个本地 Agent 选择、文件/图片选择、本地图片预览、附件移除和发送前元数据整理。
- 附件限制为最多 5 个、单个 10 MB，并明确标记“尚未上传”；当前后端未提供文件上传服务，因此没有伪造成功状态。
- 生产态势增加生产档案、批次、阶段进度、区域和温度/水分/湿度/光照/pH 五项检查。
- 系统事件收起功能已完成，继续保留事件数量和事件流接收。

## 验证

- `npm run test:command-composer`
- `npm run test:production-dashboard`
- `npm run test:hud-events`
- `npm run test:map-labels`
- `npm run test:facility-icons`
- `npm run test:security`
- `npm run test:operations`
- `npm run test:ai`
- `npm run test:ai-registry`
- `npm run test:value`
- `npm run build`
- Playwright：Agent 切换、TXT 附件本地预览、结构化发送事件，桌面 1440×900；生产态势桌面/390×900回归。
- Playwright 补测图片附件缩略图、移除附件、390×900 无横向溢出；有附件时专题导航与地图工具自动上移，控制台错误/警告均为 0。
- 独立 verifier 复核通过：Agent 与附件能力保持“本地路由/尚未上传”边界，生产档案与遥测健康摘要未夸大为真实生产结果。

## 已知边界

- Agent 选择目前是本地 UI 路由元数据，Pi Agent 后端尚未按 `agent_id` 分流。
- 文件/图片尚未上传到服务端，不能用于后端 AI 内容解析；需后续增加鉴权上传、病毒扫描、附件 ID 和 ready 状态协议。
- Python `tests/test_flow.py` 应从仓库根目录运行；前端目录下运行会因路径不存在而失败。
