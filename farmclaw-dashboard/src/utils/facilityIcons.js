import { tablerIconMarkup } from './tablerIcons.js'
import { FARM_ASSET_GLYPHS } from './farmAssetGlyphs.js'

const ICON_KEYS = Object.freeze([
  'warehouse',
  'service',
  'inspection',
  'generic',
  'camera',
  'drone',
  'water-control',
  'valve',
  'climate',
  'light',
  'dosing',
  'aquaculture',
  'sensor',
  'tractor',
  'harvester',
  'sprayer',
  'seeder',
  'rover',
  'mower',
  'transporter',
  'crop-point',
  'aquaculture-point',
  'fence',
  'alert-climate',
  'alert-pest',
  'value-crop',
  'value-aquaculture',
  'field-label'
])

export const FACILITY_TYPE_LABELS = Object.freeze({
  warehouse: '仓储设施',
  service: '服务站',
  inspection: '检测中心',
  generic: '通用设施',
  camera: '摄像头',
  drone: '巡航无人机',
  'water-control': '水利控制设备',
  valve: '灌溉阀门',
  climate: '环境控制设备',
  light: '补光灯',
  dosing: '肥液设备',
  aquaculture: '水产设备',
  sensor: '传感设备',
  tractor: '履带式拖拉机',
  harvester: '联合收割机',
  sprayer: '自走式植保机',
  seeder: '精量播种机',
  rover: '田间巡检车',
  mower: '智能除草机',
  transporter: '农用运输车',
  'crop-point': '作物观测点',
  'aquaculture-point': '水产观测点',
  fence: '电子围栏',
  'alert-climate': '气候预警',
  'alert-pest': '虫害预警',
  'value-crop': '种植产值',
  'value-aquaculture': '水产产值',
  'field-label': '种植地块'
})

export const FACILITY_ICON_IDS = Object.freeze(Object.fromEntries(
  ICON_KEYS.map((key) => [key, `farmclaw-facility-${key}`])
))

/**
 * 通用 Tabler 图标的兼容映射。具象资产渲染优先使用 FARM_ASSET_GLYPHS，
 * 本表只为没有专用外形的设施及既有调用提供回退，不作为孪生资产的唯一图源。
 */
export const FACILITY_TABLER_ICON_NAMES = Object.freeze({
  warehouse: 'building-warehouse',
  service: 'building-community',
  inspection: 'flask',
  generic: 'box',
  camera: 'camera',
  drone: 'drone',
  'water-control': 'droplets',
  valve: 'settings',
  climate: 'wind',
  light: 'building',
  dosing: 'test-pipe',
  aquaculture: 'fish',
  sensor: 'antenna',
  tractor: 'tractor',
  harvester: 'forklift',
  sprayer: 'spray',
  seeder: 'seedling',
  rover: 'car',
  mower: 'lawn-mower',
  transporter: 'truck',
  'crop-point': 'seedling',
  'aquaculture-point': 'fish',
  fence: 'shield-check',
  'alert-climate': 'wind',
  'alert-pest': 'spray',
  'value-crop': 'activity',
  'value-aquaculture': 'fish',
  'field-label': 'seedling'
})

export function facilityTablerIconName(key) {
  return FACILITY_TABLER_ICON_NAMES[key] || FACILITY_TABLER_ICON_NAMES.generic
}

export const MACHINERY_ICON_IDS = Object.freeze({
  tractor: FACILITY_ICON_IDS.tractor,
  harvester: FACILITY_ICON_IDS.harvester,
  sprayer: FACILITY_ICON_IDS.sprayer,
  seeder: FACILITY_ICON_IDS.seeder,
  rover: FACILITY_ICON_IDS.rover,
  mower: FACILITY_ICON_IDS.mower,
  transporter: FACILITY_ICON_IDS.transporter
})

export const EQUIPMENT_ICON_KEYS = Object.freeze({
  灌溉泵: 'water-control',
  阀门: 'valve',
  水泵: 'water-control',
  环境控制: 'climate',
  环流风机: 'climate',
  补光灯: 'light',
  施肥机: 'dosing',
  肥液机: 'dosing',
  水产设备: 'aquaculture',
  增氧机: 'aquaculture',
  传感器: 'sensor',
  irrigation: 'water-control',
  valve: 'valve',
  climate: 'climate',
  dosing: 'dosing',
  aquaculture: 'aquaculture',
  sensor: 'sensor'
})

const TYPE_ALIASES = Object.freeze({
  warehouse: 'warehouse',
  storage: 'warehouse',
  service: 'service',
  inspection: 'inspection',
  laboratory: 'inspection',
  camera: 'camera',
  generic: 'generic'
})

/**
 * 优先使用显式 facility_type。显式值未知时按通用设施处理，避免名称猜测覆盖结构化数据。
 * 仅当 facility_type 缺失时才使用 kind/name 兼容历史点位。
 */
export function classifyFacility(properties = {}) {
  const explicitType = String(properties.facility_type || '').trim().toLowerCase()
  if (explicitType) return TYPE_ALIASES[explicitType] || 'generic'
  if (String(properties.kind || '').trim().toLowerCase() === 'camera') return 'camera'

  const name = String(properties.name || '')
  if (/摄像|监控|camera/i.test(name)) return 'camera'
  if (/仓库|仓储|粮仓|storage|warehouse/i.test(name)) return 'warehouse'
  if (/服务站|服务中心|service/i.test(name)) return 'service'
  if (/检测|检验|巡检|化验|inspection|laboratory|lab/i.test(name)) return 'inspection'
  return 'generic'
}

export function equipmentIconKey(category, name = '') {
  const value = String(category || '').trim()
  if (value === '环境控制' && /补光灯/.test(name)) return 'light'
  if (EQUIPMENT_ICON_KEYS[value]) return EQUIPMENT_ICON_KEYS[value]
  if (/阀|valve/i.test(value)) return 'valve'
  if (/补光|灯|light/i.test(value)) return 'light'
  if (/泵|灌溉|水控/i.test(value)) return 'water-control'
  if (/风机|补光|温控|环境|climate/i.test(value)) return 'climate'
  if (/施肥|肥液|配肥|dosing/i.test(value)) return 'dosing'
  if (/水产|增氧|aquaculture/i.test(value)) return 'aquaculture'
  if (/传感|探头|sensor/i.test(value)) return 'sensor'
  return 'generic'
}

export function facilityIconSvg(key) {
  const safeKey = Object.prototype.hasOwnProperty.call(FACILITY_TABLER_ICON_NAMES, key) ? key : 'generic'
  const markup = FARM_ASSET_GLYPHS[safeKey] || tablerIconMarkup(facilityTablerIconName(safeKey))
  const color = FACILITY_ICON_COLORS[safeKey] || '#d6e6e4'
  // 圆环只做承托与识别，内部仍保留农具/设施的具象轮廓，不把图标简化成圆点。
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="96" height="96"><circle cx="24" cy="24" r="21" fill="#07151d" fill-opacity="0.88" stroke="${color}" stroke-opacity="0.5" stroke-width="1.15"/><g transform="translate(6 6) scale(1.5)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#07151d" stroke-width="1.75">${markup}</g><g stroke="${color}" stroke-width="1">${markup}</g></g></svg>`
}

export const FACILITY_ICON_COLORS = Object.freeze({
  warehouse: '#efca80', service: '#9bdac8', inspection: '#d6b8ee',
  camera: '#a9def1', drone: '#b5e9e3', 'water-control': '#7ecdec', valve: '#89d8d5',
  climate: '#acd9e5', light: '#f1dc95', dosing: '#c4b6eb',
  aquaculture: '#81d7e2', sensor: '#d1e6b0',
  tractor: '#a6df94', harvester: '#f3ca75', sprayer: '#83d7d1',
  seeder: '#dcc694', rover: '#b8d9f0', mower: '#b6d991', transporter: '#eccaa7',
  'crop-point': '#b8dd9c', 'aquaculture-point': '#83d7e2', fence: '#8ed7c8',
  'alert-climate': '#91d7ee', 'alert-pest': '#f0b95a',
  'value-crop': '#74d99f', 'value-aquaculture': '#58b9e9', 'field-label': '#9bdac8'
})

export const ASSET_STATUS_COLORS = Object.freeze({
  running: '#74d99f', online: '#74d99f', standby: '#a9b8bc',
  charging: '#58b9e9', warning: '#f0b95a', maintenance: '#f0b95a',
  alarm: '#ff6577', offline: '#ff6577', unknown: '#a9b8bc'
})

export const ASSET_STATUS_ICON_IDS = Object.freeze(Object.fromEntries(
  Object.keys(ASSET_STATUS_COLORS).map((key) => [key, `farmclaw-asset-status-${key}`])
))
function statusIconSvg(status) {
  const marks = {
    running: '<path d="M9 6l8 6-8 6z"/>', online: '<path d="M6 12l4 4 8-8"/>',
    standby: '<path d="M9 7v10M15 7v10"/>', charging: '<path d="M14 5l-6 8h5l-3 6 7-9h-5z"/>',
    warning: '<path d="M12 6v7M12 17h.01"/>', maintenance: tablerIconMarkup('settings'),
    alarm: '<path d="M12 6v7M12 17h.01"/>', offline: tablerIconMarkup('x'),
    unknown: '<path d="M7 12h10"/>'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="3" fill="#07151d" stroke="${ASSET_STATUS_COLORS[status]}" stroke-width="1.5"/><g fill="none" stroke="${ASSET_STATUS_COLORS[status]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${marks[status]}</g></svg>`
}

export function assetStatusImageExpression(property) {
  return ['match', ['get', property], ...Object.entries(ASSET_STATUS_ICON_IDS).flat(), ASSET_STATUS_ICON_IDS.unknown]
}

export function facilityIconDataUri(key) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(facilityIconSvg(key))}`
}

function loadMapImage(map, uri) {
  if (typeof Image !== 'undefined') {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('设施 SVG 图标解码失败'))
      image.src = uri
    })
  }
  if (map.loadImage.length >= 2) {
    return new Promise((resolve, reject) => {
      map.loadImage(uri, (error, image) => error ? reject(error) : resolve(image))
    })
  }
  return Promise.resolve(map.loadImage(uri)).then((loaded) => loaded?.data || loaded)
}

/** 注册全部设施图标，返回本次新注册的 MapLibre image id。 */
export async function registerFacilityIcons(map) {
  if (!map || typeof map.addImage !== 'function' || typeof map.loadImage !== 'function') {
    throw new TypeError('registerFacilityIcons 需要 MapLibre map 实例')
  }
  const registered = []
  for (const key of ICON_KEYS) {
    const id = FACILITY_ICON_IDS[key]
    if (typeof map.hasImage === 'function' && map.hasImage(id)) continue
    const image = await loadMapImage(map, facilityIconDataUri(key))
    map.addImage(id, image, { pixelRatio: 2 })
    registered.push(id)
  }
  const decorations = [
    ...Object.entries(ASSET_STATUS_ICON_IDS).map(([status, id]) => [id, statusIconSvg(status)])
  ]
  for (const [id, svg] of decorations) {
    if (map.hasImage?.(id)) continue
    const image = await loadMapImage(map, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    map.addImage(id, image, { pixelRatio: 2 })
    registered.push(id)
  }
  return registered
}
