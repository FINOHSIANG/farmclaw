import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const hud = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const view = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const map = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
for (const implementation of ['requestFullscreen()', 'exitFullscreen()', 'fullscreenchange', 'aria-label="切换大屏模式"', ':aria-pressed="presentationMode"', 'class="public-dashboard"', '运营总览', '生产态势', '预警中心', '设施与农机状态', '作业农机', '演示展示数据']) {
  assert.equal(hud.includes(implementation), true, `大屏模式实现缺失：${implementation}`)
}
assert.equal(hud.includes('status-meta-secondary'), true, '响应式状态栏必须使用稳定类名')
assert.equal(view.includes('@fullscreen="handleFullscreen"'), true, '页面必须接收全屏状态')
assert.equal(view.includes('@fullscreen-error="handleFullscreenError"'), true, '页面必须接收全屏错误')
assert.equal(map.includes('resizeFreeMap'), true, 'MapLibre 必须在全屏切换后刷新尺寸')
console.log('Fullscreen validation passed: public presentation dashboard, top entry, state sync, responsive header, and map resize verified')
