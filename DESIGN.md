---
name: Farmclaw Operations Console
description: 精密、可靠、克制的数字农场运营控制台
colors:
  operations-canvas: "#07151D"
  command-surface: "#0D212B"
  raised-surface: "#12303B"
  precision-cyan: "#48E4D1"
  data-white: "#E7F4F3"
  muted-slate: "#91A9AD"
  structural-line: "#31535B"
  caution-amber: "#F0B95A"
  critical-coral: "#FF6577"
  success-green: "#74D99F"
typography:
  headline:
    fontFamily: "Inter, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.2
  title:
    fontFamily: "Inter, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Inter, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  control: "4px"
  surface: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.precision-cyan}"
    textColor: "{colors.operations-canvas}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  panel:
    backgroundColor: "{colors.command-surface}"
    textColor: "{colors.data-white}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: Farmclaw Operations Console

## Overview

**Creative North Star: "Precision Field Station"**

这是一个在昏暗值守室中持续运行的专业农业工作站。界面以深色工业表面承载地图与实时状态，精密青只出现在当前选择、主操作和在线状态；未来感来自对齐、数据节奏、结构线与快速反馈。

系统拒绝廉价霓虹、电竞大屏和玻璃面板堆叠。桌面端保持高信息密度并保护地图视野，移动端把导航变成单行工具带，让当前任务始终可滚动、可触达。

**Key Characteristics:**

- 克制的深色工业表面
- 精密青单一主强调
- 等宽字体只用于编号、时间和数据
- 语义状态具有文字与形状双重表达
- 平面分层与清晰结构线

## Colors

主色板以冷黑蓝为工作台，精密青承担操作焦点，琥珀与珊瑚只表达需要注意或风险。

### Primary

- **Precision Cyan**：用于当前专题、主按钮、在线状态与键盘焦点，任何屏幕中不超过约 10%。

### Secondary

- **Caution Amber**：用于待审批、数据过期和维护状态。
- **Critical Coral**：仅用于告警、拒绝和紧急停止。
- **Success Green**：用于明确成功和安全在线状态。

### Neutral

- **Operations Canvas**：页面与地图遮罩基底。
- **Command Surface**：主控制面和工具栏。
- **Raised Surface**：悬停、选中与局部强调表面。
- **Data White / Muted Slate / Structural Line**：正文、次级信息和结构分隔。

**The Signal Discipline Rule.** 精密青只表示当前和可操作，绝不作为大面积装饰背景。

## Typography

**Display Font:** Inter（Segoe UI 与系统无衬线回退）
**Body Font:** Inter（Microsoft YaHei 与系统无衬线回退）
**Label/Mono Font:** JetBrains Mono（Cascadia Mono 与 Consolas 回退）

**Character:** 正文清晰安静，数据与系统标签精密但不过度终端化。

### Hierarchy

- **Headline**（650，24px，1.2）：页面品牌与关键专题标题。
- **Title**（650，16px，1.3）：面板标题和任务标题。
- **Body**（400，13px，1.5）：解释、事件与建议，长文本不超过 70ch。
- **Label**（700，10px，0.12em）：系统编号、时间、模式与分区标签。

**The Readability Floor Rule.** 关键正文不得小于 12px；9px 只允许用于非关键技术标记，并应逐步淘汰。

## Elevation

系统采用平面分层：不使用装饰性玻璃模糊；深度由表面明度、1px 结构线与少量远距离环境阴影建立。悬停时只改变表面和边框，不移动布局。

**The Flat-by-Default Rule.** 阴影只区分地图与控制面，不用于每张任务或每个统计项。

## Components

### Buttons

- **Shape:** 小幅精密圆角（4px）。
- **Primary:** 精密青底、深色文字、9px 14px 内边距。
- **Hover / Focus:** 表面提亮；键盘焦点使用 2px 外环。
- **Secondary / Ghost:** 透明或 Raised Surface，使用结构线边框。

### Chips

- **Style:** 单行紧凑，使用文字和色点共同表达状态。
- **State:** 当前项使用精密青填充，风险项使用低透明度语义底色。

### Cards / Containers

- **Corner Style:** 控制面 6px，数据行 4px。
- **Background:** Command Surface；列表行只在悬停或选中时使用 Raised Surface。
- **Shadow Strategy:** 控制面整体可使用一层环境阴影，内部禁止重复阴影。
- **Border:** 1px Structural Line。
- **Internal Padding:** 12px 到 20px，按信息层级变化。

### Inputs / Fields

- **Style:** 深色平面输入，1px 结构线，4px 圆角。
- **Focus:** 精密青边框和 2px 低透明外环。
- **Error / Disabled:** 使用文字、图标和语义颜色共同说明。

### Navigation

桌面使用水平任务工具带，当前专题为实色；移动端保持单行横向滚动，不允许按钮竖排占据地图。

### Operations Panel

面板标题、摘要、操作区和可滚动内容区必须分层明确。危险动作与主动作分离，目标田块和风险必须在审批前可见。

## Do's and Don'ts

### Do:

- **Do** 使用 1px 结构线、表面明度和间距建立层级。
- **Do** 让地图占据主要视觉面积，并确保面板不覆盖底部操作带。
- **Do** 为告警、审批、在线和模拟状态同时提供文字与颜色。
- **Do** 使用 150ms 到 220ms 的状态过渡，并尊重 reduced-motion。

### Don't:

- **Don't** 使用廉价霓虹与电竞大屏风格。
- **Don't** 使用大量玻璃面板、无意义辉光和同质卡片堆叠。
- **Don't** 使用大于 1px 的彩色侧边条强调卡片。
- **Don't** 让状态只依赖颜色、让文字过小或让地图被控制面遮住。
- **Don't** 把演示、建议或网关提交描述为真实设备已经执行。
