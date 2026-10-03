import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildAlertCenterModel } from '../src/utils/alertCenter.js'

const source = await readFile(new URL('../src/components/AlertCenterPanel.vue', import.meta.url), 'utf8')
const hud = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const map = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const view = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
for (const label of ['预警中心', '气候预警', '虫害预警', '演示预警 · 尚未接入实时气象预报与病虫害识别服务']) {
  assert.equal(source.includes(label), true, `预警中心缺少：${label}`)
}
assert.equal(hud.includes("activeTopic === 'alerts'"), true, 'HUD 必须接入 alerts 专题')
assert.equal(map.includes('alerts:'), true, '地图必须接入 alerts 专题图层')
for (const implementation of ['climateRiskLayer', 'pestRiskLayer', 'farmclaw-climate-risk', 'farmclaw-pest-risk', 'setFreeAlertType']) {
  assert.equal(map.includes(implementation), true, `地图缺少预警风险图层能力：${implementation}`)
}
assert.equal(source.includes("defineEmits(['filter'])"), true, '预警筛选必须向地图发出事件')
assert.equal(view.includes('@alert-filter="handleAlertFilter"'), true, '页面必须接收预警筛选事件')
for (const implementation of [
  'onMounted(syncFilter)',
  'watch(() => props.model.activeField, syncFilter)',
  "emit('filter', { type: activeType.value, activeField: props.model.activeField })"
]) {
  assert.equal(source.includes(implementation), true, `预警面板缺少筛选同步：${implementation}`)
}
for (const implementation of [
  'export function buildAlertLayerFilter',
  "['get', 'field_id']",
  "buildAlertLayerFilter('climate', currentAlertField)",
  "buildAlertLayerFilter('pest', currentAlertField)",
  "buildAlertLayerFilter('all', currentAlertField)",
  'map.setFilter(layerId, buildAlertLayerFilter(layerType, currentAlertField))',
  "const showClimate = currentAlertType === 'climate'",
  "const showPest = currentAlertType === 'pest'",
  "const showEvents = currentAlertType === 'all'"
]) {
  assert.equal(map.includes(implementation), true, `预警地图缺少范围或图层语义：${implementation}`)
}
assert.equal(view.includes('setFreeAlertType(type, activeField)'), true, '页面必须把当前田块传给预警地图')
assert.equal(view.includes("if (topic === 'alerts') freeMapAdapter?.setFreeAlertType('all', farmclaw.state.activeField)"), true, '重新进入预警专题必须重置地图筛选')
for (const field of ['greenhouse-1', 'field-a', 'orchard-b']) {
  const model = buildAlertCenterModel({ activeField: field })
  assert.ok(model.counts.climate > 0)
  assert.ok(model.counts.pest > 0)
  assert.ok(model.alerts.every((item) => item.source === 'demo-baseline'))
}
console.log('Alert center validation passed: climate and pest warnings, demo boundary, topic wiring verified')
