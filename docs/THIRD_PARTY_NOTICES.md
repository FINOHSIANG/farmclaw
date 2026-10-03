# 第三方来源说明

更新日期：2026-09-30

## VoltGUI

- 来源：https://github.com/zuohuadong/volt-gui
- 参考分支：`dev`
- 固定提交：`427e7130269f320f85b4fbd3708fb48970c07648`
- 引入范围：Electron 薄壳、官方 DSH 子进程、loopback token/Cookie 认证、RPC/event 桥接、sandbox/contextIsolation 与窄 preload API 的架构实现方式。
- 本项目改动：保留 Farmclaw 现有 Vue、MapLibre/AMap/Three.js、HUD 和交互；仅以独立 `desktop-shell/` 替换 Agent/会话控制面，并保留 Python 网关作为农业遥测适配层和浏览器回退路径。
- 许可：MIT License。VoltGUI 的版权与完整许可文本以其固定提交仓库中的 `LICENSE` 为准。

## DeepSeek Harness (`@deepseek-ai/dsh`)

- 包：`@deepseek-ai/dsh` 0.1.5-rc.3
- 来源：https://github.com/deepseek-ai/deepseek-harness
- 用途：本地 Agent、会话、工具、权限、凭据与持久化运行时。
- 许可：MIT License。运行时依赖及其传递依赖的具体版权与许可信息以锁文件和各包随附 LICENSE 为准。

## gyrate/digitalFarm

- 来源：https://github.com/gyrate/digitalFarm
- 固定版本：`c8f47dcbd516551d87b7067664af31ba6fed2742`
- 引入范围：Vue 数字农场场景、地图/Three.js 图层实现、GeoJSON、3D Tiles、模型、纹理、图标和已编译 `gl-layers` 运行库。
- 本项目改动：移除源码中的高德地图 Key 硬编码，改为环境变量；增加 Farmclaw WebSocket 桥接、实时遥测、节点状态、事件流、AI 指令和地图配置降级提示；升级前端构建工具链。
- 许可状态：截至 2026-08-25，上游仓库未声明许可证。公开分发、商业使用或再许可前必须取得权利人的明确授权。

## gl-layers

`digitalFarm` 的 `.gitmodules` 指向不可公开访问的内网仓库；本项目仅使用上游仓库中已经提交的
`submodule/gl-layers/lib/index.mjs` 与 `index.umd.js` 编译产物。其许可同样未明确，需与上游授权一起确认。

## OpenFreeMap / MapLibre / OpenStreetMap

- OpenFreeMap：https://openfreemap.org/；默认使用其公开 Positron style，无需 API Key。
- MapLibre GL JS：https://maplibre.org/maplibre-gl-js/docs/；BSD-3-Clause。
- 地图数据与样式来源包含 OpenStreetMap、OpenMapTiles 和 OpenFreeMap；运行界面保留地图 attribution。
- OpenFreeMap 公共服务不代表项目获得生产 SLA；高流量或强可用性场景建议自托管兼容 style/tiles。

## Esri World Imagery

- 卫星影像切换使用 Esri World Imagery 公共瓦片服务，无需在前端配置 API Key。
- 运行界面保留 `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community` 署名。
- 公共影像服务不代表生产 SLA，也不等同于开源数据；正式商用或高流量部署前需复核 Esri 最新使用条款并评估自有影像服务。

## Tabler Icons

- 来源仓库：https://github.com/tabler/tabler-icons
- 固定版本：`5a0fe38e97784d94279ce4eb1bf85f9a91bf027e`
- 引入范围：`farmclaw-dashboard/src/utils/tablerIcons.js` 中的轮廓 SVG 路径，覆盖地图定位、卫星、无人机、预警、摄像头、设施、农机、附件和大屏控制等图标。
- 具体源文件：`icons/outline/camera.svg`、`building-warehouse.svg`、`building-community.svg`、`flask.svg`、`box.svg`、`droplet.svg`、`droplets.svg`、`wind.svg`、`test-pipe.svg`、`fish.svg`、`antenna.svg`、`tractor.svg`、`forklift.svg`、`spray.svg`、`seedling.svg`、`car.svg`、`lawn-mower.svg`、`truck.svg`、`map-pin.svg`、`satellite.svg`、`drone.svg`、`maximize.svg`、`x.svg`、`chevron-*.svg`、`alert-*.svg`、`paperclip.svg`、`file.svg`、`send.svg`、`settings.svg`、`circle-check.svg`、`shield-check.svg`、`plus.svg`、`minus.svg`、`temperature.svg`、`battery.svg`、`activity.svg`、`clock.svg`。
- 许可：MIT License（Copyright (c) 2020-2026 Paweł Kuna）。本项目将版权与许可文本随本说明保留，并在运行时使用本地副本，不依赖第三方 CDN。

### Tabler Icons MIT License

```text
MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
