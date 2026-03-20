# Farmclaw 分布式农业控制系统

Farmclaw 是一个为现代农业场景打造的智能、分布式的控制和调度系统。通过微服务架构和基于 WebSocket 的中央网关，Farmclaw 将传感器、气象服务、AI认知大脑与展示大屏无缝连接起来，帮助农民轻松、高效地管理农场。

## 📌 架构概览

Farmclaw 采用解耦的分布式架构，分为以下几个核心组件：

- **Gateway (网关)**：系统的中央消息总线 (`gateway/server.py`)，基于 WebSocket 运行。负责连接所有节点、路由 RPC 执行请求与响应、并向观察者广播实时状态。
- **Core (认知大脑)**：系统的 AI 控制中枢 (`core/pi_agent.py`，`agent.py`)。负责理解用户输入的自然语言，自主决定调用何种设备或服务（技能），并将结果整合返回。
- **Nodes (边缘节点)**：执行具体任务的工作单元（如 `iot_node`, `weather_node`），在启动时向网关注册自己提供的能力 (Skills)。
- **Channels/UI (用户终端)**：允许用户通过 CLI (`cli_client.py`) 或简单文本界面与系统进行交互。
- **Dashboard (监控大屏)**：基于 Svelte 框架构建的 Web 大屏应用 (`farmclaw-dashboard/`)，实时订阅网关系统事件（拓扑结构、节点上下线、RPC 调用等）并呈现可视化状态。

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装：

- **Python 3.8+** (后端依赖，执行 `pip install websockets aioconsole` 以确保依赖就绪)
- **Node.js 16+** (运行前端 Dashboard 时需要)

### 2. 启动服务

项目提供了一个便捷的自动化启动脚本。在根目录下运行以下 PowerShell 脚本会依次在后台启动网关、各类传感器边缘节点以及 Pi 认知大脑：

```powershell
.\start_all.ps1
```

### 3. 启动前端 Dashboard (大屏面板)

另起一个终端，进入前端项目并启动开发服务器：

```bash
cd farmclaw-dashboard
npm install
npm run dev
```

之后在浏览器中打开 `http://localhost:5173` 查看全数字化的农业控制面。

### 4. 数据运行模拟 (可选)

由于部分农业硬件是基于真实场景的，我们可以用系统自带的模拟脚本为系统注入数据和模拟聊天请求，以便观察控制台或大屏的联动效果：

```bash
python simulate.py
```

## 🛠 开发与扩展

Farmclaw 被设计成一个容易扩展的微服务结构：

- **添加新节点 (Nodes)**：您可以继承 `nodes/base_node.py` 将更多硬件如水泵控制、农业无人机接入平台。
- **增强 AI 能力**：修改 `core/pi_agent.py` 等大脑组件接入更先进的 LLM 服务。

## 📜 许可证

MIT License.
