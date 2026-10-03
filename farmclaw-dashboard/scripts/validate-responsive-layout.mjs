import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getViewportPadding } from '../src/utils/mapViewport.js'

const hud = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const theme = await readFile(new URL('../src/style/theme.css', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../src/style/workspace.css', import.meta.url), 'utf8')

for (const marker of [
  '--public-gutter: clamp',
  '--public-side: clamp(320px',
  'grid-template-areas: "kpis alerts" "production equipment" "footer footer"',
  'grid-template-areas:"kpis map alerts" "production map equipment"',
  'class="public-map-telemetry"',
  'class="public-map-event"',
  'class="public-link-stats"',
  'class="public-check-grid"',
  'class="public-resource-grid"',
  'class="public-production-meta"',
  'class="public-risk-breakdown"',
  'class="public-machinery-stats"',
  'class="risk-total"',
  '@media (max-height: 720px) and (min-width: 901px)',
  '@media (max-width: 900px)',
  'topic-scroll-hint'
]) {
  assert.equal(hud.includes(marker), true, `大屏自适应实现缺失：${marker}`)
}
assert.equal(theme.includes('100dvh'), true, '页面高度应优先使用动态视口单位')
assert.equal(workspace.includes('@media (max-height:820px) and (min-width:1181px)'), true, '1366x768 大屏应具备独立的紧凑高度规则')
assert.equal(workspace.includes('.public-resource-grid { grid-template-columns:repeat(4'), true, '紧凑高度下资源指标应改为四列展示')

for (const [width, height] of [[2560, 1440], [1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [900, 600], [390, 844]]) {
  const padding = getViewportPadding({ width, height, presentation: true })
  assert.ok(padding.left >= 0 && padding.right >= 0 && padding.top >= 0 && padding.bottom >= 0)
  assert.ok(padding.left + padding.right < width, `${width}x${height} 大屏地图左右边距不能挤满画布`)
  assert.ok(padding.top + padding.bottom < height, `${width}x${height} 大屏地图上下边距不能挤满画布`)
}

const tablet = getViewportPadding({ width: 1024, height: 768, presentation: true })
assert.equal(tablet.left, tablet.right, '双列平板大屏应保持左右对称地图边距')
const wide = getViewportPadding({ width: 1920, height: 1080, presentation: true })
assert.ok(wide.left > tablet.left, '宽屏展示应为两侧面板预留更大的地图安全区')

console.log('Responsive layout validation passed: fluid public grid, compact-height mode, tablet two-column mode, mobile continuation, and presentation map padding verified')
