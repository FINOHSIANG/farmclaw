function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function polygonArea(ring = []) {
  let area = 0
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index]
    const next = ring[(index + 1) % ring.length]
    area += current[0] * next[1] - next[0] * current[1]
  }
  return Math.abs(area / 2)
}

function primaryRing(geometry) {
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || []
  if (geometry?.type !== 'MultiPolygon') return []
  return (geometry.coordinates || [])
    .map((polygon) => polygon?.[0] || [])
    .sort((left, right) => polygonArea(right) - polygonArea(left))[0] || []
}

function fieldOrdinal(field = {}) {
  const match = String(field.properties?.twin_id || field.id || '').match(/(\d+)(?!.*\d)/)
  return Number(match?.[1]) || 1
}

function createFrame(ring) {
  const vertices = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring.slice()
  const center = vertices.reduce((sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]], [0, 0]).map((value) => value / Math.max(vertices.length, 1))
  const longitudeScale = Math.cos(center[1] * Math.PI / 180)
  const metric = vertices.map(([lng, lat]) => [(lng - center[0]) * longitudeScale, lat - center[1]])
  let axis = [1, 0]
  let longest = 0
  for (let index = 0; index < metric.length; index += 1) {
    const current = metric[index]
    const next = metric[(index + 1) % metric.length]
    const delta = [next[0] - current[0], next[1] - current[1]]
    const length = Math.hypot(delta[0], delta[1])
    if (length > longest) {
      longest = length
      axis = [delta[0] / length, delta[1] / length]
    }
  }
  const normal = [-axis[1], axis[0]]
  const localRing = metric.map(([x, y]) => ({ u: x * axis[0] + y * axis[1], v: x * normal[0] + y * normal[1] }))
  const toCoordinate = ({ u, v }) => {
    const x = u * axis[0] + v * normal[0]
    const y = u * axis[1] + v * normal[1]
    return [center[0] + x / longitudeScale, center[1] + y]
  }
  return { localRing, toCoordinate }
}

function intersectionsAt(localRing, key, value) {
  const crossKey = key === 'v' ? 'u' : 'v'
  const intersections = []
  for (let index = 0; index < localRing.length; index += 1) {
    const current = localRing[index]
    const next = localRing[(index + 1) % localRing.length]
    const crosses = (current[key] <= value && next[key] > value) || (next[key] <= value && current[key] > value)
    if (!crosses) continue
    const ratio = (value - current[key]) / (next[key] - current[key])
    intersections.push(current[crossKey] + ratio * (next[crossKey] - current[crossKey]))
  }
  intersections.sort((left, right) => left - right)
  return intersections
}

function longestInteriorSegment(localRing, key, value) {
  const intersections = intersectionsAt(localRing, key, value)
  let segment = null
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    const candidate = [intersections[index], intersections[index + 1]]
    if (!segment || candidate[1] - candidate[0] > segment[1] - segment[0]) segment = candidate
  }
  if (!segment) return null
  return key === 'v'
    ? [{ u: segment[0], v: value }, { u: segment[1], v: value }]
    : [{ u: value, v: segment[0] }, { u: value, v: segment[1] }]
}

function lineFeature(kind, coordinates, properties = {}) {
  return { type: 'Feature', properties: { kind, ...properties }, geometry: { type: 'LineString', coordinates } }
}

function pointFeature(kind, coordinate, properties = {}) {
  return { type: 'Feature', properties: { kind, ...properties }, geometry: { type: 'Point', coordinates: coordinate } }
}

export function buildFieldInteriorTwin(field = {}) {
  const ring = primaryRing(field.geometry)
  if (ring.length < 4) return { geojson: { type: 'FeatureCollection', features: [] }, summary: { rowCount: 0, sensorCount: 0, valveCount: 0, zoneCount: 0, onlineCount: 0 } }

  const ordinal = fieldOrdinal(field)
  const { localRing, toCoordinate } = createFrame(ring)
  const uValues = localRing.map((point) => point.u)
  const vValues = localRing.map((point) => point.v)
  const uMin = Math.min(...uValues)
  const uMax = Math.max(...uValues)
  const vMin = Math.min(...vValues)
  const vMax = Math.max(...vValues)
  const vRange = Math.max(vMax - vMin, Number.EPSILON)
  const uRange = Math.max(uMax - uMin, Number.EPSILON)
  const rowCount = clamp(8 + ordinal % 4, 8, 11)
  const rows = []
  const features = []

  for (let index = 0; index < rowCount; index += 1) {
    const v = vMin + vRange * (0.1 + (index / Math.max(rowCount - 1, 1)) * 0.8)
    const segment = longestInteriorSegment(localRing, 'v', v)
    if (!segment) continue
    const inset = Math.min(uRange * 0.025, (segment[1].u - segment[0].u) * 0.08)
    const trimmed = [{ u: segment[0].u + inset, v }, { u: segment[1].u - inset, v }]
    rows.push(trimmed)
    features.push(lineFeature('crop-row', trimmed.map(toCoordinate), { row: index + 1, field_id: field.properties?.twin_id }))
  }

  const mainU = (uMin + uMax) / 2
  const mainline = longestInteriorSegment(localRing, 'u', mainU)
  if (mainline) {
    features.push(lineFeature('irrigation-main', mainline.map(toCoordinate), { label: '灌溉干线', field_id: field.properties?.twin_id }))
    rows.forEach((row, index) => {
      if (index % 2 !== 0) return
      const branchEnd = index % 4 === 0 ? row[0] : row[1]
      features.push(lineFeature('irrigation-branch', [toCoordinate({ u: mainU, v: row[0].v }), toCoordinate(branchEnd)], { row: index + 1, field_id: field.properties?.twin_id }))
    })
  }

  const zoneStates = ['生长正常', ordinal % 3 === 0 ? '待补水' : '水肥稳定', ordinal % 2 === 0 ? '巡检中' : '长势良好']
  for (let zone = 0; zone < 3; zone += 1) {
    if (zone > 0) {
      const dividerV = vMin + vRange * zone / 3
      const divider = longestInteriorSegment(localRing, 'v', dividerV)
      if (divider) features.push(lineFeature('zone-divider', divider.map(toCoordinate), { field_id: field.properties?.twin_id }))
    }
    const labelV = vMin + vRange * ((zone + 0.5) / 3)
    const labelSegment = longestInteriorSegment(localRing, 'v', labelV)
    if (!labelSegment) continue
    const labelU = (labelSegment[0].u + labelSegment[1].u) / 2
    features.push(pointFeature('zone-label', toCoordinate({ u: labelU, v: labelV }), { label: `${String.fromCharCode(65 + zone)}区 · ${zoneStates[zone]}`, field_id: field.properties?.twin_id }))
  }

  const sensorLabels = ['土壤水分 42%', '空气温度 24.6℃', '空气湿度 68%', '光照 12.4klx']
  const sensorRows = [1, Math.floor(rows.length / 3), Math.floor(rows.length * 2 / 3), rows.length - 2]
  sensorRows.forEach((rowIndex, index) => {
    const row = rows[clamp(rowIndex, 0, rows.length - 1)]
    if (!row) return
    const ratio = index % 2 === 0 ? 0.28 : 0.72
    const u = row[0].u + (row[1].u - row[0].u) * ratio
    features.push(pointFeature('sensor', toCoordinate({ u, v: row[0].v }), { label: sensorLabels[index], status: index === ordinal % 4 ? 'attention' : 'online', field_id: field.properties?.twin_id }))
  })

  if (mainline) {
    for (let index = 0; index < 2; index += 1) {
      const ratio = index === 0 ? 0.34 : 0.68
      const v = mainline[0].v + (mainline[1].v - mainline[0].v) * ratio
      features.push(pointFeature('valve', toCoordinate({ u: mainU, v }), { label: `阀门 V${index + 1} · ${index === ordinal % 2 ? '调节中' : '待命'}`, status: index === ordinal % 2 ? 'running' : 'standby', field_id: field.properties?.twin_id }))
    }
  }

  const sensorCount = features.filter((feature) => feature.properties.kind === 'sensor').length
  const valveCount = features.filter((feature) => feature.properties.kind === 'valve').length
  return {
    geojson: { type: 'FeatureCollection', features },
    summary: {
      rowCount: rows.length,
      sensorCount,
      valveCount,
      zoneCount: 3,
      onlineCount: features.filter((feature) => feature.properties.kind === 'sensor' && feature.properties.status === 'online').length
    }
  }
}
