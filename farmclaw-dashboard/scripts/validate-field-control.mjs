import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { applyFieldControlAction, buildFieldControlModel } from '../src/utils/fieldControl.js'
import { buildFieldInteriorTwin } from '../src/utils/fieldInteriorTwin.js'

const field = { id: 'FIELD-007', key: 'farm:FIELD-007', name: '种植地块 007', status: '生产利用', tone: 'neutral', sourceLabel: '演示空间底图' }
const model = buildFieldControlModel(field, {
  readings: {
    soil_moisture: { label: '土壤水分', value: 36, unit: '%' },
    temperature: { label: '环境温度', value: 25, unit: '℃' },
    humidity: { label: '空气湿度', value: 72, unit: '%' },
    light: { label: '光照强度', value: 12000, unit: 'lux' }
  },
  machinery: [{ id: 'M-01', name: '巡检车', status: 'standby', statusLabel: '待机', energyKind: 'fuel', fuel: 78 }]
})

assert.equal(model.id, 'FIELD-007')
assert.equal(model.metrics.length, 4)
assert.equal(model.controls.length, 4)
assert.equal(model.controls[0].stateLabel, '建议补水')
assert.equal(model.availableMachinery.length, 1)
assert.equal(model.availableMachinery[0].energyLabel, '油量 78%')
assert.equal(model.fieldTwin.sensorCount, 4)

const internalTwin = buildFieldInteriorTwin({
  id: 'FIELD-007',
  properties: { twin_id: 'FIELD-007' },
  geometry: { type: 'Polygon', coordinates: [[[113.53, 22.73], [113.532, 22.731], [113.5316, 22.732], [113.5296, 22.731], [113.53, 22.73]]] }
})
assert.equal(internalTwin.summary.zoneCount, 3)
assert.equal(internalTwin.summary.sensorCount, 4)
assert.equal(internalTwin.summary.valveCount, 2)
assert.equal(internalTwin.geojson.features.some((feature) => feature.properties.kind === 'crop-row'), true)
assert.equal(internalTwin.geojson.features.some((feature) => feature.properties.kind === 'irrigation-main'), true)

const started = applyFieldControlAction(model.controls, 'irrigation')
assert.equal(started.outcome.active, true)
assert.equal(started.controls[0].state, 'running')
const stopped = applyFieldControlAction(started.controls, 'irrigation')
assert.equal(stopped.outcome.active, false)
assert.equal(stopped.controls[0].state, 'standby')

const [mapSource, viewSource, hudSource, panelSource] = await Promise.all([
  readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/FieldControlPanel.vue', import.meta.url), 'utf8')
])

for (const token of ['export function focusField', 'focusedFieldId', 'focusFieldCamera(feature, 0)', "selectedMapFeatureKind === 'field'", 'fieldSelectionHandler?.(selected)', "feature.source === 'farm'", "map.addSource('field-internal'", 'showFieldInterior(feature)', "setLogicalVisibility('fieldInternalLayer', false)"]) {
  assert.equal(mapSource.includes(token), true, `地图地块内控链路缺失：${token}`)
}
for (const token of ['onFieldSelect(receiveFieldSelection)', ':field-control="fieldControl"', '@field-control-exit="exitFieldControl"', 'FIELD.CONTROL.DRY_RUN']) {
  assert.equal(viewSource.includes(token), true, `工作台地块状态链路缺失：${token}`)
}
assert.equal(hudSource.includes('<FieldControlPanel v-if="fieldControl"'), true, 'HUD 未切换到地块内控面板')
for (const token of ['返回全场', '控制状态', 'LOCAL DRY RUN', 'INTERNAL DIGITAL TWIN', '地块内部孪生', '不代表现场设备已执行']) {
  assert.equal(panelSource.includes(token), true, `地块内控安全边界缺失：${token}`)
}

console.log('Field control PASS: plot focus, isolated map state, local Dry Run controls and overview exit verified')
