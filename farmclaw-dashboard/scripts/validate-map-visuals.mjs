import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { geometryRepresentativePoint, pointInPolygon } from '../src/utils/mapGeometry.js'
import {
  buildTwinPatternImage,
  enrichTwinGeoJson,
  registerTwinPatternImages,
  selectedFeatureOpacity,
  TWIN_OBJECT_SOURCE_IDS,
  TWIN_PATTERN_IDS,
  twinObjectPresentation
} from '../src/utils/mapTwinVisuals.js'
import { smoothLineGeoJson } from '../src/utils/mapPathSmoothing.js'
import { getViewportPadding, syncMapViewport } from '../src/utils/mapViewport.js'

const mapSource = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const viewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const themeSource = await readFile(new URL('../src/style/theme.css', import.meta.url), 'utf8')

const expectedTwinSources = {
  farm: { file: 'farm.geojson', prefix: 'FIELD', type: '种植地块' },
  pool: { file: 'pool.geojson', prefix: 'POND', type: '水产塘口' },
  water: { file: 'water.geojson', prefix: 'WATER', type: '园区水系' },
  green: { file: 'green.geojson', prefix: 'GREEN', type: '生态绿地' },
  building: { file: 'building.geojson', prefix: 'BLDG', type: '建筑体量' },
  greenhouse: { file: 'greenhouse.geojson', prefix: 'GH', type: '温室设施' }
}

assert.deepEqual([...TWIN_OBJECT_SOURCE_IDS].sort(), Object.keys(expectedTwinSources).sort(), '必须完整登记六类数字孪生空间对象')
for (const [sourceId, definition] of Object.entries(expectedTwinSources)) {
  const geojson = JSON.parse(await readFile(new URL(`../public/static/mock/${definition.file}`, import.meta.url), 'utf8'))
  const enriched = enrichTwinGeoJson(sourceId, geojson)
  assert.equal(enriched.features.length > 0, true, `${sourceId} 空间对象不能为空`)
  assert.equal(enriched.features.every((feature) => String(feature.properties.twin_id).startsWith(`${definition.prefix}-`)), true, `${sourceId} 对象编号前缀错误`)
  assert.equal(enriched.features.every((feature) => feature.id === feature.properties.twin_id), true, `${sourceId} 渲染 ID 必须与孪生对象编号一致`)
  assert.equal(enriched.features.every((feature) => feature.properties.twin_type === definition.type), true, `${sourceId} 对象类型错误`)
  assert.equal(enriched.features.every((feature) => feature.properties.twin_status && feature.properties.twin_source === '演示空间底图'), true, `${sourceId} 必须补齐状态与来源`)
  assert.equal(enriched.features.every((feature) => feature.properties.twin_link === '未关联业务档案'), true, `${sourceId} 必须明确业务档案关联状态`)
  assert.equal(twinObjectPresentation(enriched.features[0].properties).id, enriched.features[0].properties.twin_id)
}

const registeredPatterns = []
const registeredPatternIds = new Set()
const patternMap = {
  hasImage: (id) => registeredPatternIds.has(id),
  addImage: (id, image) => {
    registeredPatternIds.add(id)
    registeredPatterns.push({ id, image })
  }
}
for (const [kind, id] of Object.entries(TWIN_PATTERN_IDS)) {
  const pattern = buildTwinPatternImage(kind)
  assert.equal(pattern.data.length, pattern.width * pattern.height * 4, `${kind} 纹理像素尺寸错误`)
  assert.equal(pattern.data.some((channel, index) => index % 4 === 3 && channel > 0), true, `${kind} 纹理必须包含可见像素`)
  assert.equal(pattern.data.every((channel) => channel >= 0 && channel <= 255), true, `${kind} 像素通道越界`)
  assert.equal(typeof id, 'string')
}
registerTwinPatternImages(patternMap)
registerTwinPatternImages(patternMap)
assert.deepEqual(registeredPatterns.map(({ id }) => id).sort(), Object.values(TWIN_PATTERN_IDS).sort(), '纹理必须完整注册且不能重复添加')

const concaveRings = [[
  [0, 0], [6, 0], [6, 1], [1, 1], [1, 5], [6, 5], [6, 6], [0, 6], [0, 0]
]]
const concaveAnchor = geometryRepresentativePoint({ type: 'Polygon', coordinates: concaveRings })
assert.equal(pointInPolygon(concaveAnchor, concaveRings), true, '凹多边形锚点必须位于面内')

const smallPolygon = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
const largePolygon = [[[10, 10], [16, 10], [16, 16], [10, 16], [10, 10]]]
const multiPolygonAnchor = geometryRepresentativePoint({ type: 'MultiPolygon', coordinates: [smallPolygon, largePolygon] })
assert.equal(pointInPolygon(multiPolygonAnchor, largePolygon), true, 'MultiPolygon 锚点必须落在面积最大的面内')

assert.deepEqual(selectedFeatureOpacity('CAM-01', 1, 0.2), ['case', ['==', ['to-string', ['get', 'id']], 'CAM-01'], 1, 0.2], '选中隔离表达式错误')

const smoothedPath = smoothLineGeoJson({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] }, properties: {} }]
}, 4)
assert.equal(smoothedPath.features[0].geometry.coordinates.length, 9, '巡航路径必须增加平滑采样点')
assert.deepEqual(smoothedPath.features[0].geometry.coordinates[0], [0, 0], '平滑路径必须保留起点')
assert.deepEqual(smoothedPath.features[0].geometry.coordinates.at(-1), [2, 0], '平滑路径必须保留终点')

for (const implementation of [
  'TOPIC_VISUAL_PROFILES',
  'tuneBaseMap',
  'applyMapVisualState',
  "map.setLight({ anchor: 'map'",
  "map.setSky({",
  'syncMapViewport(map, { ...workspaceLayout, presentation: mapPresentationMode })',
  "id: 'farmclaw-water-outline'",
  "id: 'farmclaw-farm-outline'",
  "id: 'farmclaw-building-footprint'",
  "id: 'farmclaw-greenhouse-footprint'",
  "'fill-extrusion-vertical-gradient': true",
  "'raster-saturation': -0.46",
  "'raster-contrast': 0.2",
  "id: 'farmclaw-selection-fill'",
  "id: 'farmclaw-selection-line'",
  "'riskLayer', 'selectionLayer'",
  "'fill-pattern': TWIN_PATTERN_IDS.fieldRows",
  "'fill-pattern': TWIN_PATTERN_IDS.waterRipples",
  "'fill-extrusion-height': 13",
  "'fill-extrusion-height': 8",
  "selectedMapFeatureKind = feature.properties?.kind || null",
  "['camera', 'fence'].includes(selectedMapFeatureKind)",
  'selectedFeatureOpacity(selectedId, selectedOpacity, contextOpacity)',
  'map.queryRenderedFeatures(event.point, { layers: foregroundLayers })',
  '演示空间对象，不代表真实权属或生产状态。',
  "map.on('click', SECURITY_INTERACTIVE_LAYERS, (event) =>",
  "candidate.properties?.kind === 'camera')",
  "candidate.properties?.kind === 'fence')",
  "map.on('click', BUSINESS_POINT_INTERACTIVE_LAYERS, (event) =>",
  "map.addSource('machinery'",
  'setMachineryData',
  'setMachineryFilter',
  'focusMachinery',
  'onMachinerySelect',
  "id: 'farmclaw-machinery-status'",
  "selectedMapFeatureKind === 'machinery'",
  '演示农机遥测 · 仅供运行监测'
]) {
  assert.equal(mapSource.includes(implementation), true, `缺少数字孪生地图视觉能力：${implementation}`)
}

const constructorSource = mapSource.match(/new maplibregl\.Map\(\{([\s\S]*?)\n  \}\)/)?.[1] || ''
assert.equal(constructorSource.includes('padding:'), false, 'MapLibre MapOptions 不支持 padding，初始留白必须通过 setPadding 设置')

for (const testCase of [
  { name: 'desktop', options: { width: 1440, height: 1000 }, expected: { top: 138, right: 72, bottom: 98, left: 400 } },
  { name: 'tablet', options: { width: 1024, height: 768 }, expected: { top: 138, right: 72, bottom: 98, left: 356 } },
  { name: 'mobile', options: { width: 390, height: 844 }, expected: { top: 214, right: 18, bottom: 377, left: 18 } }
]) {
  const calls = []
  const targetMap = {
    resize() { calls.push(['resize']) },
    setPadding(padding) { calls.push(['setPadding', padding]) }
  }
  const padding = syncMapViewport(targetMap, testCase.options)
  assert.deepEqual(padding, testCase.expected, `${testCase.name} 视口留白计算错误`)
  assert.deepEqual(calls, [['resize'], ['setPadding', testCase.expected]], `${testCase.name} 视口必须先 resize 再 setPadding`)
  assert.deepEqual(getViewportPadding(testCase.options), testCase.expected, `${testCase.name} 视口计算结果不稳定`)
}

assert.equal(mapSource.includes("globalThis.window.addEventListener('resize', viewportResizeHandler"), true, '窗口尺寸变化后必须重新同步地图视口')
assert.equal(mapSource.includes("globalThis.window.removeEventListener('resize', viewportResizeHandler)"), true, '销毁地图时必须解绑视口监听')
assert.equal(mapSource.includes("map.fitBounds(bounds, { padding: getViewportPadding()"), false, '围栏聚焦不能与全局视口留白重复计算')
assert.equal(mapSource.includes("map.fitBounds(bounds, { padding: 18"), true, '围栏聚焦应保留轻量对象呼吸区')
assert.equal(mapSource.includes('retainPadding'), false, '当前 MapLibre 相机选项不支持 retainPadding')
assert.equal(mapSource.match(/function addLayersBefore[\s\S]*?\n}/)?.[0].includes('reverse()'), false, '连续插入同一锚点时不能反转图层数组')
assert.equal(mapSource.includes('addLayersBefore(groundGeometryLayers, roadAnchorId)'), true, '地表与纹理必须位于道路下方')
assert.equal(mapSource.includes('addLayersBefore(structureGeometryLayers, labelAnchorId)'), true, '建筑体量必须位于道路与底图标注之间')
assert.equal(mapSource.includes('addLayersBefore(boundaryGeometryLayers, labelAnchorId)'), true, '园区与安防边界必须位于道路之上、底图标注之下')
assert.equal(mapSource.includes("'farmclaw-fence-fill',\n    'farmclaw-fence-line'"), true, '电子围栏面和边界线必须归入边界图层组')
assert.equal((mapSource.match(/filter: \['==', \['get', 'selection_anchor'\], true\]/g) || []).length, 0, '对象选中后不得恢复矩形角框')

for (const layerId of ['farmclaw-server-icon', 'farmclaw-camera-icon', 'farmclaw-machinery-icon']) {
  const layerSource = mapSource.match(new RegExp(`\\{ id: '${layerId}'[^\\n]+`))?.[0] || ''
  assert.equal(layerSource.includes("'icon-allow-overlap': true"), true, `${layerId} 不能被底图文字挤成不可见点位`)
  assert.equal(layerSource.includes("'icon-ignore-placement': false"), true, `${layerId} 必须为后续文字预留空间`)
  assert.equal(layerSource.includes("'icon-pitch-alignment': 'viewport'"), true, `${layerId} 在倾斜地图中不能变形`)
}

assert.equal(mapSource.includes('machineryLayer: [...MACHINERY_INTERACTIVE_LAYERS]'), true, '运营专题与筛选必须共用农机图层列表')
for (const layer of ['machinery-halo', 'machinery-point', 'machinery-freshness', 'camera-halo', 'camera-point', 'server']) {
  assert.equal(mapSource.includes(`id: 'farmclaw-${layer}'`), false, `${layer} 不得恢复圆点底座`)
}
for (const layerId of ['farmclaw-alert-events', 'farmclaw-production', 'farmclaw-crops', 'farmclaw-aquaculture-points', 'farmclaw-field-label-anchor', 'farmclaw-value-label-anchor']) {
  const layerSource = mapSource.match(new RegExp(`\\{ id: '${layerId}'[^\\n]+`))?.[0] || ''
  assert.equal(layerSource.includes("type: 'symbol'"), true, `${layerId} 必须使用具象图标，不得使用圆点`)
  assert.equal(layerSource.includes("'icon-image'"), true, `${layerId} 必须声明图标角色`)
}
assert.equal(mapSource.includes("['get', 'status_label'], ' · ', ['to-string', ['get', 'task_progress']], '% · ', ['get', 'freshness_label']"), true, '农机高缩放标签必须同时表达状态、进度和新鲜度')

for (const topic of ['product', 'ai', 'security', 'value', 'operations', 'alerts']) {
  assert.equal(mapSource.includes(`${topic}: {`), true, `缺少 ${topic} 专题视觉配置`)
}

assert.equal(mapSource.includes('applyMapVisualState()\n  return nextVisible'), true, '卫星模式切换后必须同步业务图层对比度')
assert.equal(mapSource.includes("applyMapVisualState()\n}"), true, '专题切换后必须同步地图视觉主次')
assert.equal(viewSource.includes('class="mask"'), false, '地图业务对象不能被全屏装饰网格与暗角遮罩覆盖')
assert.equal(themeSource.includes('top: clamp(184px, 25vh, 220px) !important'), true, '移动端空间对象弹窗必须保留稳定的信息安全区')
assert.equal(themeSource.includes('100dvh - clamp(184px,25vh,220px) - 136px'), true, '移动端对象弹窗必须避开底部专题与指令栏')
assert.equal(themeSource.includes('html.farmclaw-twin-focus .farmclaw-hud .telemetry-panel'), true, '移动端对象聚焦时必须隐藏后方分析面板')
assert.equal(themeSource.includes('html.farmclaw-twin-focus .farmclaw-hud .asset-legend { display:none; }'), true, '移动端选中农机时类型图例必须收起，不能与详情重叠')
assert.equal(themeSource.includes('grid-template-columns: repeat(2,minmax(0,1fr))'), true, '移动端空间对象信息必须使用紧凑双列排版')

console.log('Map visuals PASS: terrain hierarchy, thematic focus, satellite grading, 3D structures and geometry-aware selection verified')
