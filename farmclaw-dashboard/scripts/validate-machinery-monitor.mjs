import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  MACHINERY_BASELINE_IDS,
  MACHINERY_FRESHNESS_LABELS,
  MACHINERY_STATUS_LABELS,
  buildMachineryGeoJson,
  buildMachineryMonitor,
  filterMachinery,
  getMachineryById
} from '../src/utils/machineryMonitor.js'

const panelSource = await readFile(new URL('../src/components/OperationsPanel.vue', import.meta.url), 'utf8')
const hudSource = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const viewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const mapSource = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const packageSource = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

const model = buildMachineryMonitor()
assert.equal(model.total, 7, '演示农机应保持 7 台，便于汇报口径稳定')
assert.equal(new Set(model.items.map((item) => item.id)).size, model.total, '农机 ID 必须唯一')
assert.deepEqual(MACHINERY_BASELINE_IDS, model.items.map((item) => item.id))
assert.deepEqual(model.counts, { running: 3, standby: 1, charging: 1, warning: 1, offline: 1 })
assert.equal(model.activeTasks, 3)
assert.equal(model.warningCount, 2, '异常关注应包含异常与离线')
assert.deepEqual(model.freshnessCounts, { live: 0, stale: 0, simulated: 7, unknown: 0 })
assert.ok(model.coverageArea > 0)
assert.ok(model.runtimeToday > 0)
assert.ok(model.averageEnergy >= 0 && model.averageEnergy <= 100)

for (const item of model.items) {
  assert.ok(MACHINERY_STATUS_LABELS[item.status])
  assert.ok(MACHINERY_FRESHNESS_LABELS[item.freshness])
  assert.ok(Array.isArray(item.coordinates) && item.coordinates.length === 2)
  assert.ok(item.coordinates[0] >= -180 && item.coordinates[0] <= 180)
  assert.ok(item.coordinates[1] >= -90 && item.coordinates[1] <= 90)
  assert.ok(item.progress >= 0 && item.progress <= 100)
  assert.ok(item.speed >= 0 && item.speed <= 80)
  const energy = item.energyKind === 'battery' ? item.battery : item.fuel
  assert.ok(energy >= 0 && energy <= 100)
}

const observed = buildMachineryMonitor({
  referenceTime: '2026-09-02T14:35:00+08:00',
  observations: [
    { id: 'tractor-east-01', source: 'gateway-observation', observedAt: '2026-09-02T14:32:00+08:00', status: 'running', speed: 5.1 },
    { id: 'mower-orchard-01', source: 'gateway-observation', observedAt: '2026-09-02T13:00:00+08:00', status: 'offline' }
  ]
})
assert.equal(observed.freshnessCounts.live, 1)
assert.equal(observed.freshnessCounts.stale, 1)
assert.equal(getMachineryById('MACH-001', observed)?.id, 'tractor-east-01')
assert.equal(filterMachinery(observed, { status: 'running' }).length, 3)
assert.equal(filterMachinery(observed, { query: 'MACH-003' })[0].id, 'sprayer-west-02')

const withMissingCoordinates = buildMachineryGeoJson({ items: [{ ...model.items[0], coordinates: null }, model.items[1]] })
assert.equal(withMissingCoordinates.features.length, 1, '无坐标农机不得进入地图图层')
assert.equal(withMissingCoordinates.features[0].properties.kind, 'machinery')
assert.equal(withMissingCoordinates.features[0].properties.machinery_status, model.items[1].status)
assert.equal(withMissingCoordinates.features[0].properties.energy_label.includes('%'), true)
assert.equal(withMissingCoordinates.features[0].properties.heading_deg, model.items[1].headingDeg)
assert.equal(withMissingCoordinates.features[0].properties.machine_id, model.items[1].id)
assert.equal(withMissingCoordinates.features[0].properties.coordinate_system, 'WGS84')
assert.equal(withMissingCoordinates.features[0].properties.speed_kph, model.items[1].speedKph)
assert.equal(buildMachineryGeoJson({ items: [{ ...model.items[0], coordinates: [181, 22] }] }).features.length, 0, '越界坐标不得进入地图图层')

for (const implementation of [
  "<button type=\"button\" :aria-pressed=\"activeView === 'machinery'\"",
  'data-machinery-id',
  '点击联动地图',
  'selected-machinery',
  'focus-machinery',
  'machinery-filter',
  "map.addSource('machinery'",
  'setMachineryData',
  'setMachineryFilter',
  'onMachinerySelect',
  'focusMachinery',
  'MACHINERY.MAP_UNAVAILABLE',
  "properties.kind === 'machinery'",
  'farmclaw-machinery-status'
]) {
  assert.equal(`${panelSource}\n${hudSource}\n${viewSource}\n${mapSource}`.includes(implementation), true, `农机监测接线缺失：${implementation}`)
}
assert.equal(packageSource.scripts['test:machinery'], 'node scripts/validate-machinery-monitor.mjs')

console.log(`machinery monitor validation passed: ${model.total} machines, ${Object.values(model.counts).join('/')} status counts, GeoJSON and map/HUD wiring verified`)
