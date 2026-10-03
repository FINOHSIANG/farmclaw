# TASK-0001 digitalFarm 基座融合

创建日期：2026-08-25
状态：已完成

## 目标

- 以 `gyrate/digitalFarm` 的 Vue/AMap/Loca/Three.js 场景作为 Farmclaw 前端视觉基座。
- 保留现有 Python 网关、节点、RPC 与遥测协议，并把实时状态接入数字孪生控制面。
- 本地可安装、可构建；无地图 Key 时提供可理解的降级界面。

## 非目标

- 本阶段不新增生产数据库、账号权限、远程设备写控制或生产部署。
- 不对上游全部单体地图代码做彻底模块化重构。
- 不替代现有 Farmclaw 后端协议。

## 范围

- `farmclaw-dashboard/` 前端框架与数字孪生资产。
- WebSocket 观察者桥接、节点拓扑、遥测、事件流和 AI 指令入口。
- 启动说明、来源说明、配置模板和验证。

## 依赖

- `gyrate/digitalFarm@c8f47dcbd516551d87b7067664af31ba6fed2742`
- 高德地图 Web JS API、Loca、Three.js、上游 `gl-layers` 编译产物。
- Farmclaw WebSocket 网关 `ws://127.0.0.1:18789`。

## 相关 Skill 和项目规则

- `development-project-workflow`
- 根目录 `AGENTS.md`（全局排除规则优先，因此不使用 agmesh）。
- 修改后执行当前 diff 棁查并安排独立 verifier。

## 实施计划

1. 固定上游版本并记录许可/依赖风险。
2. 将 dashboard 切换为 Vue 数字孪生基座，迁移必要场景资产。
3. 增加 Farmclaw WebSocket bridge 与 HUD 控制面。
4. 移除硬编码 Key，补充 `.env.example` 与降级提示。
5. 运行 Python 测试、前端构建和独立审查。

## 验证计划

- `python tests/test_flow.py`
- `npm run build`（`farmclaw-dashboard/`）
- 检查产物不包含原上游高德 Key。
- 独立 verifier 检查协议映射、运行风险和 diff。

## 回滚方案

- 通过 Git 恢复 `farmclaw-dashboard/` 原 Svelte 文件及依赖。
- Python 后端未改变，可独立回滚前端而不影响网关和节点。

## 证据

- 用户要求：https://github.com/gyrate/digitalFarm 作为本项目基座进行融合修改。
- 上游提交：`c8f47dcbd516551d87b7067664af31ba6fed2742`。
- 独立 verifier：PASS；确认构建、离线测试、桥接协议、密钥扫描和 diff 检查均无阻断问题。

## 开放问题

- 上游未声明许可证；公开分发或商业使用前需取得授权。
- 生产高德地图 Key、域名白名单和安全代理策略待部署阶段确定。
