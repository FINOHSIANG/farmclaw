import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getViewportPadding } from '../src/utils/mapViewport.js'

const file = resolve('public/static/mock/security.geojson')
const data = JSON.parse(await readFile(file, 'utf8'))
const border = JSON.parse(await readFile(resolve('public/static/mock/border.geojson'), 'utf8'))
const greenhouse = JSON.parse(await readFile(resolve('public/static/mock/greenhouse.geojson'), 'utf8'))
const freeMapSource = await readFile(resolve('src/utils/freeMap.js'), 'utf8')
const securityPanelSource = await readFile(resolve('src/components/SecurityPanel.vue'), 'utf8')
const viewSource = await readFile(resolve('src/views/index.vue'), 'utf8')
const errors = []
const ids = new Set()
const cameraStatuses = new Set(['online', 'offline', 'alarm', 'maintenance'])
const fenceStatuses = new Set(['armed', 'disarmed', 'alarm', 'offline'])
const fenceLevels = new Set(['critical', 'high', 'medium', 'low'])

function validCoordinate(coordinate) {
  return Array.isArray(coordinate) && coordinate.length >= 2 &&
    Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]) &&
    coordinate[0] >= -180 && coordinate[0] <= 180 &&
    coordinate[1] >= -90 && coordinate[1] <= 90
}

function validateCoordinates(value, id) {
  if (validCoordinate(value)) return
  if (!Array.isArray(value)) {
    errors.push(`${id} 包含非法坐标`)
    return
  }
  value.forEach((item) => validateCoordinates(item, id))
}

function validateClosedRings(geometry, id) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const rings of polygons) {
    for (const ring of rings) {
      const first = ring[0]
      const last = ring.at(-1)
      if (!validCoordinate(first) || !validCoordinate(last) || first[0] !== last[0] || first[1] !== last[1]) {
        errors.push(`${id} 围栏边界未闭合`)
      }
    }
  }
}

if (data.type !== 'FeatureCollection') errors.push('根节点必须是 FeatureCollection')

for (const [index, feature] of (data.features || []).entries()) {
  const { id, kind, status } = feature.properties || {}
  if (!id) errors.push(`feature[${index}] 缺少 id`)
  if (ids.has(id)) errors.push(`重复 id: ${id}`)
  ids.add(id)
  validateCoordinates(feature.geometry?.coordinates, id || index)

  if (kind === 'camera') {
    if (feature.geometry?.type !== 'Point') errors.push(`${id} 摄像头必须使用 Point`)
    if (!cameraStatuses.has(status)) errors.push(`${id} 摄像头状态非法: ${status}`)
    if (!feature.properties?.name || !feature.properties?.zone || !['fixed', 'ptz'].includes(feature.properties?.type)) errors.push(`${id} 摄像头业务字段不完整`)
    if (!Number.isFinite(feature.properties?.direction) || feature.properties.direction < 0 || feature.properties.direction >= 360) errors.push(`${id} direction 非法`)
    if (!Number.isFinite(feature.properties?.fov) || feature.properties.fov <= 0 || feature.properties.fov > 180) errors.push(`${id} fov 非法`)
  } else if (kind === 'fence') {
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) errors.push(`${id} 围栏必须使用 Polygon/MultiPolygon`)
    if (!fenceStatuses.has(status)) errors.push(`${id} 围栏状态非法: ${status}`)
    if (!feature.properties?.name || !feature.properties?.zone || !fenceLevels.has(feature.properties?.level) || !feature.properties?.rule) errors.push(`${id} 围栏业务字段不完整`)
    if (['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) validateClosedRings(feature.geometry, id)
  } else {
    errors.push(`${id || index} kind 非法: ${kind}`)
  }
}

const cameras = data.features.filter((feature) => feature.properties?.kind === 'camera')
const fences = data.features.filter((feature) => feature.properties?.kind === 'fence')
if (cameras.length < 6) errors.push(`摄像头点位不足: ${cameras.length}`)
if (fences.length < 3) errors.push(`电子围栏不足: ${fences.length}`)

const perimeterFence = fences.find((feature) => feature.properties?.id === 'FENCE-PERIMETER')
const parkBoundary = border.features?.[0]
if (!perimeterFence || !parkBoundary || JSON.stringify(perimeterFence.geometry) !== JSON.stringify(parkBoundary.geometry)) {
  errors.push('园区周界电子围栏必须与 border.geojson 园区范围完全一致')
}
const greenhouseFence = fences.find((feature) => feature.properties?.id === 'FENCE-GREENHOUSE')
const greenhouseScope = {
  type: 'MultiPolygon',
  coordinates: greenhouse.features.flatMap((feature) => feature.geometry?.coordinates || [])
}
if (!greenhouseFence || JSON.stringify(greenhouseFence.geometry) !== JSON.stringify(greenhouseScope)) {
  errors.push('核心温室电子围栏必须与 greenhouse.geojson 温室范围完全一致')
}
if (!freeMapSource.includes("security: ['waterLayer'") || freeMapSource.includes("security: ['borderLayer'")) {
  errors.push('安全专题必须只使用电子围栏表达范围，不能叠加独立 borderLayer 蓝线')
}
if (!securityPanelSource.includes('{{ fence.zone }} · {{ fence.rule }}') || !securityPanelSource.includes('防区范围 · ${selected.zone}')) {
  errors.push('围栏列表和预览必须使用统一防区范围口径')
}

for (const copy of ['本地数字孪生演示', '不控制现场围栏、摄像头或其他设备', '未确认告警仍会保留']) {
  if (!securityPanelSource.includes(copy)) errors.push(`安防面板缺少真实性说明：${copy}`)
}
if (!securityPanelSource.includes('hasActiveAlert(fence)') || !securityPanelSource.includes("item?.controlStatus === 'disarmed'")) {
  errors.push('撤防后的未确认事件必须继续显示告警文字和确认入口')
}
if (!securityPanelSource.includes('.security-row { display:grid') || !securityPanelSource.includes('.ack-button { position:static')) {
  errors.push('摄像头确认按钮必须使用独立网格列，不能绝对定位覆盖状态列')
}
if (!securityPanelSource.includes('closeDisarmAll') || !securityPanelSource.includes('restoredTrigger.focus()')) {
  errors.push('全部撤防二阶段确认必须在关闭后恢复键盘焦点')
}
if (!viewSource.includes('const selected = freeMapAdapter.focusSecurityFeature(featureId)')) {
  errors.push('确认安防告警后必须同步侧栏选中对象、地图选中态与弹窗')
}
if (!freeMapSource.includes('feature.properties.incidents = 0')) {
  errors.push('确认摄像头告警时必须清除 incidents 计数')
}
for (const copy of ['全部围栏已模拟撤防，未确认告警继续保留', '未控制现场设备', '仅更新数字孪生状态']) {
  if (!viewSource.includes(copy)) errors.push(`安防事件流缺少本地模拟语义：${copy}`)
}

const syncFunctionMatch = freeMapSource.match(/(function syncFenceVisualStatus[\s\S]*?\n})\n\nexport async function initFreeMap/)
if (!syncFunctionMatch) {
  errors.push('缺少围栏控制状态与告警视觉同步函数')
} else {
  const syncFenceVisualStatus = new Function(`${syncFunctionMatch[1]}; return syncFenceVisualStatus`)()
  const pendingFence = { properties: { kind: 'fence', status: 'alarm', incidents: 1 } }
  syncFenceVisualStatus(pendingFence)
  pendingFence.properties.controlStatus = 'disarmed'
  syncFenceVisualStatus(pendingFence)
  if (pendingFence.properties.status !== 'alarm') errors.push('围栏撤防后未确认事件丢失告警视觉')
  pendingFence.properties.acknowledged_at = new Date().toISOString()
  pendingFence.properties.incidents = 0
  syncFenceVisualStatus(pendingFence)
  if (pendingFence.properties.status !== 'disarmed') errors.push('确认告警后围栏必须恢复为撤防视觉状态')
}

for (const width of [601, 768, 1024, 1100]) {
  const padding = getViewportPadding({ width, height: 768 })
  if (padding.left + padding.right >= width || width - padding.left - padding.right < 135) {
    errors.push(`${width}px 平板地图聚焦边距超出可用画布`)
  }
}

if (errors.length) {
  console.error(`Security data FAIL (${errors.length})`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`Security data PASS: ${fences.length} fences, ${cameras.length} cameras, ${ids.size} unique ids`)
