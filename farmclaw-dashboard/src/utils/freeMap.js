import maplibregl from 'maplibre-gl'
import { buildValueForecastModel } from '@/utils/valueForecast.js'
import { buildBusinessLabelData, securityStatusLabel } from '@/utils/mapLabels.js'
import { FACILITY_ICON_IDS, FACILITY_TYPE_LABELS, MACHINERY_ICON_IDS, assetStatusImageExpression, classifyFacility, facilityIconDataUri, registerFacilityIcons } from '@/utils/facilityIcons.js'
import { syncMapViewport } from '@/utils/mapViewport.js'
import { geometryRepresentativePoint } from '@/utils/mapGeometry.js'
import { enrichTwinGeoJson, registerTwinPatternImages, selectedFeatureOpacity, TWIN_OBJECT_SOURCE_IDS, TWIN_PATTERN_IDS, twinObjectPresentation } from '@/utils/mapTwinVisuals.js'
import { buildMachineryGeoJson } from '@/utils/machineryMonitor.js'
import { applyTwinObservationUpdate, buildTwinObservation, twinObservationUpdateMode } from '@/utils/twinObservation.js'
import { mapObjectRecord } from '@/utils/workspaceModel.js'
import { geoJsonBounds, buildOverviewLabels } from '@/utils/mapOverview.js'
import { smoothLineGeoJson } from './mapPathSmoothing.js'

export { getViewportPadding } from '@/utils/mapViewport.js'

const DEFAULT_CENTER = [113.532936, 22.738711]
const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const DEFAULT_CAMERA = { zoom: 15.45, pitch: 52, bearing: -7 }
const TWIN_MEDIA_ALLOWED_ORIGINS = Object.freeze(
  String(import.meta.env.VITE_TWIN_MEDIA_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)

const SURFACE_VISUALS = [
  { key: 'water', layer: 'farmclaw-water', property: 'fill-opacity', outline: 'farmclaw-water-outline', satelliteScale: 0.52 },
  { key: 'pool', layer: 'farmclaw-pool', property: 'fill-opacity', outline: 'farmclaw-pool-outline', satelliteScale: 0.52 },
  { key: 'farm', layer: 'farmclaw-farm', property: 'fill-opacity', outline: 'farmclaw-farm-outline', satelliteScale: 0.46 },
  { key: 'green', layer: 'farmclaw-green', property: 'fill-opacity', outline: 'farmclaw-green-outline', satelliteScale: 0.48 },
  { key: 'building', layer: 'farmclaw-building', property: 'fill-extrusion-opacity', outline: 'farmclaw-building-footprint', satelliteScale: 0.78 },
  { key: 'greenhouse', layer: 'farmclaw-greenhouse', property: 'fill-extrusion-opacity', outline: 'farmclaw-greenhouse-footprint', satelliteScale: 0.72 }
]

const TOPIC_VISUAL_PROFILES = {
  product: { water: 0.58, pool: 0.56, farm: 0.6, green: 0.56, building: 0.86, greenhouse: 0.64, crops: 0.82, machinery: 0.76, outlines: 0.72, boundary: 0.56, texture: 0.22, roads: 0.72, labels: 0.56 },
  ai: { water: 0.5, pool: 0.5, farm: 0.54, green: 0.5, building: 0.76, greenhouse: 0.58, crops: 0.76, machinery: 0.7, outlines: 0.64, boundary: 0.48, texture: 0.18, roads: 0.54, labels: 0.44 },
  security: { water: 0.3, pool: 0.26, farm: 0.24, green: 0.24, building: 0.58, greenhouse: 0.42, crops: 0.36, machinery: 0.42, outlines: 0.5, boundary: 0.34, texture: 0.08, roads: 0.28, labels: 0.2 },
  value: { water: 0.26, pool: 0.3, farm: 0.28, green: 0.24, building: 0.46, greenhouse: 0.36, crops: 0.34, machinery: 0.38, outlines: 0.44, boundary: 0.4, texture: 0.07, roads: 0.2, labels: 0.16 },
  operations: { water: 0.34, pool: 0.34, farm: 0.34, green: 0.3, building: 0.84, greenhouse: 0.68, crops: 0.4, machinery: 1, outlines: 0.62, boundary: 0.46, texture: 0.1, roads: 0.4, labels: 0.28 },
  alerts: { water: 0.3, pool: 0.3, farm: 0.3, green: 0.28, building: 0.52, greenhouse: 0.42, crops: 0.46, machinery: 0.45, outlines: 0.46, boundary: 0.38, texture: 0.08, roads: 0.24, labels: 0.2 }
}

const TEXTURE_VISUALS = [
  { layer: 'farmclaw-farm-texture', scale: 1 },
  { layer: 'farmclaw-pool-texture', scale: 0.88 }
]

const BASEMAP_CONTEXT_LABELS = [
  'water_name',
  'highway_name_other',
  'highway_name_motorway',
  'place_other',
  'place_suburb',
  'place_village',
  'place_town',
  'place_city',
  'place_city_large',
  'place_state'
]

const BASEMAP_ROADS = ['highway_path', 'highway_minor', 'highway_major_casing', 'highway_major_inner', 'highway_motorway_casing', 'highway_motorway_inner']

const TWIN_INTERACTIVE_LAYERS = ['farmclaw-building', 'farmclaw-greenhouse', 'farmclaw-pool-texture', 'farmclaw-farm-texture', 'farmclaw-pool', 'farmclaw-farm', 'farmclaw-water', 'farmclaw-green']

const SECURITY_INTERACTIVE_LAYERS = ['farmclaw-camera-status', 'farmclaw-camera-icon', 'farmclaw-camera-label-compact', 'farmclaw-camera-label-detail', 'farmclaw-camera-alert-label', 'farmclaw-fence-fill', 'farmclaw-fence-line', 'farmclaw-fence-icon', 'farmclaw-fence-label', 'farmclaw-fence-alert-label']

const MACHINERY_INTERACTIVE_LAYERS = ['farmclaw-machinery-status', 'farmclaw-machinery-icon', 'farmclaw-machinery-label-compact', 'farmclaw-machinery-label-detail']

const BUSINESS_POINT_INTERACTIVE_LAYERS = ['farmclaw-server-icon', 'farmclaw-server-label', 'farmclaw-alert-events', 'farmclaw-production', 'farmclaw-field-label-anchor', 'farmclaw-field-label-compact', 'farmclaw-field-label-detail', 'farmclaw-value-label-anchor', 'farmclaw-value-label-compact', 'farmclaw-value-label-detail', ...MACHINERY_INTERACTIVE_LAYERS]

const FOREGROUND_INTERACTIVE_LAYERS = [...SECURITY_INTERACTIVE_LAYERS, ...BUSINESS_POINT_INTERACTIVE_LAYERS]

const FENCE_FILL_OPACITY = ['match', ['get', 'status'], 'armed', 0.025, 'alarm', 0.07, 0.02]

const SOURCE_DEFINITIONS = [
  ['border', 'border.geojson'],
  ['farm', 'farm.geojson'],
  ['pool', 'pool.geojson'],
  ['water', 'water.geojson'],
  ['building', 'building.geojson'],
  ['green', 'green.geojson'],
  ['greenhouse', 'greenhouse.geojson'],
  ['crop', 'crop.geojson'],
  ['fertility', 'fertility.geojson'],
  ['alert-risk', 'alert-risk.geojson'],
  ['production', 'productation.geojson'],
  ['pool-center', 'poolCenter.geojson'],
  ['server', 'serverpoi.geojson'],
  ['security', 'security.geojson'],
  ['drone-path', 'dronWander2.geojson'],
  ['invade-path', 'invade-path.geojson']
]

const LOGICAL_LAYERS = {
  satelliteLayer: ['farmclaw-satellite'],
  borderLayer: ['farmclaw-border-casing', 'farmclaw-border'],
  farmLayer: ['farmclaw-farm', 'farmclaw-farm-outline'],
  poolLayer: ['farmclaw-pool', 'farmclaw-pool-outline'],
  waterLayer: ['farmclaw-water', 'farmclaw-water-outline'],
  buildingLayer: ['farmclaw-building-base', 'farmclaw-building', 'farmclaw-building-footprint'],
  greenLayer: ['farmclaw-green', 'farmclaw-green-outline'],
  greenhouseLayer: ['farmclaw-greenhouse-base', 'farmclaw-greenhouse', 'farmclaw-greenhouse-footprint'],
  cropLayer: ['farmclaw-crops', 'farmclaw-aquaculture-points'],
  fieldLabelLayer: ['farmclaw-field-label-anchor', 'farmclaw-field-label-compact', 'farmclaw-field-label-detail'],
  riskLayer: ['farmclaw-risk'],
  climateRiskLayer: ['farmclaw-climate-risk'],
  pestRiskLayer: ['farmclaw-pest-risk'],
  alertEventLayer: ['farmclaw-alert-events'],
  producationLayer: ['farmclaw-production', 'farmclaw-value-label-anchor', 'farmclaw-value-label-compact', 'farmclaw-value-label-detail'],
  serverLayer: ['farmclaw-server-icon', 'farmclaw-server-label'],
  machineryLayer: [...MACHINERY_INTERACTIVE_LAYERS],
  fenceLayer: ['farmclaw-fence-fill', 'farmclaw-fence-line', 'farmclaw-fence-icon', 'farmclaw-fence-label', 'farmclaw-fence-alert-label'],
  cameraLayer: ['farmclaw-camera-cone', 'farmclaw-camera-status', 'farmclaw-camera-icon', 'farmclaw-camera-label-compact', 'farmclaw-camera-label-detail', 'farmclaw-camera-alert-label'],
  selectionLayer: ['farmclaw-selection-fill', 'farmclaw-selection-line'],
  dronPathLayer: ['farmclaw-drone-path-casing', 'farmclaw-drone-path'],
  invadeLayer: ['farmclaw-invade-path-casing', 'farmclaw-invade-path']
}

const TOPICS = {
  product: ['borderLayer', 'farmLayer', 'poolLayer', 'waterLayer', 'buildingLayer', 'greenLayer', 'greenhouseLayer', 'cropLayer', 'fieldLabelLayer', 'selectionLayer'],
  ai: ['borderLayer', 'farmLayer', 'poolLayer', 'waterLayer', 'buildingLayer', 'greenLayer', 'greenhouseLayer', 'cropLayer', 'fieldLabelLayer', 'riskLayer', 'selectionLayer'],
  // 安全专题以电子围栏作为范围边界，避免与同源园区边界线重复叠加。
  security: ['waterLayer', 'buildingLayer', 'greenhouseLayer', 'serverLayer', 'fenceLayer', 'cameraLayer', 'selectionLayer', 'dronPathLayer'],
  value: ['borderLayer', 'farmLayer', 'poolLayer', 'producationLayer', 'selectionLayer'],
  operations: ['borderLayer', 'farmLayer', 'poolLayer', 'waterLayer', 'buildingLayer', 'greenhouseLayer', 'serverLayer', 'machineryLayer', 'selectionLayer'],
  alerts: ['borderLayer', 'farmLayer', 'poolLayer', 'waterLayer', 'buildingLayer', 'greenLayer', 'greenhouseLayer', 'cropLayer', 'fieldLabelLayer', 'selectionLayer', 'alertEventLayer']
}

let map
let droneMarker
let droneAnimationFrame
let invadePopup
let securityPopup
let businessPopup
let viewportResizeHandler
let droneActive = false
let invadeActive = false
let satelliteVisible = false
let fencesVisible = true
let camerasVisible = true
let currentTopic = 'product'
let currentAlertType = 'all'
let currentAlertField = 'greenhouse-1'
let droneCoordinates = []
let invadeCoordinates = []
let securityData
let securitySelectionHandler
let valueForecastModel
let machineryData
let machinerySelectionHandler
let currentMachineryStatus = 'all'
let mapPresentationMode = false
let workspaceLayout = {}
let mapViewChangeHandler
let selectedMapFeatureId = null
let selectedMapFeatureKind = null
let twinSourceData = new Map()
let workspaceSourceData = new Map()
let objectSelectionHandler
let workspaceSelectionFeature = null
let overviewMode = true

function buildAlertEventData(data) {
  const groups = new Map()
  for (const feature of data?.features || []) {
    const properties = feature.properties || {}
    const point = geometryRepresentativePoint(feature.geometry, null)
    const key = `${properties.field_id || ''}:${properties.alert_id || feature.id || point?.join(',') || ''}`
    if (!point || !key) continue
    const current = groups.get(key)
    if (!current || Number(properties.risk_score) > Number(current.properties.risk_score)) {
      groups.set(key, { ...feature, geometry: { type: 'Point', coordinates: point } })
    }
  }
  return { type: 'FeatureCollection', features: [...groups.values()] }
}

function syncFreeMapViewport() {
  const result = syncMapViewport(map, { ...workspaceLayout, presentation: mapPresentationMode })
  if (overviewMode) fitWorkspaceOverview(0)
  return result
}

function fitWorkspaceOverview(duration = 800) {
  const bounds = geoJsonBounds(workspaceSourceData.get('border'))
  if (!map || !bounds) return
  map.fitBounds(bounds, { padding: 24, bearing: 0, pitch: 0, maxZoom: 15.2, duration })
}

function twinObservationOptions() {
  return {
    baseUrl: globalThis.location?.href || 'http://localhost/',
    allowedMediaOrigins: TWIN_MEDIA_ALLOWED_ORIGINS
  }
}

function setTwinPopupFocus(active) {
  globalThis.document?.documentElement?.classList.toggle('farmclaw-twin-focus', Boolean(active))
}

function staticUrl(filename) {
  return `${import.meta.env.BASE_URL}static/mock/${filename}`
}

export function buildAlertLayerFilter(type = 'all', activeField = '') {
  const normalizedType = ['climate', 'pest'].includes(type) ? type : 'all'
  const fieldId = typeof activeField === 'string' ? activeField.trim() : ''
  const filters = []
  if (normalizedType !== 'all') filters.push(['==', ['get', 'risk_type'], normalizedType])
  if (fieldId) filters.push(['==', ['get', 'field_id'], fieldId])
  if (!filters.length) return null
  return filters.length === 1 ? filters[0] : ['all', ...filters]
}

async function loadGeoJson(filename) {
  const response = await fetch(staticUrl(filename))
  if (!response.ok) throw new Error(`GeoJSON 加载失败：${filename} (${response.status})`)
  return response.json()
}

function firstSymbolLayerId() {
  return map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
}

function firstRoadLayerId() {
  return map.getStyle().layers.find((layer) => layer.type === 'line' && /^(highway|road_)/.test(layer.id))?.id || firstSymbolLayerId()
}

function firstNonBackgroundLayerId() {
  return map.getStyle().layers.find((layer) => layer.type !== 'background')?.id
}

function setPaintPropertyIfPresent(layerId, property, value) {
  if (map?.getLayer(layerId)) map.setPaintProperty(layerId, property, value)
}

function applyBasemapContext(profile) {
  const satelliteScale = satelliteVisible ? 0.68 : 1
  for (const layerId of BASEMAP_ROADS) setPaintPropertyIfPresent(layerId, 'line-opacity', profile.roads * satelliteScale)
  for (const layerId of BASEMAP_CONTEXT_LABELS) setPaintPropertyIfPresent(layerId, 'text-opacity', profile.labels * satelliteScale)
}

function applySelectionContext() {
  if (!map) return
  const selectedId = String(selectedMapFeatureId || '')
  const isolateSecurityTarget = currentTopic === 'security' && ['camera', 'fence'].includes(selectedMapFeatureKind) && Boolean(selectedId)
  const isolateMachineryTarget = currentTopic === 'operations' && selectedMapFeatureKind === 'machinery' && Boolean(selectedId)
  const opacityFor = (selectedOpacity, contextOpacity) => selectedFeatureOpacity(selectedId, selectedOpacity, contextOpacity)

  setPaintPropertyIfPresent('farmclaw-camera-status', 'icon-opacity', isolateSecurityTarget ? opacityFor(1, 0.32) : 1)
  setPaintPropertyIfPresent('farmclaw-camera-icon', 'icon-opacity', isolateSecurityTarget ? opacityFor(1, 0.24) : 1)
  for (const layerId of ['farmclaw-camera-label-compact', 'farmclaw-camera-label-detail', 'farmclaw-camera-alert-label']) {
    setPaintPropertyIfPresent(layerId, 'text-opacity', isolateSecurityTarget ? opacityFor(1, 0.18) : 1)
  }
  setPaintPropertyIfPresent('farmclaw-fence-fill', 'fill-opacity', isolateSecurityTarget ? ['case', ['==', ['to-string', ['get', 'id']], selectedId], 0.12, 0.012] : FENCE_FILL_OPACITY)
  setPaintPropertyIfPresent('farmclaw-fence-line', 'line-opacity', isolateSecurityTarget ? opacityFor(0.86, 0.18) : 0.78)
  for (const layerId of ['farmclaw-fence-label', 'farmclaw-fence-alert-label']) {
    setPaintPropertyIfPresent(layerId, 'text-opacity', isolateSecurityTarget ? opacityFor(1, 0.18) : 1)
  }

  setPaintPropertyIfPresent('farmclaw-machinery-status', 'icon-opacity', isolateMachineryTarget ? opacityFor(1, 0.32) : 1)
  setPaintPropertyIfPresent('farmclaw-machinery-icon', 'icon-opacity', isolateMachineryTarget ? opacityFor(1, 0.38) : 1)
  for (const layerId of ['farmclaw-machinery-label-compact', 'farmclaw-machinery-label-detail']) {
    setPaintPropertyIfPresent(layerId, 'text-opacity', isolateMachineryTarget ? opacityFor(1, 0.2) : 1)
  }
}

function addLayersBefore(layers, beforeId) {
  for (const layer of layers) map.addLayer(layer, beforeId)
}

function tuneBaseMap() {
  const paintUpdates = [
    ['background', 'background-color', '#07151d'],
    ['water', 'fill-color', '#0b2029'],
    ['water', 'fill-opacity', 0.84],
    ['landuse_residential', 'fill-color', '#0b171d'],
    ['landuse_residential', 'fill-opacity', 0.64],
    ['landcover_wood', 'fill-color', '#13251f'],
    ['landcover_wood', 'fill-opacity', 0.5],
    ['landuse_park', 'fill-color', '#12241f'],
    ['building', 'fill-color', '#182830'],
    ['building', 'fill-outline-color', '#2b4149'],
    ['highway_path', 'line-color', '#334b52'],
    ['highway_path', 'line-opacity', 0.58],
    ['highway_minor', 'line-color', '#2c4149'],
    ['highway_minor', 'line-opacity', 0.78],
    ['highway_major_casing', 'line-color', '#536e77'],
    ['highway_major_casing', 'line-opacity', 0.56],
    ['highway_major_inner', 'line-color', '#20353d'],
    ['highway_motorway_casing', 'line-color', '#59747d'],
    ['highway_motorway_casing', 'line-opacity', 0.58],
    ['highway_motorway_inner', 'line-color', '#263b43'],
    ['highway_name_other', 'text-color', '#71858a'],
    ['highway_name_other', 'text-halo-color', '#07151d'],
    ['highway_name_motorway', 'text-color', '#829499']
  ]
  for (const [layerId, property, value] of paintUpdates) setPaintPropertyIfPresent(layerId, property, value)
  if (typeof map?.setLight === 'function') {
    map.setLight({ anchor: 'map', color: '#d7eeee', position: [1.45, 145, 34], intensity: 0.52 })
  }
  if (typeof map?.setSky === 'function') {
    map.setSky({
      'sky-color': '#081a22',
      'sky-horizon-blend': 0.18,
      'horizon-color': '#16343a',
      'horizon-fog-blend': 0.12,
      'fog-color': '#07151d',
      'fog-ground-blend': 0.12,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 16, 0.05]
    })
  }
}

function applyMapVisualState() {
  if (!map) return
  const profile = TOPIC_VISUAL_PROFILES[currentTopic] || TOPIC_VISUAL_PROFILES.product
  for (const surface of SURFACE_VISUALS) {
    const satelliteScale = satelliteVisible ? surface.satelliteScale : 1
    setPaintPropertyIfPresent(surface.layer, surface.property, profile[surface.key] * satelliteScale)
    const structureBoost = ['building', 'greenhouse'].includes(surface.key) ? 1.12 : 1
    const outlineOpacity = Math.min(0.92, profile.outlines * structureBoost * (satelliteVisible ? 0.82 : 1))
    setPaintPropertyIfPresent(surface.outline, 'line-opacity', outlineOpacity)
  }

  const satelliteContextScale = satelliteVisible ? 0.64 : 1
  setPaintPropertyIfPresent('farmclaw-building-base', 'fill-opacity', profile.building * 0.44 * satelliteContextScale)
  setPaintPropertyIfPresent('farmclaw-greenhouse-base', 'fill-opacity', profile.greenhouse * 0.52 * satelliteContextScale)
  setPaintPropertyIfPresent('farmclaw-crops', 'icon-opacity', profile.crops)
  setPaintPropertyIfPresent('farmclaw-aquaculture-points', 'icon-opacity', profile.crops)
  setPaintPropertyIfPresent('farmclaw-production', 'icon-opacity', profile.crops)
  setPaintPropertyIfPresent('farmclaw-alert-events', 'icon-opacity', profile.labels)
  for (const layerId of ['farmclaw-machinery-label-compact', 'farmclaw-machinery-label-detail']) setPaintPropertyIfPresent(layerId, 'text-opacity', profile.machinery)
  setPaintPropertyIfPresent('farmclaw-border-casing', 'line-opacity', profile.boundary * 0.42)
  setPaintPropertyIfPresent('farmclaw-border', 'line-opacity', profile.boundary)
  for (const texture of TEXTURE_VISUALS) setPaintPropertyIfPresent(texture.layer, 'fill-opacity', profile.texture * texture.scale * (satelliteVisible ? 0.48 : 1))
  applyBasemapContext(profile)
  applySelectionContext()
}

function addBusinessLayers() {
  const roadAnchorId = firstRoadLayerId()
  const labelAnchorId = firstSymbolLayerId()
  const statusText = ['match', ['get', 'status'], 'alarm', '告警', 'online', '在线', 'offline', '离线', 'maintenance', '维护', 'armed', '已布防', 'disarmed', '已撤防', '未知']
  const securityStatusText = ['case', ['all', ['==', ['get', 'status'], 'alarm'], ['==', ['get', 'controlStatus'], 'disarmed']], '告警 · 已撤防', statusText]
  const selectionStatusColor = ['match', ['get', 'status'], 'alarm', '#ff6577', 'warning', '#f0b95a', 'offline', '#ff6577', 'maintenance', '#f0b95a', 'charging', '#58b9e9', 'standby', '#91a9ad', '#48e4d1']
  const facilityIcon = ['match', ['get', 'facility_type'], 'warehouse', FACILITY_ICON_IDS.warehouse, 'service', FACILITY_ICON_IDS.service, 'inspection', FACILITY_ICON_IDS.inspection, FACILITY_ICON_IDS.generic]
  const commonLabelLayout = {
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 14.8, 12, 17.5, 13],
    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
    'text-radial-offset': 0.9,
    'text-justify': 'auto',
    'text-padding': 6,
    'text-max-width': 9,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-rotation-alignment': 'viewport',
    'text-optional': true
  }
  const commonLabelPaint = {
    'text-color': '#e7f4f3',
    'text-halo-color': '#07151d',
    'text-halo-width': 2.4,
    'text-halo-blur': 0.55
  }
  const geometryLayers = [
    { id: 'farmclaw-water', type: 'fill', source: 'water', paint: { 'fill-color': '#235a70', 'fill-opacity': 0.58 } },
    { id: 'farmclaw-pool', type: 'fill', source: 'pool', paint: { 'fill-color': ['case', ['==', ['to-number', ['get', 'used']], 1], '#29656a', '#21494f'], 'fill-opacity': 0.56 } },
    { id: 'farmclaw-farm', type: 'fill', source: 'farm', paint: { 'fill-color': ['case', ['==', ['to-number', ['get', 'used']], 1], '#476b4d', ['==', ['to-number', ['get', 'used']], 0], '#2e4437', '#395744'], 'fill-opacity': 0.6 } },
    { id: 'farmclaw-pool-texture', type: 'fill', source: 'pool', minzoom: 14.2, paint: { 'fill-pattern': TWIN_PATTERN_IDS.waterRipples, 'fill-opacity': 0.2 } },
    { id: 'farmclaw-farm-texture', type: 'fill', source: 'farm', minzoom: 14.2, paint: { 'fill-pattern': TWIN_PATTERN_IDS.fieldRows, 'fill-opacity': 0.22 } },
    { id: 'farmclaw-green', type: 'fill', source: 'green', paint: { 'fill-color': '#355c42', 'fill-opacity': 0.56 } },
    { id: 'farmclaw-building-base', type: 'fill', source: 'building', paint: { 'fill-color': '#1b2c33', 'fill-opacity': 0.38 } },
    { id: 'farmclaw-building', type: 'fill-extrusion', source: 'building', paint: { 'fill-extrusion-color': '#9bb0b7', 'fill-extrusion-height': 13, 'fill-extrusion-base': 0.6, 'fill-extrusion-opacity': 0.86, 'fill-extrusion-vertical-gradient': true } },
    { id: 'farmclaw-greenhouse-base', type: 'fill', source: 'greenhouse', paint: { 'fill-color': '#255150', 'fill-opacity': 0.34 } },
    { id: 'farmclaw-greenhouse', type: 'fill-extrusion', source: 'greenhouse', paint: { 'fill-extrusion-color': '#75a4a3', 'fill-extrusion-height': 8, 'fill-extrusion-base': 0.35, 'fill-extrusion-opacity': 0.64, 'fill-extrusion-vertical-gradient': true } },
    { id: 'farmclaw-water-outline', type: 'line', source: 'water', paint: { 'line-color': '#73a8b8', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 1.7], 'line-opacity': 0.72 } },
    { id: 'farmclaw-pool-outline', type: 'line', source: 'pool', paint: { 'line-color': '#68a09c', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.7, 18, 1.5], 'line-opacity': 0.68 } },
    { id: 'farmclaw-farm-outline', type: 'line', source: 'farm', paint: { 'line-color': '#759078', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.55, 18, 1.25], 'line-opacity': 0.58 } },
    { id: 'farmclaw-green-outline', type: 'line', source: 'green', paint: { 'line-color': '#73947a', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 1.35], 'line-opacity': 0.6 } },
    { id: 'farmclaw-building-footprint', type: 'line', source: 'building', paint: { 'line-color': '#c1d1d5', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.65, 18, 1.45], 'line-opacity': 0.8 } },
    { id: 'farmclaw-greenhouse-footprint', type: 'line', source: 'greenhouse', paint: { 'line-color': '#acd0cc', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.75, 18, 1.6], 'line-opacity': 0.78 } },
    { id: 'farmclaw-fence-fill', type: 'fill', source: 'security', filter: ['==', ['get', 'kind'], 'fence'], layout: { visibility: 'none' }, paint: { 'fill-color': ['match', ['get', 'status'], 'armed', '#74d99f', 'alarm', '#ff6577', '#8a99a6'], 'fill-opacity': FENCE_FILL_OPACITY } },
    { id: 'farmclaw-fence-line', type: 'line', source: 'security', filter: ['==', ['get', 'kind'], 'fence'], layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'status'], 'armed', '#56f7e8', 'alarm', '#ff4d5f', '#8a99a6'], 'line-width': ['interpolate', ['linear'], ['zoom'], 14, ['match', ['get', 'level'], 'critical', 1.25, 'high', 1.05, 0.82], 18, ['match', ['get', 'level'], 'critical', 1.75, 'high', 1.45, 1.15]], 'line-opacity': 0.7, 'line-dasharray': ['match', ['get', 'status'], 'alarm', ['literal', [2.4, 1.8]], 'armed', ['literal', [1.7, 2.1]], ['literal', [0.55, 2.8]]] } },
    { id: 'farmclaw-camera-cone', type: 'fill', source: 'camera-focus', layout: { visibility: 'none' }, paint: { 'fill-color': '#56f7e8', 'fill-opacity': 0.2, 'fill-outline-color': '#8afff3' } },
    { id: 'farmclaw-selection-fill', type: 'fill', source: 'map-selection', filter: ['==', ['get', 'selection_anchor'], false], layout: { visibility: 'none' }, paint: { 'fill-color': '#48e4d1', 'fill-opacity': 0.08 } },
    { id: 'farmclaw-selection-line', type: 'line', source: 'map-selection', filter: ['==', ['get', 'selection_anchor'], false], layout: { visibility: 'none' }, paint: { 'line-color': selectionStatusColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 1.6], 'line-opacity': 0.52, 'line-dasharray': [2.2, 2.2] } },
    { id: 'farmclaw-risk', type: 'heatmap', source: 'fertility', layout: { visibility: 'none' }, paint: { 'heatmap-weight': ['interpolate', ['linear'], ['to-number', ['get', 'weight']], 0, 0, 100, 1], 'heatmap-intensity': 1.3, 'heatmap-radius': 26, 'heatmap-opacity': 0.4, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.25, '#56f7e8', 0.55, '#ffe36b', 0.8, '#ff8a4c', 1, '#ff4d5f'] } },
    { id: 'farmclaw-climate-risk', type: 'heatmap', source: 'alert-risk', filter: buildAlertLayerFilter('climate', currentAlertField), layout: { visibility: 'none' }, paint: { 'heatmap-weight': ['interpolate', ['linear'], ['to-number', ['get', 'risk_score']], 0, 0, 100, 1], 'heatmap-intensity': 1.4, 'heatmap-radius': 32, 'heatmap-opacity': 0.42, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.22, '#58b9e9', 0.5, '#56f7e8', 0.78, '#ffe36b', 1, '#ff7a45'] } },
    { id: 'farmclaw-pest-risk', type: 'heatmap', source: 'alert-risk', filter: buildAlertLayerFilter('pest', currentAlertField), layout: { visibility: 'none' }, paint: { 'heatmap-weight': ['interpolate', ['linear'], ['to-number', ['get', 'risk_score']], 0, 0, 100, 1], 'heatmap-intensity': 1.45, 'heatmap-radius': 30, 'heatmap-opacity': 0.44, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.22, '#b78cff', 0.5, '#ffae57', 0.78, '#ff6b5f', 1, '#ff3f69'] } },
    { id: 'farmclaw-alert-events', type: 'symbol', source: 'alert-events', filter: buildAlertLayerFilter('all', currentAlertField), layout: { visibility: 'none', 'icon-image': ['match', ['get', 'risk_type'], 'pest', FACILITY_ICON_IDS['alert-pest'], FACILITY_ICON_IDS['alert-climate']], 'icon-size': ['interpolate', ['linear'], ['to-number', ['get', 'risk_score']], 0, 0.72, 100, 1.02], 'icon-allow-overlap': false, 'icon-ignore-placement': false, 'icon-pitch-alignment': 'viewport', 'symbol-sort-key': ['-', 100, ['to-number', ['get', 'risk_score']]] }, paint: { 'icon-opacity': 0.9 } },
    { id: 'farmclaw-production', type: 'symbol', source: 'production', minzoom: 15.8, layout: { visibility: 'none', 'icon-image': ['match', ['get', 'industry'], 'crop', FACILITY_ICON_IDS['value-crop'], 'aquaculture', FACILITY_ICON_IDS['value-aquaculture'], FACILITY_ICON_IDS['field-label']], 'icon-size': ['interpolate', ['linear'], ['zoom'], 15.8, 0.56, 17.5, 0.9], 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-pitch-alignment': 'viewport', 'symbol-sort-key': 3 }, paint: { 'icon-opacity': ['match', ['get', 'band'], 'high', 0.94, 'stable', 0.76, 0.52] } },
    { id: 'farmclaw-crops', type: 'symbol', source: 'crop', minzoom: 14.8, filter: ['all', ['has', 'crop'], ['==', ['to-number', ['get', 'used']], 1]], layout: { visibility: 'none', 'icon-image': FACILITY_ICON_IDS['crop-point'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 14.8, 0.58, 17.5, 0.92], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport', 'symbol-sort-key': 5 }, paint: { 'icon-opacity': 0.82 } },
    { id: 'farmclaw-aquaculture-points', type: 'symbol', source: 'pool-center', minzoom: 14.8, filter: ['has', 'crop'], layout: { visibility: 'none', 'icon-image': FACILITY_ICON_IDS['aquaculture-point'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 14.8, 0.58, 17.5, 0.92], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport', 'symbol-sort-key': 5 }, paint: { 'icon-opacity': 0.82 } },
    { id: 'farmclaw-drone-path-casing', type: 'line', source: 'drone-path', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#07151d', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.28, 18, 1.86], 'line-opacity': 0.46 } },
    { id: 'farmclaw-drone-path', type: 'line', source: 'drone-path', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffe36b', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.52, 18, 0.82], 'line-opacity': 0.78, 'line-dasharray': [1.15, 2.55] } },
    { id: 'farmclaw-invade-path-casing', type: 'line', source: 'invade-path', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#07151d', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 2.12], 'line-opacity': 0.5 } },
    { id: 'farmclaw-invade-path', type: 'line', source: 'invade-path', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff4d5f', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.62, 18, 0.94], 'line-opacity': 0.82, 'line-dasharray': [1.7, 2.15] } },
    { id: 'farmclaw-border-casing', type: 'line', source: 'border', paint: { 'line-color': '#07151d', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 3.2, 18, 5.8], 'line-opacity': 0.2 } },
    { id: 'farmclaw-border', type: 'line', source: 'border', paint: { 'line-color': '#9bb6b7', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 1.5], 'line-opacity': 0.44, 'line-dasharray': [4.5, 2.8] } }
  ]
  const labelLayers = [
    { id: 'farmclaw-server-icon', type: 'symbol', source: 'server', minzoom: 13, layout: { visibility: 'none', 'icon-image': facilityIcon, 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.65, 18, 1], 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'symbol-sort-key': 8 } },
    { id: 'farmclaw-camera-icon', type: 'symbol', source: 'security', minzoom: 13, filter: ['==', ['get', 'kind'], 'camera'], layout: { visibility: 'none', 'icon-image': FACILITY_ICON_IDS.camera, 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.65, 18, 0.95], 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'symbol-sort-key': 6 } },
    { id: 'farmclaw-fence-icon', type: 'symbol', source: 'security', minzoom: 13, filter: ['==', ['get', 'kind'], 'fence'], layout: { visibility: 'none', 'icon-image': FACILITY_ICON_IDS.fence, 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.62, 18, 0.9], 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'symbol-sort-key': 7 }, paint: { 'icon-opacity': ['match', ['get', 'status'], 'alarm', 1, 'disarmed', 0.52, 0.86] } },
    { id: 'farmclaw-machinery-icon', type: 'symbol', source: 'machinery', minzoom: 13, layout: { visibility: 'none', 'icon-image': ['match', ['get', 'machinery_type'], 'tractor', MACHINERY_ICON_IDS.tractor, 'harvester', MACHINERY_ICON_IDS.harvester, 'sprayer', MACHINERY_ICON_IDS.sprayer, 'seeder', MACHINERY_ICON_IDS.seeder, 'rover', MACHINERY_ICON_IDS.rover, 'mower', MACHINERY_ICON_IDS.mower, 'transporter', MACHINERY_ICON_IDS.transporter, FACILITY_ICON_IDS.generic], 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.75, 17.5, 1.1], 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'symbol-sort-key': 14 } },
    { id: 'farmclaw-camera-status', type: 'symbol', source: 'security', minzoom: 13, filter: ['==', ['get', 'kind'], 'camera'], layout: { visibility: 'none', 'icon-image': assetStatusImageExpression('status'), 'icon-size': 0.55, 'icon-offset': [24, 24], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport' } },
    { id: 'farmclaw-machinery-status', type: 'symbol', source: 'machinery', minzoom: 13, layout: { visibility: 'none', 'icon-image': assetStatusImageExpression('machinery_status'), 'icon-size': 0.6, 'icon-offset': [28, 24], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport' } },
    { id: 'farmclaw-machinery-label-compact', type: 'symbol', source: 'machinery', minzoom: 14.6, maxzoom: 16.2, layout: { visibility: 'none', ...commonLabelLayout, 'text-radial-offset': 2.6, 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'status_label'], ' · ', ['get', 'freshness_label']], 'text-size': 11, 'text-max-width': 10, 'symbol-sort-key': 14 }, paint: commonLabelPaint },
    { id: 'farmclaw-machinery-label-detail', type: 'symbol', source: 'machinery', minzoom: 16.2, layout: { visibility: 'none', ...commonLabelLayout, 'text-radial-offset': 2.8, 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'status_label'], ' · ', ['to-string', ['get', 'task_progress']], '% · ', ['get', 'freshness_label']], 'symbol-sort-key': 14 }, paint: commonLabelPaint },
    { id: 'farmclaw-field-label-anchor', type: 'symbol', source: 'business-labels', minzoom: 14.6, filter: ['==', ['get', 'scope'], 'product'], layout: { visibility: 'none', 'icon-image': ['match', ['get', 'industry'], 'aquaculture', FACILITY_ICON_IDS['aquaculture-point'], FACILITY_ICON_IDS['field-label']], 'icon-size': 0.56, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport' } },
    { id: 'farmclaw-field-label-compact', type: 'symbol', source: 'business-labels', minzoom: 14.6, maxzoom: 15.8, filter: ['==', ['get', 'scope'], 'product'], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['get', 'title'], 'text-size': 12, 'text-max-width': 7, 'symbol-sort-key': ['get', 'priority'] }, paint: commonLabelPaint },
    { id: 'farmclaw-field-label-detail', type: 'symbol', source: 'business-labels', minzoom: 15.8, filter: ['==', ['get', 'scope'], 'product'], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'title'], '\n', ['get', 'detail']], 'symbol-sort-key': ['get', 'priority'] }, paint: commonLabelPaint },
    { id: 'farmclaw-value-label-anchor', type: 'symbol', source: 'business-labels', minzoom: 14.6, filter: ['==', ['get', 'scope'], 'value'], layout: { visibility: 'none', 'icon-image': ['match', ['get', 'industry'], 'aquaculture', FACILITY_ICON_IDS['value-aquaculture'], FACILITY_ICON_IDS['value-crop']], 'icon-size': 0.62, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport' } },
    { id: 'farmclaw-value-label-compact', type: 'symbol', source: 'business-labels', minzoom: 14.6, maxzoom: 15.8, filter: ['==', ['get', 'scope'], 'value'], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'title'], '  指数 ', ['to-string', ['round', ['get', 'average']]]], 'text-size': 12, 'text-max-width': 10, 'symbol-sort-key': ['get', 'priority'] }, paint: commonLabelPaint },
    { id: 'farmclaw-value-label-detail', type: 'symbol', source: 'business-labels', minzoom: 15.8, filter: ['==', ['get', 'scope'], 'value'], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'title'], '\n', ['get', 'detail']], 'symbol-sort-key': ['get', 'priority'] }, paint: commonLabelPaint },
    { id: 'farmclaw-server-label', type: 'symbol', source: 'server', minzoom: 14.8, layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'department']], 'symbol-sort-key': 20 }, paint: commonLabelPaint },
    { id: 'farmclaw-fence-label', type: 'symbol', source: 'security-labels', minzoom: 15.5, filter: ['all', ['==', ['get', 'kind'], 'fence'], ['!=', ['get', 'status'], 'alarm']], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'name'], '\n', securityStatusText], 'symbol-sort-key': 10 }, paint: commonLabelPaint },
    { id: 'farmclaw-camera-label-compact', type: 'symbol', source: 'security', minzoom: 15.2, maxzoom: 16.3, filter: ['all', ['==', ['get', 'kind'], 'camera'], ['==', ['get', 'status'], 'online']], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['get', 'name'], 'text-size': 12, 'text-max-width': 7, 'symbol-sort-key': 12 }, paint: commonLabelPaint },
    { id: 'farmclaw-camera-label-detail', type: 'symbol', source: 'security', minzoom: 16.3, filter: ['all', ['==', ['get', 'kind'], 'camera'], ['==', ['get', 'status'], 'online']], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'name'], '\n', statusText], 'symbol-sort-key': 12 }, paint: commonLabelPaint },
    { id: 'farmclaw-fence-alert-label', type: 'symbol', source: 'security-labels', minzoom: 14.2, filter: ['all', ['==', ['get', 'kind'], 'fence'], ['==', ['get', 'status'], 'alarm']], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'name'], '\n▲ ', securityStatusText], 'text-allow-overlap': true, 'symbol-sort-key': 0 }, paint: { ...commonLabelPaint, 'text-color': '#ff6577' } },
    { id: 'farmclaw-camera-alert-label', type: 'symbol', source: 'security', minzoom: 14.2, filter: ['all', ['==', ['get', 'kind'], 'camera'], ['!=', ['get', 'status'], 'online']], layout: { visibility: 'none', ...commonLabelLayout, 'text-field': ['concat', ['get', 'name'], '\n▲ ', statusText], 'text-allow-overlap': true, 'symbol-sort-key': 0 }, paint: { ...commonLabelPaint, 'text-color': ['match', ['get', 'status'], 'alarm', '#ff6577', 'offline', '#91a9ad', '#f0b95a'] } }
  ]

  // 地表材质位于道路下方；建筑、边界位于道路与底图标注之间；状态与选中反馈保持在最上层。
  const structureLayerIds = new Set([
    'farmclaw-building-base',
    'farmclaw-building',
    'farmclaw-building-footprint',
    'farmclaw-greenhouse-base',
    'farmclaw-greenhouse',
    'farmclaw-greenhouse-footprint'
  ])
  const boundaryLayerIds = new Set([
    'farmclaw-border-casing',
    'farmclaw-border',
    'farmclaw-fence-fill',
    'farmclaw-fence-line'
  ])
  const statusLayerIds = new Set([
    'farmclaw-camera-cone',
    'farmclaw-selection-fill',
    'farmclaw-selection-line',
    'farmclaw-alert-events',
    'farmclaw-production',
    'farmclaw-crops',
    'farmclaw-aquaculture-points',
    'farmclaw-drone-path',
    'farmclaw-invade-path'
  ])
  const heatmapLayers = geometryLayers.filter((layer) => layer.type === 'heatmap')
  const boundaryGeometryLayers = geometryLayers.filter((layer) => boundaryLayerIds.has(layer.id))
  const structureGeometryLayers = geometryLayers.filter((layer) => structureLayerIds.has(layer.id))
  const foregroundGeometryLayers = geometryLayers.filter((layer) => statusLayerIds.has(layer.id))
  const reservedLayerIds = new Set([
    ...heatmapLayers.map((layer) => layer.id),
    ...boundaryGeometryLayers.map((layer) => layer.id),
    ...structureGeometryLayers.map((layer) => layer.id),
    ...foregroundGeometryLayers.map((layer) => layer.id)
  ])
  const groundGeometryLayers = geometryLayers.filter((layer) => !reservedLayerIds.has(layer.id))
  addLayersBefore(groundGeometryLayers, roadAnchorId)
  addLayersBefore(structureGeometryLayers, labelAnchorId)
  addLayersBefore(heatmapLayers, labelAnchorId)
  addLayersBefore(boundaryGeometryLayers, labelAnchorId)
  for (const layer of foregroundGeometryLayers) map.addLayer(layer)
  for (const layer of labelLayers) {
    // 具象图标比旧圆点更大，设施和摄像头名称需要为轮廓及状态角标留白。
    if (['server', 'security'].includes(layer.source) && layer.layout['text-field']) {
      layer.layout['text-radial-offset'] = 2.5
    }
    map.addLayer(layer)
  }
}

function syncMobileAttribution() {
  const attribution = map?.getContainer()?.querySelector('details.maplibregl-ctrl-attrib')
  if (!attribution) return
  if (globalThis.window?.innerWidth <= 600) {
    if (attribution.dataset.farmclawCompact !== 'true') {
      attribution.open = false
      attribution.dataset.farmclawCompact = 'true'
    }
  } else {
    delete attribution.dataset.farmclawCompact
  }
}

function flattenLineCoordinates(geojson) {
  const geometry = geojson.features?.[0]?.geometry
  if (!geometry) return []
  if (geometry.type === 'LineString') return geometry.coordinates
  if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
  return []
}

function buildSecurityLabelData() {
  return {
    type: 'FeatureCollection',
    features: (securityData?.features || []).filter((feature) => feature.properties?.kind === 'fence').map((feature) => ({
      type: 'Feature',
      id: `${feature.properties.id}-label`,
      properties: { ...feature.properties },
      geometry: { type: 'Point', coordinates: geometryCenter(feature.geometry) }
    }))
  }
}

// 围栏的控制状态与未确认告警是两条独立语义：撤防不能抹掉尚未确认的事件。
// status 始终提供给地图和列表作为视觉状态，controlStatus 只记录本地演示的布撤防状态。
function syncFenceVisualStatus(feature) {
  if (feature?.properties?.kind !== 'fence') return
  const properties = feature.properties
  if (!properties.controlStatus) properties.controlStatus = properties.status === 'disarmed' ? 'disarmed' : 'armed'
  const incidentCount = Number(properties.incidents) || 0
  const unresolvedAlarm = properties.status === 'alarm' && !properties.acknowledged_at
  properties.status = incidentCount > 0 || unresolvedAlarm ? 'alarm' : properties.controlStatus
}

export async function initFreeMap({ dom, center = DEFAULT_CENTER, zoom = DEFAULT_CAMERA.zoom, pitch = DEFAULT_CAMERA.pitch, bearing = DEFAULT_CAMERA.bearing } = {}) {
  if (!dom) throw new Error('缺少地图容器')
  const style = import.meta.env.VITE_MAP_STYLE_URL?.trim() || DEFAULT_STYLE

  map = new maplibregl.Map({
    container: dom,
    style,
    center,
    zoom,
    pitch,
    bearing,
    antialias: true,
    attributionControl: { compact: true }
  })
  syncFreeMapViewport()
  map.on('movestart', (event) => { if (event.originalEvent) overviewMode = false })
  map.on('pitchend', () => mapViewChangeHandler?.(map.getPitch() > 1 ? '3d' : '2d'))
  if (globalThis.window?.addEventListener) {
    viewportResizeHandler = () => {
      syncFreeMapViewport()
      syncMobileAttribution()
    }
    globalThis.window.addEventListener('resize', viewportResizeHandler, { passive: true })
  }

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  requestAnimationFrame(syncMobileAttribution)
  map.on('styleimagemissing', (event) => {
    // 受控设施图标必须由 registry 完整注册，不能被透明占位图静默吞掉。
    if (String(event.id).startsWith('farmclaw-facility-') || String(event.id).startsWith('farmclaw-asset-')) return
    if (!map.hasImage(event.id)) {
      map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) })
    }
  })

  await new Promise((resolve, reject) => {
    let lastError = ''
    const timeout = setTimeout(() => reject(new Error(`免费地图加载超时，请检查网络或 VITE_MAP_STYLE_URL${lastError ? `：${lastError}` : ''}`)), 25000)
    map.once('load', () => {
      clearTimeout(timeout)
      resolve()
    })
    map.on('error', (event) => {
      lastError = event.error?.message || '未知错误'
    })
  })
  tuneBaseMap()
  registerTwinPatternImages(map)

  const datasets = await Promise.all(SOURCE_DEFINITIONS.map(async ([id, filename]) => {
    const data = await loadGeoJson(filename)
    if (TWIN_OBJECT_SOURCE_IDS.includes(id)) {
      enrichTwinGeoJson(id, data)
      twinSourceData.set(id, data)
    }
    if (id === 'fertility') {
      data.features = data.features.filter((feature) => feature.properties?.weight != null && Number.isFinite(Number(feature.properties.weight)))
    }
    if (id === 'production') {
      data.features = data.features.filter((feature) => feature.properties?.value != null && Number.isFinite(Number(feature.properties.value)))
    }
    if (id === 'security') {
      data.features = data.features.filter((feature) => feature.properties?.id && ['fence', 'camera'].includes(feature.properties?.kind))
      data.features.forEach((feature) => {
        feature.id = feature.properties.id
        syncFenceVisualStatus(feature)
      })
      securityData = data
    }
    if (id === 'server') {
      data.features = data.features.filter((feature) => feature.geometry?.type === 'Point' && feature.properties?.name)
      data.features.forEach((feature) => {
        feature.properties.facility_type = classifyFacility(feature.properties)
      })
    }
    return [id, ['drone-path', 'invade-path'].includes(id) ? smoothLineGeoJson(data) : data]
  }))
  const productionEntry = datasets.find(([id]) => id === 'production')
  valueForecastModel = buildValueForecastModel(
    productionEntry?.[1],
    datasets.find(([id]) => id === 'crop')?.[1],
    datasets.find(([id]) => id === 'pool-center')?.[1],
    datasets.find(([id]) => id === 'farm')?.[1],
    datasets.find(([id]) => id === 'pool')?.[1]
  )
  if (productionEntry) productionEntry[1] = valueForecastModel.geojson
  const businessLabelData = buildBusinessLabelData({
    cropData: datasets.find(([id]) => id === 'crop')?.[1],
    aquacultureData: datasets.find(([id]) => id === 'pool-center')?.[1],
    valueForecastModel
  })
  workspaceSourceData = new Map(datasets)
  workspaceSourceData.set('business-labels', businessLabelData)
  workspaceSourceData.set('alert-events', buildAlertEventData(workspaceSourceData.get('alert-risk')))
  machineryData = buildMachineryGeoJson()
  for (const [id, data] of datasets) map.addSource(id, { type: 'geojson', data })
  map.addSource('machinery', { type: 'geojson', data: machineryData })
  map.addSource('business-labels', { type: 'geojson', data: businessLabelData })
  map.addSource('alert-events', { type: 'geojson', data: workspaceSourceData.get('alert-events') })
  map.addSource('overview-labels', { type: 'geojson', data: buildOverviewLabels(workspaceSourceData) })
  map.addSource('security-labels', { type: 'geojson', data: buildSecurityLabelData() })
  map.addSource('camera-focus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('map-selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('satellite', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  })
  map.addLayer({
    id: 'farmclaw-satellite',
    type: 'raster',
    source: 'satellite',
    layout: { visibility: 'none' },
    paint: {
      'raster-opacity': 0.76,
      'raster-saturation': -0.46,
      'raster-contrast': 0.2,
      'raster-brightness-min': 0.06,
      'raster-brightness-max': 0.68,
      'raster-fade-duration': 180,
      'raster-resampling': 'linear'
    }
  }, firstNonBackgroundLayerId())
  await registerFacilityIcons(map)
  droneCoordinates = flattenLineCoordinates(datasets.find(([id]) => id === 'drone-path')?.[1])
  invadeCoordinates = flattenLineCoordinates(datasets.find(([id]) => id === 'invade-path')?.[1])
  addBusinessLayers()
  map.addLayer({
    id: 'farmclaw-overview-labels', type: 'symbol', source: 'overview-labels', maxzoom: 14.6,
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 13,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1, 'text-padding': 12 },
    paint: { 'text-color': '#e7f4f3', 'text-halo-color': '#263630', 'text-halo-width': 2 }
  })
  bindSecurityInteractions()
  bindBusinessInteractions()
  setFreeTopic('product')
  overviewMode = true
  fitWorkspaceOverview(0)

  return map
}

export function destroyFreeMap() {
  cancelAnimationFrame(droneAnimationFrame)
  droneMarker?.remove()
  invadePopup?.remove()
  securityPopup?.remove()
  businessPopup?.remove()
  droneMarker = null
  invadePopup = null
  securityPopup = null
  businessPopup = null
  droneActive = false
  invadeActive = false
  securitySelectionHandler = null
  machinerySelectionHandler = null
  securityData = null
  machineryData = null
  valueForecastModel = null
  selectedMapFeatureId = null
  selectedMapFeatureKind = null
  twinSourceData.clear()
  workspaceSourceData.clear()
  objectSelectionHandler = undefined
  workspaceSelectionFeature = null
  setTwinPopupFocus(false)
  if (viewportResizeHandler && globalThis.window?.removeEventListener) {
    globalThis.window.removeEventListener('resize', viewportResizeHandler)
  }
  viewportResizeHandler = null
  map?.remove()
  map = null
  mapPresentationMode = false
  workspaceLayout = {}
  mapViewChangeHandler = undefined
  satelliteVisible = false
  currentAlertType = 'all'
  currentAlertField = 'greenhouse-1'
  currentMachineryStatus = 'all'
}

function setLogicalVisibility(logicalId, visible) {
  for (const layerId of LOGICAL_LAYERS[logicalId] || []) {
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }
}

export function setFreeTopic(topic) {
  if (!map || !TOPICS[topic]) return
  currentTopic = topic
  const visibleLayers = new Set(TOPICS[topic])
  Object.keys(LOGICAL_LAYERS).forEach((logicalId) => {
    if (logicalId === 'invadeLayer' || logicalId === 'satelliteLayer') return
    let visible = visibleLayers.has(logicalId)
    if (logicalId === 'fenceLayer') visible = visible && fencesVisible
    if (logicalId === 'cameraLayer') visible = visible && camerasVisible
    setLogicalVisibility(logicalId, visible)
  })
  if (topic !== 'security') clearCameraFocus()
  clearMapSelection()
  businessPopup?.remove()
  businessPopup = null
  setTwinPopupFocus(false)
  // 运营面板按 v-if 重建并从“全部农机”开始，地图筛选同步复位，避免再次进入时口径错位。
  if (topic === 'operations') setMachineryFilter('all')
  if (topic === 'alerts') setFreeAlertType('all', currentAlertField)
  applyMapVisualState()
}

export function setFreeAlertType(type = 'all', activeField = currentAlertField) {
  if (!map) return
  currentAlertType = ['all', 'climate', 'pest'].includes(type) ? type : 'all'
  const fieldId = typeof activeField === 'string' ? activeField.trim() : ''
  if (fieldId) currentAlertField = fieldId
  for (const [layerId, layerType] of [
    ['farmclaw-climate-risk', 'climate'],
    ['farmclaw-pest-risk', 'pest'],
    ['farmclaw-alert-events', 'all']
  ]) {
    if (map.getLayer(layerId)) map.setFilter(layerId, buildAlertLayerFilter(layerType, currentAlertField))
  }
  // “全部”使用离散事件点，避免气候与虫害两张热力图叠加后产生不可解释的混色。
  const showClimate = currentAlertType === 'climate'
  const showPest = currentAlertType === 'pest'
  const showEvents = currentAlertType === 'all'
  for (const [id, visible] of [
    ['climateRiskLayer', showClimate],
    ['pestRiskLayer', showPest],
    ['alertEventLayer', showEvents]
  ]) setLogicalVisibility(id, visible && currentTopic === 'alerts')
}

export function setFreeSatelliteVisible(visible) {
  if (!map?.getLayer('farmclaw-satellite')) return false
  const nextVisible = Boolean(visible)
  satelliteVisible = nextVisible
  map.setLayoutProperty('farmclaw-satellite', 'visibility', nextVisible ? 'visible' : 'none')
  applyMapVisualState()
  return nextVisible
}

export function getFreeSatelliteVisible() {
  return satelliteVisible
}

export function getValueForecastModel() {
  return valueForecastModel
}

function machineryFeatureById(machineId) {
  const targetId = String(machineId || '')
  return machineryData?.features?.find((feature) => [feature.properties?.id, feature.properties?.twinId, feature.properties?.twin_id, feature.id].some((id) => String(id || '') === targetId)) || null
}

function cloneMachineryFeature(feature) {
  if (!feature) return null
  return {
    ...feature.properties,
    coordinates: feature.geometry?.type === 'Point' ? [...feature.geometry.coordinates] : null
  }
}

/**
 * 更新农机孪生点位。调用方可传入看板模型；地图只更新独立 GeoJSON source，
 * 不重新计算农田、建筑等静态空间对象，便于后续接入高频 GPS 遥测。
 */
export function setMachineryData(machinery) {
  machineryData = machinery?.type === 'FeatureCollection' ? machinery : machinery ? buildMachineryGeoJson(machinery) : buildMachineryGeoJson()
  map?.getSource('machinery')?.setData(machineryData)
  setMachineryFilter(currentMachineryStatus)
  return machineryData
}

export function setMachineryFilter(status = 'all') {
  const normalized = ['all', 'running', 'standby', 'charging', 'warning', 'offline'].includes(status) ? status : 'all'
  currentMachineryStatus = normalized
  const filter = normalized === 'all' ? null : ['==', ['get', 'machinery_status'], normalized]
  for (const layerId of MACHINERY_INTERACTIVE_LAYERS) {
    if (map?.getLayer(layerId)) map.setFilter(layerId, filter)
  }

  if (selectedMapFeatureKind === 'machinery') {
    const selected = machineryFeatureById(selectedMapFeatureId)
    if (!selected || (normalized !== 'all' && selected.properties?.machinery_status !== normalized)) {
      businessPopup?.remove()
      businessPopup = null
      clearMapSelection()
      machinerySelectionHandler?.(null)
    }
  }
  return normalized
}

export function onMachinerySelect(handler) {
  machinerySelectionHandler = typeof handler === 'function' ? handler : null
}

export function setValueForecastFilter({ industry = 'all', category = 'all' } = {}) {
  if (!map?.getLayer('farmclaw-production')) return
  const dataFilters = []
  if (industry !== 'all') dataFilters.push(['==', ['get', 'industry'], industry])
  if (category !== 'all') dataFilters.push(['==', ['get', 'category'], category])
  const pointFilter = dataFilters.length === 0 ? null : dataFilters.length === 1 ? dataFilters[0] : ['all', ...dataFilters]
  const labelFilter = ['all', ['==', ['get', 'scope'], 'value'], ...dataFilters]
  map.setFilter('farmclaw-production', pointFilter)
  for (const layerId of ['farmclaw-value-label-anchor', 'farmclaw-value-label-compact', 'farmclaw-value-label-detail']) {
    if (map.getLayer(layerId)) map.setFilter(layerId, labelFilter)
  }
}

export function freeMapGoToCenter() {
  clearWorkspaceSelection()
  overviewMode = true
  fitWorkspaceOverview()
}

export function onFreeMapViewChange(handler) {
  mapViewChangeHandler = handler
  handler?.(map && map.getPitch() <= 1 ? '2d' : '3d')
}

export function setFreeMapView(view) {
  if (!map || !['2d', '3d'].includes(view)) return
  overviewMode = false
  map.easeTo({ pitch: view === '2d' ? 0 : DEFAULT_CAMERA.pitch, duration: 650 })
}

export function resizeFreeMap({ presentation, ...layout } = {}) {
  if (typeof presentation === 'boolean') mapPresentationMode = presentation
  workspaceLayout = { ...workspaceLayout, ...layout }
  syncFreeMapViewport()
  syncMobileAttribution()
}

function createDroneMarker() {
  const element = document.createElement('div')
  element.setAttribute('aria-label', '巡航无人机')
  Object.assign(element.style, {
    width: '32px',
    height: '32px',
    background: `url("${facilityIconDataUri('drone')}") center / contain no-repeat`
  })
  return new maplibregl.Marker({ element, rotationAlignment: 'map' })
}

export function toggleFreeDrone() {
  if (!map || droneCoordinates.length < 2) return false
  droneActive = !droneActive
  setLogicalVisibility('dronPathLayer', droneActive)

  if (!droneActive) {
    cancelAnimationFrame(droneAnimationFrame)
    droneMarker?.remove()
    droneMarker = null
    return false
  }

  droneMarker = droneMarker || createDroneMarker()
  droneMarker.setLngLat(droneCoordinates[0]).addTo(map)
  const startedAt = performance.now()
  const duration = 18000

  function animate(now) {
    if (!droneActive) return
    const progress = ((now - startedAt) % duration) / duration
    const scaled = progress * (droneCoordinates.length - 1)
    const index = Math.min(Math.floor(scaled), droneCoordinates.length - 2)
    const local = scaled - index
    const from = droneCoordinates[index]
    const to = droneCoordinates[index + 1]
    droneMarker.setLngLat([
      from[0] + (to[0] - from[0]) * local,
      from[1] + (to[1] - from[1]) * local
    ])
    droneAnimationFrame = requestAnimationFrame(animate)
  }

  droneAnimationFrame = requestAnimationFrame(animate)
  return true
}

export function toggleFreeInvade() {
  if (!map) return false
  invadeActive = !invadeActive
  setLogicalVisibility('invadeLayer', invadeActive)
  if (invadeActive && invadeCoordinates.length) {
    invadePopup?.remove()
    invadePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
      .setLngLat(invadeCoordinates[Math.floor(invadeCoordinates.length / 2)])
      .setHTML('<strong style="color:#b91c1c">越界告警</strong><br><span>检测到边界异常轨迹</span>')
      .addTo(map)
  } else {
    invadePopup?.remove()
    invadePopup = null
  }
  return invadeActive
}

function getFeatureById(featureId) {
  return securityData?.features.find((feature) => feature.properties.id === featureId)
}

function twinFeatureById(twinId) {
  const normalized = String(twinId || '').trim()
  if (!normalized) return null
  for (const [sourceId, data] of twinSourceData) {
    const feature = data?.features?.find((candidate) => String(candidate.properties?.twin_id || candidate.id) === normalized)
    if (feature) return { sourceId, data, feature }
  }
  return null
}

export function setTwinObservationData(twinId, payload = {}) {
  return setTwinObservationBatch([{ ...payload, twin_id: twinId }])[0] || null
}

export function setTwinObservationBatch(observations = []) {
  const affectedSources = new Map()
  const updated = []
  let selectedFeature = null
  for (const payload of Array.isArray(observations) ? observations : []) {
    const twinId = String(payload?.twin_id || payload?.twinId || '').trim()
    const located = twinFeatureById(twinId)
    if (!located) continue
    applyTwinObservationUpdate(located.feature.properties, payload, twinObservationUpdateMode(payload))
    if (!located.feature.properties.observation_source) located.feature.properties.observation_source = 'farmclaw-gateway'
    affectedSources.set(located.sourceId, located.data)
    if (String(selectedMapFeatureId) === twinId && (businessPopup || workspaceSelectionFeature)) selectedFeature = located.feature
    updated.push(buildTwinObservation(located.feature.properties, twinObservationOptions()))
  }
  for (const [sourceId, data] of affectedSources) map?.getSource(sourceId)?.setData(data)
  if (selectedFeature) showBusinessPopup(selectedFeature)
  return updated
}

export function focusTwinObject(twinId) {
  const located = twinFeatureById(twinId)
  if (!located || !map) return null
  overviewMode = false
  const center = geometryCenter(located.feature.geometry)
  map.easeTo({ center, zoom: Math.max(map.getZoom(), 16.2), duration: 750 })
  showBusinessPopup(located.feature)
  return { ...located.feature.properties, coordinates: center }
}

export function getWorkspaceObjects() {
  const sources = [...twinSourceData, ['security', securityData], ['machinery', machineryData],
    ['server', workspaceSourceData.get('server')], ['alert-risk', workspaceSourceData.get('alert-risk')]]
  const records = new Map()
  for (const [sourceId, data] of sources) {
    for (const feature of data?.features || []) {
      const record = mapObjectRecord(feature, sourceId)
      if (!records.has(record.key)) records.set(record.key, record)
    }
  }
  return [...records.values()]
}

export function onObjectSelect(handler) {
  objectSelectionHandler = handler
}

export function clearWorkspaceSelection() {
  businessPopup?.remove()
  businessPopup = null
  clearCameraFocus()
  setTwinPopupFocus(false)
  clearMapSelection()
  machinerySelectionHandler?.(null)
}

export function focusWorkspaceObject(record) {
  if (!map || !record) return null
  overviewMode = false
  if (record.sourceId === 'machinery') return focusMachinery(record.id)
  if (record.sourceId === 'security') return focusSecurityFeature(record.id)
  if (twinSourceData.has(record.sourceId)) return focusTwinObject(record.id)
  const data = workspaceSourceData.get(record.sourceId)
  const feature = data?.features?.find(candidate => mapObjectRecord(candidate, record.sourceId).key === record.key)
    || (workspaceSelectionFeature && mapObjectRecord(workspaceSelectionFeature).key === record.key ? workspaceSelectionFeature : null)
  if (!feature) return null
  if (record.sourceId === 'alert-risk') setFreeAlertType('all', feature.properties.field_id)
  const located = { ...feature, source: record.sourceId }
  map.easeTo({ center: geometryCenter(feature.geometry), zoom: Math.max(map.getZoom(), 16), duration: 650 })
  showBusinessPopup(located)
  return record
}

function publishWorkspaceSelection(feature, root) {
  if (!objectSelectionHandler) return false
  overviewMode = false
  setTwinPopupFocus(false)
  workspaceSelectionFeature = feature
  setMapSelection(feature)
  objectSelectionHandler({ ...mapObjectRecord(feature), content: root })
  return true
}

function cloneSecurityFeature(feature) {
  if (!feature) return null
  return {
    ...feature.properties,
    coordinates: feature.geometry.type === 'Point' ? [...feature.geometry.coordinates] : null
  }
}

export function getSecurityState() {
  const features = securityData?.features || []
  const fences = features.filter((feature) => feature.properties.kind === 'fence').map(cloneSecurityFeature)
  const cameras = features.filter((feature) => feature.properties.kind === 'camera').map(cloneSecurityFeature)
  return {
    fences,
    cameras,
    fencesVisible,
    camerasVisible,
    armedCount: fences.filter((item) => item.controlStatus === 'armed').length,
    onlineCount: cameras.filter((item) => item.status === 'online' || item.status === 'alarm').length,
    alertCount: [...fences, ...cameras].filter((item) => item.status === 'alarm' || Number(item.incidents) > 0).length
  }
}

export function onSecuritySelect(handler) {
  securitySelectionHandler = handler
}

function updateSecuritySource() {
  securityData?.features.forEach(syncFenceVisualStatus)
  map?.getSource('security')?.setData(securityData)
  map?.getSource('security-labels')?.setData(buildSecurityLabelData())
  if (selectedMapFeatureId) {
    const selected = getFeatureById(selectedMapFeatureId)
    if (selected) {
      if (securityPopup || workspaceSelectionFeature) showSecurityPopup(selected)
      setMapSelection(selected)
    }
  }
  return getSecurityState()
}

export function setSecurityLayerVisible(kind, visible) {
  if (kind === 'fence') fencesVisible = Boolean(visible)
  if (kind === 'camera') camerasVisible = Boolean(visible)
  if (currentTopic === 'security') {
    if (kind === 'fence') setLogicalVisibility('fenceLayer', fencesVisible)
    if (kind === 'camera') setLogicalVisibility('cameraLayer', camerasVisible)
  }
  return getSecurityState()
}

export function setFenceArmed(featureId, armed) {
  const feature = getFeatureById(featureId)
  if (!feature || feature.properties.kind !== 'fence') return getSecurityState()
  feature.properties.controlStatus = armed ? 'armed' : 'disarmed'
  syncFenceVisualStatus(feature)
  feature.properties.updated_at = new Date().toISOString()
  return updateSecuritySource()
}

export function setAllFencesArmed(armed) {
  securityData?.features.forEach((feature) => {
    if (feature.properties.kind === 'fence') {
      feature.properties.controlStatus = armed ? 'armed' : 'disarmed'
      syncFenceVisualStatus(feature)
      feature.properties.updated_at = new Date().toISOString()
    }
  })
  return updateSecuritySource()
}

export function acknowledgeSecurityAlert(featureId) {
  const feature = getFeatureById(featureId)
  if (!feature) return getSecurityState()
  feature.properties.acknowledged_at = new Date().toISOString()
  if (feature.properties.kind === 'camera') {
    if (feature.properties.status === 'alarm') feature.properties.status = 'online'
    feature.properties.incidents = 0
  }
  if (feature.properties.kind === 'fence') {
    feature.properties.incidents = 0
    syncFenceVisualStatus(feature)
  }
  return updateSecuritySource()
}

function createCameraCone(feature) {
  const [lng, lat] = feature.geometry.coordinates
  const direction = Number(feature.properties.direction) || 0
  const fov = Number(feature.properties.fov) || 70
  const radius = 0.0015
  const points = [[lng, lat]]
  for (let index = 0; index <= 12; index += 1) {
    const angle = direction - fov / 2 + (fov * index) / 12
    const radians = (angle * Math.PI) / 180
    points.push([
      lng + Math.sin(radians) * radius / Math.cos((lat * Math.PI) / 180),
      lat + Math.cos(radians) * radius
    ])
  }
  points.push([lng, lat])
  return { type: 'Feature', properties: { camera_id: feature.properties.id }, geometry: { type: 'Polygon', coordinates: [points] } }
}

function geometryCenter(geometry) {
  return geometryRepresentativePoint(geometry, DEFAULT_CENTER)
}

function clearCameraFocus() {
  map?.getSource('camera-focus')?.setData({ type: 'FeatureCollection', features: [] })
  if (map?.getLayer('farmclaw-camera-cone')) map.setLayoutProperty('farmclaw-camera-cone', 'visibility', 'none')
  securityPopup?.remove()
  securityPopup = null
}

function clearMapSelection() {
  selectedMapFeatureId = null
  selectedMapFeatureKind = null
  map?.getSource('map-selection')?.setData({ type: 'FeatureCollection', features: [] })
  applySelectionContext()
  workspaceSelectionFeature = null
  objectSelectionHandler?.(null)
}

function setMapSelection(feature) {
  if (!feature?.geometry || !map?.getSource('map-selection')) return
  selectedMapFeatureId = (feature.properties?.kind ? feature.properties.id : feature.properties?.twin_id) || feature.properties?.id || feature.id || null
  selectedMapFeatureKind = feature.properties?.kind || null
  const properties = { ...feature.properties }
  const anchor = {
    type: 'Feature',
    properties: { ...properties, selection_anchor: true },
    geometry: { type: 'Point', coordinates: geometryCenter(feature.geometry) }
  }
  const selectionFeatures = feature.geometry.type === 'Point'
    ? [anchor]
    : [{ type: 'Feature', properties: { ...properties, selection_anchor: false }, geometry: feature.geometry }, anchor]
  map.getSource('map-selection').setData({
    type: 'FeatureCollection',
    features: selectionFeatures
  })
  applySelectionContext()
}

function appendPopupLine(root, label, value) {
  const line = document.createElement('p')
  const strong = document.createElement('strong')
  strong.textContent = `${label}：`
  line.append(strong, document.createTextNode(String(value ?? '--')))
  root.appendChild(line)
}

function createPopupRoot(titleText, eyebrowText, iconKey) {
  const root = document.createElement('section')
  root.className = 'farmclaw-popup-content'
  const eyebrow = document.createElement('small')
  eyebrow.textContent = eyebrowText
  const title = document.createElement('h3')
  title.textContent = titleText
  if (iconKey) {
    root.classList.add('has-asset-icon')
    const heading = document.createElement('header')
    heading.className = 'farmclaw-asset-heading'
    const icon = document.createElement('img')
    icon.className = 'farmclaw-popup-asset-icon'
    icon.src = facilityIconDataUri(iconKey)
    icon.alt = FACILITY_TYPE_LABELS[iconKey] || FACILITY_TYPE_LABELS.generic
    heading.append(icon, eyebrow, title)
    root.appendChild(heading)
  } else root.append(eyebrow, title)
  return root
}

function appendPopupFacts(root, facts) {
  const grid = document.createElement('div')
  grid.className = 'farmclaw-popup-facts'
  for (const [label, value] of facts) appendPopupLine(grid, label, value)
  root.appendChild(grid)
}

function appendSectionHeading(section, titleText, badgeText, badgeClass = '') {
  const heading = document.createElement('div')
  heading.className = 'farmclaw-observation-heading'
  const title = document.createElement('strong')
  title.textContent = titleText
  const badge = document.createElement('span')
  badge.className = badgeClass
  badge.textContent = badgeText
  heading.append(title, badge)
  section.appendChild(heading)
}

function appendTwinAlert(root, alert) {
  const section = document.createElement('section')
  section.className = `farmclaw-twin-alert is-${alert.level}`
  section.setAttribute('aria-label', '对象预警')
  const badge = alert.count > 0 ? `${alert.count} 条·${alert.levelLabel}` : alert.levelLabel
  appendSectionHeading(section, '对象预警', badge, `is-${alert.level}`)

  const title = document.createElement('b')
  title.textContent = alert.title
  const detail = document.createElement('p')
  detail.textContent = alert.detail
  const advice = document.createElement('small')
  advice.textContent = `建议：${alert.advice}`
  const observedAt = document.createElement('time')
  observedAt.textContent = alert.observedAt
  section.append(title, detail, advice, observedAt)
  root.appendChild(section)
}

function appendCameraFallback(stage, message = '真实视频流未接入', hintText = '绑定可信媒体地址后将在此显示') {
  const fallback = document.createElement('div')
  fallback.className = 'farmclaw-camera-fallback'
  fallback.setAttribute('role', 'img')
  fallback.setAttribute('aria-label', message)
  const reticle = document.createElement('i')
  const label = document.createElement('strong')
  label.textContent = message
  const hint = document.createElement('small')
  hint.textContent = hintText
  fallback.append(reticle, label, hint)
  stage.appendChild(fallback)
  return fallback
}

function appendCameraMedia(stage, camera, feedBadge) {
  const url = camera.mediaUrl
  if (!url) return appendCameraFallback(stage, camera.fallbackTitle, camera.feedMode === 'blocked'
    ? '请检查 VITE_TWIN_MEDIA_ALLOWED_ORIGINS 配置'
    : camera.feedMode === 'demo' ? '演示结论不代表现场实时画面' : camera.feedHint)

  const media = document.createElement(camera.mediaKind === 'image' ? 'img' : 'video')
  media.className = 'farmclaw-camera-media'
  media.referrerPolicy = 'no-referrer'
  media.setAttribute('referrerpolicy', 'no-referrer')
  const expireLive = () => {
    if (!stage.isConnected || !media.isConnected) return
    if (media.tagName === 'VIDEO') media.pause()
    media.remove()
    stage.classList.add('is-unavailable')
    feedBadge.className = 'farmclaw-camera-feed-badge is-stale'
    feedBadge.textContent = '视频流·数据过期'
    appendCameraFallback(stage, '实时画面已过期', '收到新的在线状态与观测时间后自动恢复')
  }
  let expiryTimer
  const markLive = () => {
    if (!camera.liveEligible) return
    globalThis.clearTimeout?.(expiryTimer)
    const freshForMs = Number(camera.liveExpiresAt) - Date.now()
    if (!Number.isFinite(freshForMs) || freshForMs <= 0) {
      expireLive()
      return
    }
    feedBadge.className = 'farmclaw-camera-feed-badge is-live'
    feedBadge.textContent = 'LIVE'
    expiryTimer = globalThis.setTimeout?.(expireLive, freshForMs + 50)
  }
  const markInterrupted = (label) => {
    if (!camera.liveEligible || !media.isConnected) return
    feedBadge.className = 'farmclaw-camera-feed-badge is-offline'
    feedBadge.textContent = label
  }
  if (media.tagName === 'IMG') {
    media.alt = `${camera.name}摄像头画面`
  } else {
    media.autoplay = true
    media.muted = true
    media.playsInline = true
    media.controls = true
    media.setAttribute('aria-label', `${camera.name}实时画面`)
    media.addEventListener('playing', markLive)
    media.addEventListener('waiting', () => markInterrupted('视频缓冲中'))
    media.addEventListener('stalled', () => markInterrupted('连接中断'))
    media.addEventListener('pause', () => markInterrupted('视频已暂停'))
    media.addEventListener('ended', () => markInterrupted('视频已结束'))
  }
  media.addEventListener('error', () => {
    globalThis.clearTimeout?.(expiryTimer)
    media.remove()
    stage.classList.add('is-unavailable')
    feedBadge.className = 'farmclaw-camera-feed-badge is-unavailable'
    feedBadge.textContent = '画面不可用'
    if (!stage.querySelector('.farmclaw-camera-fallback')) appendCameraFallback(stage, '摄像头画面加载失败', '识别结论仍保留，请复核媒体服务')
  }, { once: true })
  media.src = url
  stage.appendChild(media)
  return media
}

function appendTwinCamera(root, camera) {
  const section = document.createElement('section')
  section.className = `farmclaw-twin-camera is-${camera.status}`
  section.setAttribute('aria-label', '实时摄像头结果')
  appendSectionHeading(section, '摄像头观测', camera.statusLabel, `is-${camera.status}`)

  const stage = document.createElement('div')
  stage.className = `farmclaw-camera-stage is-${camera.feedMode}`
  const feedBadge = document.createElement('span')
  // liveEligible 只代表“允许尝试播放”；收到 playing 事件前不能提前暗示现场 LIVE。
  const initialFeedMode = camera.feedMode === 'live' ? 'connecting' : camera.feedMode
  feedBadge.className = `farmclaw-camera-feed-badge is-${initialFeedMode}`
  feedBadge.textContent = camera.feedLabel
  const cameraName = document.createElement('small')
  cameraName.className = 'farmclaw-camera-name'
  cameraName.textContent = `${camera.name} · ${camera.id}`
  appendCameraMedia(stage, camera, feedBadge)
  stage.append(feedBadge, cameraName)

  const result = document.createElement('div')
  result.className = 'farmclaw-camera-result'
  const resultCopy = document.createElement('p')
  const resultLabel = document.createElement('small')
  resultLabel.textContent = 'AI 识别结果'
  const resultText = document.createElement('strong')
  resultText.textContent = camera.result
  resultCopy.append(resultLabel, resultText)
  const confidence = document.createElement('b')
  confidence.textContent = camera.confidence == null ? '--' : `${camera.confidence}%`
  confidence.title = camera.confidence == null ? '上游未提供识别置信度' : '识别置信度'
  result.append(resultCopy, confidence)

  const metrics = document.createElement('ul')
  metrics.className = 'farmclaw-camera-metrics'
  for (const metric of camera.metrics) {
    const item = document.createElement('li')
    item.textContent = metric
    metrics.appendChild(item)
  }
  const meta = document.createElement('time')
  meta.className = 'farmclaw-camera-observed'
  meta.textContent = [...new Set([camera.observedAt, camera.hasDemoScenario ? '' : camera.freshnessLabel].filter(Boolean))].join(' · ')
  section.append(stage, result)
  if (camera.metrics.length) section.appendChild(metrics)
  section.appendChild(meta)
  root.appendChild(section)
}

function appendTwinObservation(root, properties) {
  const observation = buildTwinObservation(properties, twinObservationOptions())
  root.classList.add('farmclaw-twin-observation')
  appendTwinAlert(root, observation.alert)
  appendTwinCamera(root, observation.camera)
  return observation
}

function showSecurityPopup(feature) {
  setTwinPopupFocus(false)
  securityPopup?.remove()
  const root = createPopupRoot(feature.properties.name, feature.properties.kind === 'camera' ? '摄像头点位' : '电子围栏', feature.properties.kind === 'camera' ? 'camera' : null)
  appendPopupLine(root, '编号', feature.properties.id)
  appendPopupLine(root, feature.properties.kind === 'fence' ? '防区范围' : '所属防区', feature.properties.zone)
  const statusDescription = feature.properties.status === 'alarm' && feature.properties.controlStatus === 'disarmed'
    ? '告警待确认 · 本地状态已撤防'
    : securityStatusLabel(feature.properties.status)
  appendPopupLine(root, '状态', statusDescription)
  appendPopupLine(root, feature.properties.kind === 'camera' ? '用途' : '规则', feature.properties.note || feature.properties.rule)
  const note = document.createElement('p')
  note.className = 'farmclaw-popup-note'
  note.textContent = '本地数字孪生演示 · 仅供复核，不控制现场设备'
  root.appendChild(note)
  if (publishWorkspaceSelection(feature, root)) return
  securityPopup = new maplibregl.Popup({ className: 'farmclaw-map-popup', closeButton: true, closeOnClick: false, offset: 14 })
    .setDOMContent(root)
  securityPopup.on('close', clearMapSelection)
  securityPopup.setLngLat(geometryCenter(feature.geometry))
  securityPopup.addTo(map)
}

function showBusinessPopup(feature) {
  clearCameraFocus()
  businessPopup?.remove()
  const properties = feature.properties || {}
  const isMachinery = properties.kind === 'machinery' || Boolean(properties.machinery_type)
  const isValue = properties.scope === 'value' || properties.forecast_id
  const isServer = properties.name && properties.department
  const isTwinObject = Boolean(properties.twin_id)
  setTwinPopupFocus(isTwinObject)
  const twin = twinObjectPresentation(properties)
  const title = isTwinObject ? twin.title : properties.title || properties.category || properties.name || '业务点位'
  const root = createPopupRoot(title, isMachinery ? '农机运行孪生' : isTwinObject ? '数字孪生空间对象' : isValue ? '产值预测标注' : isServer ? '园区设施' : '生产品类标注', isMachinery ? properties.machinery_type || properties.type : isServer ? classifyFacility(properties) : null)
  if (isMachinery) {
    appendPopupLine(root, '农机编号', properties.twin_id || properties.twinId || properties.id)
    appendPopupLine(root, '机型', properties.type_label || properties.typeLabel)
    appendPopupLine(root, '运行状态', properties.status_label || properties.statusLabel)
    appendPopupLine(root, '数据新鲜度', properties.freshness_label || properties.freshnessLabel)
    appendPopupLine(root, '当前任务', properties.machine_task || properties.task)
    appendPopupLine(root, '任务进度', `${properties.task_progress ?? properties.progress ?? 0}%`)
    appendPopupLine(root, '运转速度', `${properties.speed_kph ?? properties.speedKph ?? properties.speed ?? 0} km/h`)
    appendPopupLine(root, '航向', `${properties.heading_deg ?? properties.headingDeg ?? properties.heading ?? 0}°`)
    appendPopupLine(root, '动力余量', properties.energy_label)
    appendPopupLine(root, '今日 / 累计工时', `${properties.runtime_today ?? properties.runtimeToday ?? 0} / ${properties.engine_hours ?? properties.engineHours ?? 0} h`)
    appendPopupLine(root, '作业区域', properties.zone)
    appendPopupLine(root, '操作员', properties.operator)
    appendPopupLine(root, '最近信号', properties.last_signal || properties.lastSignal || properties.observed_at)
    appendPopupLine(root, '维护计划', properties.next_service || properties.nextService)
    if (properties.alert_note || properties.alert) appendPopupLine(root, '异常说明', properties.alert_note || properties.alert)
    appendPopupLine(root, '数据来源', properties.twin_source || '演示农机遥测')
    const note = document.createElement('p')
    note.className = 'farmclaw-popup-note'
    note.textContent = '演示农机遥测 · 仅供运行监测，不提供远程启停或调度控制。'
    root.appendChild(note)
  } else if (isTwinObject) {
    appendPopupFacts(root, [
      ['对象编号', twin.id],
      ['对象类型', twin.type],
      ['对象状态', twin.status],
      ['数据来源', twin.source],
      ['业务档案', twin.link]
    ])
    const observation = appendTwinObservation(root, properties)
    const note = document.createElement('p')
    note.className = 'farmclaw-popup-note'
    note.textContent = observation.camera.feedMode === 'live'
      ? '演示空间对象，不代表真实权属或生产状态。可信视频流连接成功后才标记 LIVE；前端仅展示，不执行现场控制。'
      : observation.camera.feedMode === 'snapshot'
        ? `演示空间对象，不代表真实权属或生产状态。当前显示${observation.camera.feedLabel}，前端仅展示，不执行现场控制。`
        : observation.camera.feedMode === 'blocked'
          ? '演示空间对象，不代表真实权属或生产状态。媒体地址不在可信来源范围内，前端已停止加载。'
          : observation.hasDemoScenario
          ? '演示空间对象，不代表真实权属或生产状态。当前预警与识别结果为演示数据，未接入现场实时视频流。'
           : observation.camera.feedMode === 'unbound'
             ? '演示空间对象，不代表真实权属或生产状态。当前尚未绑定摄像头或视觉识别服务。'
            : observation.camera.feedMode === 'result'
              ? '演示空间对象，不代表真实权属或生产状态。当前为上游识别结果，但未提供可展示的实时视频或快照。'
              : observation.camera.feedMode === 'status'
                ? '演示空间对象，不代表真实权属或生产状态。摄像头已绑定，但上游未提供可展示的实时视频或快照。'
                : '演示空间对象，不代表真实权属或生产状态。当前摄像头状态不满足实时展示条件，前端仅保留状态用于复核。'
    root.appendChild(note)
  } else if (isValue) {
    appendPopupLine(root, '产业', properties.industry_label || properties.industryLabel)
    appendPopupLine(root, '品类', properties.category)
    appendPopupLine(root, '预测指数', properties.average ?? properties.value)
    appendPopupLine(root, '样本', properties.count ? `${properties.count} 个预测点` : properties.forecast_id)
    const note = document.createElement('p')
    note.className = 'farmclaw-popup-note'
    note.textContent = '演示指数，不代表真实财务收入。'
    root.appendChild(note)
  } else if (isServer) {
    appendPopupLine(root, '类型', FACILITY_TYPE_LABELS[classifyFacility(properties)])
    appendPopupLine(root, '部门', properties.department)
    appendPopupLine(root, '面积', `${properties.area || '--'} ㎡`)
    appendPopupLine(root, '负责人', properties.manager)
  } else {
    appendPopupLine(root, '产业', properties.industryLabel)
    appendPopupLine(root, '点位', `${properties.count || 0} 个`)
  }
  if (publishWorkspaceSelection(feature, root)) return
  const popupOptions = {
    className: isMachinery
      ? 'farmclaw-map-popup farmclaw-machinery-popup'
      : isTwinObject
        ? 'farmclaw-map-popup farmclaw-twin-observation-popup'
        : 'farmclaw-map-popup',
    closeButton: true,
    closeOnClick: true,
    offset: isMachinery ? 36 : 28,
    maxWidth: isTwinObject ? '380px' : isMachinery ? '340px' : '300px'
  }
  if ((isMachinery || isTwinObject) && globalThis.window?.innerWidth > 600) popupOptions.anchor = 'left'
  businessPopup = new maplibregl.Popup(popupOptions)
    .setDOMContent(root)
    .setLngLat(geometryCenter(feature.geometry))
    .addTo(map)
  businessPopup.on('close', () => {
    if (isTwinObject) setTwinPopupFocus(false)
    clearMapSelection()
    if (isMachinery) machinerySelectionHandler?.(null)
  })
  setMapSelection(feature)
}

export function focusMachinery(machineId) {
  const feature = machineryFeatureById(machineId)
  if (!feature || !map) return null
  if (currentTopic !== 'operations') setFreeTopic('operations')
  if (currentMachineryStatus !== 'all' && feature.properties?.machinery_status !== currentMachineryStatus) setMachineryFilter('all')
  map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 16.4), duration: 850 })
  showBusinessPopup(feature)
  const selected = cloneMachineryFeature(feature)
  machinerySelectionHandler?.(selected)
  return selected
}

export function focusSecurityFeature(featureId) {
  const feature = getFeatureById(featureId)
  if (!feature || !map) return null
  if (currentTopic !== 'security') setFreeTopic('security')
  businessPopup?.remove()
  businessPopup = null

  if (feature.geometry.type === 'Point') {
    const cone = createCameraCone(feature)
    map.getSource('camera-focus')?.setData({ type: 'FeatureCollection', features: [cone] })
    map.setLayoutProperty('farmclaw-camera-cone', 'visibility', camerasVisible ? 'visible' : 'none')
    map.easeTo({ center: feature.geometry.coordinates, zoom: 17.3, duration: 900 })
  } else {
    clearCameraFocus()
    const coordinates = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates.flat(1)
      : feature.geometry.coordinates.flat(2)
    const bounds = coordinates.reduce((result, coordinate) => result.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))
    // 全局视口留白已经通过 setPadding 生效，这里只补少量对象呼吸区，避免重复挤压画布。
    map.fitBounds(bounds, { padding: 18, maxZoom: 16.8, duration: 900 })
  }
  showSecurityPopup(feature)
  setMapSelection(feature)
  const selected = cloneSecurityFeature(feature)
  securitySelectionHandler?.(selected)
  return selected
}

function bindSecurityInteractions() {
  map.on('mouseenter', SECURITY_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', SECURITY_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = '' })
  map.on('click', SECURITY_INTERACTIVE_LAYERS, (event) => {
    // 摄像头通常位于围栏面内；一次点击只裁决一个对象，避免围栏回调覆盖前景点位。
    const feature = event.features?.find((candidate) => candidate.properties?.kind === 'camera')
      || event.features?.find((candidate) => candidate.properties?.kind === 'fence')
    const featureId = feature?.properties?.id
    if (featureId) focusSecurityFeature(featureId)
  })
}

function bindBusinessInteractions() {
  map.on('mouseenter', BUSINESS_POINT_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', BUSINESS_POINT_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = '' })
  map.on('click', BUSINESS_POINT_INTERACTIVE_LAYERS, (event) => {
    const machineryFeature = event.features?.find((candidate) => candidate.properties?.kind === 'machinery')
    if (machineryFeature) {
      focusMachinery(machineryFeature.properties?.id || machineryFeature.properties?.twin_id || machineryFeature.id)
      return
    }
    const feature = event.features?.find((candidate) => candidate.geometry?.type === 'Point')
    if (feature) showBusinessPopup(feature)
  })
  map.on('mouseenter', TWIN_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', TWIN_INTERACTIVE_LAYERS, () => { map.getCanvas().style.cursor = '' })
  map.on('click', TWIN_INTERACTIVE_LAYERS, (event) => {
    const foregroundLayers = FOREGROUND_INTERACTIVE_LAYERS.filter((layerId) => map.getLayer(layerId))
    if (foregroundLayers.length && map.queryRenderedFeatures(event.point, { layers: foregroundLayers }).length) return
    const feature = event.features?.find((candidate) => candidate.properties?.twin_id)
    if (feature) showBusinessPopup(feature)
  })
}

export const FREE_MAP_PROVIDER_LABEL = 'OpenFreeMap · MapLibre'
