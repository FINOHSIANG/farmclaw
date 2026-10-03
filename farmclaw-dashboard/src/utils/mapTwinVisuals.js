export const TWIN_PATTERN_IDS = Object.freeze({
  fieldRows: 'farmclaw-field-rows',
  waterRipples: 'farmclaw-water-ripples'
})

const TWIN_SOURCE_DEFINITIONS = Object.freeze({
  farm: { prefix: 'FIELD', type: '种植地块', active: '生产利用', inactive: '待利用' },
  pool: { prefix: 'POND', type: '水产塘口', active: '养殖利用', inactive: '待利用' },
  water: { prefix: 'WATER', type: '园区水系', status: '空间底图' },
  green: { prefix: 'GREEN', type: '生态绿地', status: '空间底图' },
  building: { prefix: 'BLDG', type: '建筑体量', status: '演示体量' },
  greenhouse: { prefix: 'GH', type: '温室设施', status: '演示体量' }
})

export const TWIN_OBJECT_SOURCE_IDS = Object.freeze(Object.keys(TWIN_SOURCE_DEFINITIONS))

function setPixel(data, width, x, y, [red, green, blue, alpha]) {
  const offset = (y * width + x) * 4
  data[offset] = red
  data[offset + 1] = green
  data[offset + 2] = blue
  data[offset + 3] = alpha
}

export function buildTwinPatternImage(kind) {
  if (kind === 'fieldRows') {
    const width = 16
    const height = 16
    const data = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const diagonal = (x + y * 2) % 12
        if (diagonal === 0) setPixel(data, width, x, y, [176, 205, 158, 74])
        else if (diagonal === 1) setPixel(data, width, x, y, [122, 155, 119, 26])
      }
    }
    return { width, height, data }
  }

  if (kind === 'waterRipples') {
    const width = 20
    const height = 20
    const data = new Uint8Array(width * height * 4)
    for (let x = 2; x <= 14; x += 1) setPixel(data, width, x, 5, [116, 187, 199, x === 2 || x === 14 ? 24 : 62])
    for (let x = 7; x < width; x += 1) setPixel(data, width, x, 14, [116, 187, 199, x === 7 || x === width - 1 ? 22 : 48])
    for (let x = 0; x <= 2; x += 1) setPixel(data, width, x, 14, [116, 187, 199, 42])
    return { width, height, data }
  }

  throw new Error(`未知数字孪生纹理：${kind}`)
}

export function registerTwinPatternImages(targetMap) {
  for (const [kind, imageId] of Object.entries(TWIN_PATTERN_IDS)) {
    if (!targetMap?.hasImage?.(imageId)) targetMap?.addImage?.(imageId, buildTwinPatternImage(kind))
  }
}

function twinStatus(definition, properties) {
  if (!definition.active) return definition.status
  const used = Number(properties.used)
  if (used === 1) return definition.active
  if (used === 0) return definition.inactive
  return '状态待补充'
}

export function enrichTwinGeoJson(sourceId, geojson) {
  const definition = TWIN_SOURCE_DEFINITIONS[sourceId]
  if (!definition || !Array.isArray(geojson?.features)) return geojson
  geojson.features.forEach((feature, index) => {
    feature.properties ||= {}
    const ordinal = String(index + 1).padStart(3, '0')
    feature.properties.twin_id ||= `${definition.prefix}-${ordinal}`
    feature.id ||= feature.properties.twin_id
    feature.properties.twin_type = definition.type
    feature.properties.twin_status = twinStatus(definition, feature.properties)
    feature.properties.twin_source = '演示空间底图'
    feature.properties.twin_link = '未关联业务档案'
  })
  return geojson
}

export function twinObjectPresentation(properties = {}) {
  const id = properties.twin_id || 'TWIN-UNKNOWN'
  const type = properties.twin_type || '空间对象'
  const idSuffix = String(id).split('-').pop()
  return {
    id,
    type,
    title: properties.name || `${type} ${idSuffix}`,
    status: properties.twin_status || '状态待补充',
    source: properties.twin_source || '来源待补充',
    link: properties.twin_link || '未关联业务档案'
  }
}

export function selectedFeatureOpacity(featureId, selectedOpacity = 1, contextOpacity = 0.28) {
  return ['case', ['==', ['to-string', ['get', 'id']], String(featureId)], selectedOpacity, contextOpacity]
}
