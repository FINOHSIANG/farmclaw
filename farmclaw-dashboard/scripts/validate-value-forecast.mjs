import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildValueForecastModel, filterValueForecastFeatures } from '../src/utils/valueForecast.js'

const panelSource = await readFile(new URL('../src/components/ValueForecastPanel.vue', import.meta.url), 'utf8')
assert.equal(panelSource.includes('.value-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; display:block;'), true, '移动端产值面板必须由外层单一滚动容器承载品类列表')
assert.equal(panelSource.includes('.category-list { max-height:none; overflow:visible; }'), true, '移动端品类列表不得被 flex 压缩为 0 高度')

async function load(name) {
  return JSON.parse(await readFile(new URL(`../public/static/mock/${name}`, import.meta.url), 'utf8'))
}

const model = buildValueForecastModel(
  await load('productation.geojson'),
  await load('crop.geojson'),
  await load('poolCenter.geojson'),
  await load('farm.geojson'),
  await load('pool.geojson')
)

assert.equal(model.totalPoints, 158)
assert.equal(model.industries.reduce((sum, item) => sum + item.count, 0), model.totalPoints)
assert.equal(model.categories.reduce((sum, item) => sum + item.count, 0), model.totalPoints)
assert.deepEqual(Object.fromEntries(model.industries.map((item) => [item.id, item.count])), {
  crop: 83,
  aquaculture: 72,
  unclassified: 3
})
assert.equal(model.geojson.features.every((feature) => ['crop', 'aquaculture', 'unclassified'].includes(feature.properties.industry)), true)
assert.equal(model.geojson.features.every((feature) => ['high', 'stable', 'watch'].includes(feature.properties.band)), true)
assert.equal(filterValueForecastFeatures(model, { industry: 'aquaculture' }).length, 72)
assert.equal(filterValueForecastFeatures(model, { industry: 'unclassified', category: '未分类' }).length, 3)
for (const category of model.categories) {
  assert.equal(filterValueForecastFeatures(model, { industry: category.industry, category: category.category }).length, category.count)
}

console.log(`Value forecast PASS: ${model.totalPoints} points, ${model.categories.length} categories, crop 83 / aquaculture 72 / unclassified 3`)
