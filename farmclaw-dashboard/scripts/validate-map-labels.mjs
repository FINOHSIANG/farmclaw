import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildBusinessLabelData, securityStatusLabel } from '../src/utils/mapLabels.js'
import { buildValueForecastModel } from '../src/utils/valueForecast.js'

async function load(name) {
  return JSON.parse(await readFile(new URL(`../public/static/mock/${name}`, import.meta.url), 'utf8'))
}

const [productionData, cropData, aquacultureData, farmAreaData, poolAreaData] = await Promise.all([
  load('productation.geojson'),
  load('crop.geojson'),
  load('poolCenter.geojson'),
  load('farm.geojson'),
  load('pool.geojson')
])
const freeMapSource = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const hudSource = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const viewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')

const valueForecastModel = buildValueForecastModel(
  productionData,
  cropData,
  aquacultureData,
  farmAreaData,
  poolAreaData
)
const labels = buildBusinessLabelData({ cropData, aquacultureData, valueForecastModel })
const productLabels = labels.features.filter((feature) => feature.properties.scope === 'product')
const valueLabels = labels.features.filter((feature) => feature.properties.scope === 'value')

assert.equal(labels.type, 'FeatureCollection')
assert.equal(productLabels.filter((feature) => feature.properties.industry === 'crop').length, 5)
assert.equal(productLabels.filter((feature) => feature.properties.industry === 'aquaculture').length, 5)
assert.equal(productLabels.length, 10)
assert.equal(valueLabels.length, 11)
assert.equal(valueLabels.reduce((sum, feature) => sum + feature.properties.count, 0), 158)
assert.equal(productLabels.every((feature) => feature.properties.category.trim()), true)
assert.equal(labels.features.every((feature) => {
  const [longitude, latitude] = feature.geometry.coordinates
  return feature.geometry.type === 'Point'
    && Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90
}), true)
assert.equal(labels.features.every((feature) => (
  feature.properties.title
  && feature.properties.detail
  && feature.properties.industry
  && feature.properties.industryLabel
  && feature.properties.category
  && Number.isInteger(feature.properties.count)
  && Number.isFinite(feature.properties.priority)
  && Object.hasOwn(feature.properties, 'average')
)), true)
assert.equal(hudSource.includes('eventsCollapsed'), true, '系统事件必须支持收起状态')
assert.equal(hudSource.includes(":aria-expanded=\"(!eventsCollapsed).toString()\""), true, '系统事件收起按钮必须提供展开状态语义')
assert.equal(hudSource.includes("aria-label=\"系统事件\""), true, '系统事件面板必须有可访问名称')

assert.deepEqual(Object.fromEntries(
  ['alarm', 'online', 'offline', 'maintenance', 'armed', 'disarmed']
    .map((status) => [status, securityStatusLabel(status)])
), {
  alarm: '告警',
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
  armed: '已布防',
  disarmed: '已撤防'
})
assert.equal(securityStatusLabel('unknown-status'), '未知')

for (const expectedImplementation of [
  "id: 'farmclaw-field-label-compact'",
  "id: 'farmclaw-field-label-detail'",
  "id: 'farmclaw-value-label-compact'",
  "id: 'farmclaw-value-label-detail'",
  "id: 'farmclaw-camera-label-compact'",
  "id: 'farmclaw-camera-label-detail'",
  "map.addSource('map-selection'",
  "'farmclaw-value-label-anchor', 'farmclaw-value-label-compact', 'farmclaw-value-label-detail'"
]) {
  assert.equal(freeMapSource.includes(expectedImplementation), true, `缺少地图标注实现：${expectedImplementation}`)
}

assert.equal(freeMapSource.includes('const foregroundGeometryLayers = geometryLayers.filter((layer) => statusLayerIds.has(layer.id))'), true, '业务点位与状态图层必须按明确清单提升到道路符号层上方')
assert.equal(freeMapSource.includes('for (const layer of foregroundGeometryLayers) map.addLayer(layer)'), true, '业务前景图层必须绘制在底图道路之上')
assert.equal((viewSource.match(/zIndex: 320/g) || []).length >= 2, true, '高德地图设施和作物图标必须高于道路底图')

console.log(`Map labels PASS: product ${productLabels.length} (crop 5 / aquaculture 5), value ${valueLabels.length} / 158 points, security statuses 6, road-safe foreground order, compact/detail tiers and selection rings`)
