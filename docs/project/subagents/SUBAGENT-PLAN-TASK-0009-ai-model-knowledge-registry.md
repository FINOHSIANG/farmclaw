# TASK-0009 子 Agent 分工计划

创建日期：2026-08-25
主控：Codex `/root`

## 分工

- Explorer：只读检查 AI 托管、Gateway、PiAgent、配置与知识库真实能力，确定入口、数据边界、敏感信息边界和改动范围。
- Executor：聚焦 registry 纯状态模型、切换阻断和验证脚本，不改地图、HUD 布局与项目文档。
- Verifier：在主控完成接线后独立只读复核数据语义、任务 provenance、桌面/移动交互、敏感信息和全量回归。
- Orchestrator：维护任务契约，负责 UI/接线、处理冲突、检查 diff、浏览器验证与最终裁决。

## 权限与隔离

- Explorer 与 Verifier 只读。
- Executor 仅可修改 `src/utils/aiRegistry.js`、`src/composables/useAiRegistry.js`、`scripts/validate-ai-registry.mjs`。
- 不修改或提交用户已有融合改动，不写入密钥，不执行提交、推送或部署。

## 交付与验证

- Explorer：真实能力边界、IA、数据模型、风险与验收建议。
- Executor：可重复 registry 数据、状态转换和自动化校验。
- Verifier：PASS/FAIL、严重度、证据、桌面/移动截图和回归命令。
- 验证命令：`npm run test:ai-registry`、`npm run test:ai`、相关前端回归、`npm run build`、`python tests/test_flow.py`、`git diff --check`。

## 裁决规则

- 主控保留项目数据真实性与 UI 集成裁决权。
- 任何把未配置 Provider/向量库描述为已连接或在浏览器保存密钥的实现均拒绝合并。
- Verifier 未完成或出现中高严重问题时，任务不得标记完成。
