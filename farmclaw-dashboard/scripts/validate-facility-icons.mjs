import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  EQUIPMENT_ICON_KEYS,
  ASSET_STATUS_ICON_IDS,
  MACHINERY_ICON_IDS,
  assetStatusImageExpression,
  FACILITY_ICON_IDS,
  FACILITY_TYPE_LABELS,
  classifyFacility,
  equipmentIconKey,
  facilityIconDataUri,
  facilityIconSvg,
  registerFacilityIcons
} from '../src/utils/facilityIcons.js'
import { buildOperationsDashboard } from '../src/utils/operationsDashboard.js'

const serverPoi = JSON.parse(await readFile(new URL('../public/static/mock/serverpoi.geojson', import.meta.url), 'utf8'))
const freeMapSource = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const operationsPanelSource = await readFile(new URL('../src/components/OperationsPanel.vue', import.meta.url), 'utf8')
const amapViewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const facilityCounts = serverPoi.features.map((feature) => classifyFacility(feature.properties)).reduce((counts, key) => {
  counts[key] = (counts[key] || 0) + 1
  return counts
}, {})
assert.deepEqual(facilityCounts, { warehouse: 3, service: 2, inspection: 1 })
assert.equal(serverPoi.features.every((feature) => ['warehouse', 'service', 'inspection'].includes(feature.properties.facility_type)), true, '6 个设施点必须使用显式分类')

assert.equal(classifyFacility({ facility_type: 'service', name: '中央仓库' }), 'service', '显式类型必须优先')
assert.equal(classifyFacility({ name: '临时仓库' }), 'warehouse')
assert.equal(classifyFacility({ kind: 'camera', name: '北门' }), 'camera')
assert.equal(classifyFacility({ facility_type: 'future-type', name: '中央仓库' }), 'generic')
assert.equal(classifyFacility({ name: '未知点位' }), 'generic')

const equipment = buildOperationsDashboard().equipment.items
const expectedEquipmentKeys = [
  'water-control', 'water-control', 'climate', 'dosing',
  'aquaculture', 'sensor', 'valve', 'light'
]
assert.deepEqual(equipment.map((item) => equipmentIconKey(item.category, item.name)), expectedEquipmentKeys)
assert.equal(equipmentIconKey('补光灯'), 'light')
assert.equal(equipmentIconKey('环境控制'), 'climate')
assert.equal(equipmentIconKey('未知设施'), 'generic')
assert.equal(EQUIPMENT_ICON_KEYS.灌溉泵, 'water-control')

const keys = Object.keys(FACILITY_ICON_IDS)
assert.deepEqual(keys.sort(), Object.keys(FACILITY_TYPE_LABELS).sort(), '标签和图标 key 必须一致')
for (const key of keys) {
  assert.equal(FACILITY_ICON_IDS[key], `farmclaw-facility-${key}`)
  const svg = facilityIconSvg(key)
  assert.match(svg, /^<svg /)
  assert.match(svg, /viewBox="0 0 48 48"/)
  assert.match(svg, /<circle\s+cx="24"\s+cy="24"\s+r="21"/, '具象图标必须带有统一圆形底色')
  assert.match(svg, /fill="#07151d"/, '圆形底色必须沿用深色体系')
  assert.match(svg, /width="96" height="96"/, '地图资源必须保留 2x 清晰度')
  assert.doesNotMatch(svg, /<(?:script|iframe)|\son\w+\s*=|(?:href|src)\s*=/i)
  assert.ok(facilityIconDataUri(key).startsWith('data:image/svg+xml;charset=utf-8,'))
  assert.equal(decodeURIComponent(facilityIconDataUri(key).split(',')[1]), svg)
}
assert.equal(facilityIconSvg('unknown'), facilityIconSvg('generic'))
assert.equal(new Set(Object.keys(MACHINERY_ICON_IDS).map(facilityIconSvg)).size, 7, '七种农机必须使用不同轮廓')
assert.deepEqual(assetStatusImageExpression('status'), [
  'match', ['get', 'status'], ...Object.entries(ASSET_STATUS_ICON_IDS).flat(), ASSET_STATUS_ICON_IDS.unknown
])

const added = []
const fakeMap = {
  hasImage: () => false,
  loadImage: async (uri) => ({ data: { uri } }),
  addImage: (id, image) => added.push({ id, image })
}
const registered = await registerFacilityIcons(fakeMap)
assert.deepEqual(registered, [...Object.values(FACILITY_ICON_IDS), ...Object.values(ASSET_STATUS_ICON_IDS)])
assert.deepEqual(added.map((item) => item.id), registered)
fakeMap.hasImage = (id) => added.some((item) => item.id === id)
assert.deepEqual(await registerFacilityIcons(fakeMap), [], '重复注册不得覆写已解码资源')
for (const { id, image } of added.filter((item) => item.id.startsWith('farmclaw-asset-'))) {
  const svg = decodeURIComponent(image.uri.split(',')[1])
  assert.doesNotMatch(svg, /<circle/, `${id} 的状态和选中反馈不得盖住具象图标`)
  assert.doesNotMatch(svg, /<(?:script|iframe)|\son\w+\s*=|(?:href|src)\s*=/i)
}

for (const expectedImplementation of [
  "serverLayer: ['farmclaw-server-icon', 'farmclaw-server-label']",
  "cameraLayer: ['farmclaw-camera-cone', 'farmclaw-camera-status', 'farmclaw-camera-icon'",
  "id: 'farmclaw-server-icon'",
  "id: 'farmclaw-camera-icon'",
  'await registerFacilityIcons(map)',
  "startsWith('farmclaw-facility-')",
  "'farmclaw-camera-status', 'farmclaw-camera-icon'",
  "'farmclaw-server-icon', 'farmclaw-server-label'"
]) {
  assert.equal(freeMapSource.includes(expectedImplementation), true, `缺少 MapLibre 设施图标接线：${expectedImplementation}`)
}
assert.equal(operationsPanelSource.includes('facilityIconDataUri(equipmentIconKey(item.category, item.name))'), true, '设备目录必须按类别和具体设备显示图标')
assert.equal(operationsPanelSource.includes("['equipment-row', item.status]"), true, '设备状态语义必须继续独立保留')
assert.equal(amapViewSource.includes('facilityIconDataUri(classifyFacility(feat.properties))'), true, 'AMap 服务设施必须复用设施图标分类')

console.log('Facility icon validation passed: 6 facility points, 8 equipment mappings, safe inline SVG registry verified')
