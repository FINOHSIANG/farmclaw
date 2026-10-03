import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const map = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const hud = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const view = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
const theme = await readFile(new URL('../src/style/theme.css', import.meta.url), 'utf8')
for (const implementation of ['satelliteLayer', 'farmclaw-satellite', 'World_Imagery', 'setFreeSatelliteVisible', 'getFreeSatelliteVisible', 'firstNonBackgroundLayerId']) {
  assert.equal(map.includes(implementation), true, `地图控制能力缺失：${implementation}`)
}
assert.equal(hud.includes('aria-label="切换卫星图"'), true, 'HUD 必须提供卫星图按钮')
assert.equal(hud.includes('satellite-toggle'), true, '移动端地图工具必须保留卫星图按钮')
assert.equal(view.includes("action === 'satellite'"), true, '页面必须处理卫星图切换')
assert.equal(map.includes('卫星图'), false, '地图模块不应耦合 UI 文案')
assert.equal(main.indexOf("maplibre-gl/dist/maplibre-gl.css") < main.indexOf("@/style/theme.css"), true, '主题覆盖样式必须晚于 MapLibre 基础样式加载')
assert.equal(theme.includes('min-height:40px'), true, '移动端地图归属信息入口必须保留 40px 触控区域')
console.log('Map controls validation passed: satellite raster source, visibility state, and HUD wiring verified')
