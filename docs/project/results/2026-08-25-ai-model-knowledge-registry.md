# AI 模型与知识库管理交付记录

日期：2026-08-25
任务：`TASK-0009-ai-model-knowledge-registry.md`
状态：已完成

## 交付内容

- AI 托管提供独立“模型与知识库设置”按钮，进入专用视图后包含“模型 / 知识库”二级管理；该入口由 TASK-0010 从原详情页签调整而来。
- 模型采用单选执行引擎语义，知识库采用多选知识来源语义；当前配置展示 revision。
- 新增无副作用 registry 状态转换：未配置或不存在项阻断且不改变 active/revision，重复选择当前引擎不增加 revision，至少保留一个有效知识来源。
- 每次 applied/blocked 操作记录配置审计并写入系统事件流。
- AI 新任务记录 `engineId`、`knowledgeBaseIds` 和 `configRevision`；重新评估不覆盖既有任务来源。

## 真实能力边界

- 当前实际可用模型为 `规则基线 v1`，状态为本地就绪。
- 当前实际可用知识来源为 `有机农业规则包`，它是内置规则包，不是向量知识库。
- Gateway LLM、本地农业模型、温室 SOP 和安防规程均为未来接入槽位，固定显示未配置，不能伪激活。
- 页面不接收或保存 API Key、Provider 端点、知识原文、虚假延迟、Token、文档数、切片数或索引状态。

## 验证证据

- `npm run test:ai-registry`：通过，覆盖阻断、幂等、revision、至少一个知识来源、审计和敏感字段检查。
- `npm run test:ai`：通过，新增任务 provenance 与既有任务来源保持测试。
- `npm run build`：通过，仅保留现有地图/Three.js 大 chunk 提示。
- Playwright 1440×900：模型/知识库页签、未配置模型和向量库阻断、事件流、截图与控制台检查通过。
- Playwright 390×900：AI 面板不遮挡专题和命令栏，详情页签与配置页签 44px，配置内容内部滚动，地图工具隐藏，控制台 0 error / 0 warning。
- 独立 verifier：PASS，无阻断、高、中或低严重度问题；确认 Dry Run、人工审批与紧急停止不受配置管理影响。

## 后续接入条件

- 真实模型切换需要服务端认证、密钥存储、Provider adapter、能力校验、健康检查、激活与回滚接口。
- 真实知识库需要文档权限、上传清洗、恶意内容检查、切片、Embedding、向量索引、检索引用和删除审计。
