const INDUSTRY_LABELS = {
  crop: '种植业',
  aquaculture: '水产养殖',
  unclassified: '未分类'
}

const SECURITY_STATUS_LABELS = {
  alarm: '告警',
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
  armed: '已布防',
  disarmed: '已撤防'
}

function pointCoordinates(feature) {
  if (feature?.geometry?.type !== 'Point') return null
  const coordinates = feature.geometry.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? [longitude, latitude]
    : null
}

function averageCoordinates(coordinates) {
  if (!coordinates.length) return null
  const total = coordinates.reduce((sum, coordinate) => [
    sum[0] + coordinate[0],
    sum[1] + coordinate[1]
  ], [0, 0])
  return [total[0] / coordinates.length, total[1] / coordinates.length]
}

function productGroups(data, industry) {
  const groups = new Map()
  for (const feature of data?.features || []) {
    const coordinates = pointCoordinates(feature)
    const category = String(feature?.properties?.crop || '').trim()
    if (!coordinates || !category) continue
    const group = groups.get(category) || []
    group.push(coordinates)
    groups.set(category, group)
  }

  const industryLabel = INDUSTRY_LABELS[industry]
  return [...groups.entries()].map(([category, coordinates], index) => ({
    type: 'Feature',
    id: `label-product-${industry}-${index + 1}`,
    properties: {
      scope: 'product',
      title: category,
      detail: `${industryLabel} · ${coordinates.length} 个点位`,
      industry,
      industryLabel,
      category,
      count: coordinates.length,
      average: null,
      priority: -coordinates.length
    },
    geometry: {
      type: 'Point',
      coordinates: averageCoordinates(coordinates)
    }
  }))
}

function valueGroups(model) {
  const coordinateGroups = new Map()
  for (const feature of model?.geojson?.features || []) {
    const coordinates = pointCoordinates(feature)
    const industry = String(feature?.properties?.industry || '').trim()
    const category = String(feature?.properties?.category || '').trim()
    if (!coordinates || !industry || !category) continue
    const key = `${industry}\u0000${category}`
    const group = coordinateGroups.get(key) || []
    group.push(coordinates)
    coordinateGroups.set(key, group)
  }

  return (model?.categories || []).flatMap((category, index) => {
    const industry = String(category?.industry || '').trim()
    const categoryName = String(category?.category || '').trim()
    const coordinates = coordinateGroups.get(`${industry}\u0000${categoryName}`) || []
    const anchor = averageCoordinates(coordinates)
    if (!anchor || !industry || !categoryName) return []
    const count = Number.isFinite(Number(category.count)) ? Number(category.count) : coordinates.length
    const average = Number.isFinite(Number(category.average)) ? Number(category.average) : null
    const industryLabel = category.industryLabel || INDUSTRY_LABELS[industry] || industry
    return [{
      type: 'Feature',
      id: `label-value-${industry}-${index + 1}`,
      properties: {
        scope: 'value',
        title: categoryName,
        detail: average == null ? `${count} 个预测点` : `预测指数 ${average.toFixed(1)} / 100 · ${count} 个样本`,
        industry,
        industryLabel,
        category: categoryName,
        count,
        average,
        priority: -count
      },
      geometry: {
        type: 'Point',
        coordinates: anchor
      }
    }]
  })
}

export function buildBusinessLabelData({ cropData, aquacultureData, valueForecastModel } = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      ...productGroups(cropData, 'crop'),
      ...productGroups(aquacultureData, 'aquaculture'),
      ...valueGroups(valueForecastModel)
    ]
  }
}

export function securityStatusLabel(status) {
  return SECURITY_STATUS_LABELS[String(status || '').trim().toLowerCase()] || '未知'
}
