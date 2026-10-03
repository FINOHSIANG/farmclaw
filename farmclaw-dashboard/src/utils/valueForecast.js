const INDUSTRY_LABELS = {
  crop: '种植业',
  aquaculture: '水产养殖',
  unclassified: '未分类'
}

function isPoint(feature) {
  return feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)
}

function validValue(feature) {
  const value = Number(feature?.properties?.value)
  return Number.isFinite(value) ? value : null
}

function distanceSquared(a, b) {
  const latitudeScale = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  const x = (a[0] - b[0]) * latitudeScale
  const y = a[1] - b[1]
  return x * x + y * y
}

function distanceMeters(a, b) {
  return Math.sqrt(distanceSquared(a, b)) * 111_320
}

function pointInRing(point, ring) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index]
    const [xj, yj] = ring[previous]
    const intersects = yi > point[1] !== yj > point[1]
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point, polygon) {
  if (!polygon?.length || !pointInRing(point, polygon[0])) return false
  return !polygon.slice(1).some((hole) => pointInRing(point, hole))
}

function geometryContainsPoint(geometry, point) {
  if (geometry?.type === 'Polygon') return pointInPolygon(point, geometry.coordinates)
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
  return false
}

function insideAnyArea(point, areaData) {
  return (areaData?.features || []).some((feature) => geometryContainsPoint(feature.geometry, point))
}

function referencePoints(cropData, aquacultureData) {
  return [
    ...(cropData?.features || []).filter((feature) => isPoint(feature) && feature.properties?.crop).map((feature) => ({
      industry: 'crop',
      category: feature.properties.crop,
      coordinates: feature.geometry.coordinates
    })),
    ...(aquacultureData?.features || []).filter((feature) => isPoint(feature) && feature.properties?.crop).map((feature) => ({
      industry: 'aquaculture',
      category: feature.properties.crop,
      coordinates: feature.geometry.coordinates
    }))
  ]
}

function nearestReference(coordinates, references) {
  let nearest = null
  let nearestDistance = Infinity
  for (const reference of references) {
    const distance = distanceSquared(coordinates, reference.coordinates)
    if (distance < nearestDistance) {
      nearest = reference
      nearestDistance = distance
    }
  }
  return nearest
}

function summarize(features, overallAverage) {
  const groups = new Map()
  for (const feature of features) {
    const { industry, category, value } = feature.properties
    const key = `${industry}:${category}`
    const current = groups.get(key) || { industry, industryLabel: INDUSTRY_LABELS[industry], category, count: 0, total: 0, highPotential: 0 }
    current.count += 1
    current.total += value
    if (value >= 95) current.highPotential += 1
    groups.set(key, current)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    average: Number((group.total / group.count).toFixed(1)),
    share: Number(((group.count / features.length) * 100).toFixed(1)),
    relative: Number((group.total / group.count - overallAverage).toFixed(1))
  })).sort((a, b) => b.average - a.average || b.count - a.count || a.category.localeCompare(b.category, 'zh-CN'))
}

export function buildValueForecastModel(productionData, cropData, aquacultureData, farmAreaData, poolAreaData) {
  const references = referencePoints(cropData, aquacultureData)
  const features = (productionData?.features || []).filter((feature) => isPoint(feature) && validValue(feature) != null).map((feature, index) => {
    const coordinates = feature.geometry.coordinates
    const areaIndustry = insideAnyArea(coordinates, poolAreaData)
      ? 'aquaculture'
      : insideAnyArea(coordinates, farmAreaData) ? 'crop' : null
    const eligibleReferences = areaIndustry ? references.filter((reference) => reference.industry === areaIndustry) : references
    const nearest = nearestReference(coordinates, eligibleReferences)
    const reference = nearest && (areaIndustry || distanceMeters(coordinates, nearest.coordinates) <= 150)
      ? nearest
      : { industry: 'unclassified', category: '未分类' }
    const value = validValue(feature)
    return {
      ...feature,
      properties: {
        ...feature.properties,
        forecast_id: `VF-${String(index + 1).padStart(3, '0')}`,
        value,
        industry: reference.industry,
        industry_label: INDUSTRY_LABELS[reference.industry],
        category: reference.category,
        band: value >= 95 ? 'high' : value >= 80 ? 'stable' : 'watch'
      }
    }
  })
  const overallAverage = features.length
    ? features.reduce((sum, feature) => sum + feature.properties.value, 0) / features.length
    : 0
  const categories = summarize(features, overallAverage)
  const industries = Object.keys(INDUSTRY_LABELS).map((industry) => {
    const industryFeatures = features.filter((feature) => feature.properties.industry === industry)
    const total = industryFeatures.reduce((sum, feature) => sum + feature.properties.value, 0)
    return {
      id: industry,
      label: INDUSTRY_LABELS[industry],
      count: industryFeatures.length,
      average: industryFeatures.length ? Number((total / industryFeatures.length).toFixed(1)) : 0,
      highPotential: industryFeatures.filter((feature) => feature.properties.value >= 95).length,
      share: features.length ? Number(((industryFeatures.length / features.length) * 100).toFixed(1)) : 0
    }
  })
  return {
    geojson: { type: 'FeatureCollection', features },
    totalPoints: features.length,
    overallAverage: Number(overallAverage.toFixed(1)),
    highPotential: features.filter((feature) => feature.properties.value >= 95).length,
    industries,
    categories,
    methodology: '先按农田/鱼塘面域判定产业，再匹配同产业最近品类；面域外仅在 150 米内匹配，否则保留未分类。高潜力为指数 ≥95，稳定为 80–94，关注为 <80。'
  }
}

export function filterValueForecastFeatures(model, { industry = 'all', category = 'all' } = {}) {
  return (model?.geojson?.features || []).filter((feature) => {
    if (industry !== 'all' && feature.properties.industry !== industry) return false
    if (category !== 'all' && feature.properties.category !== category) return false
    return true
  })
}

export { INDUSTRY_LABELS }
