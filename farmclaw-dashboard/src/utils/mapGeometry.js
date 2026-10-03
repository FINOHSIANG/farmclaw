function ringArea(ring = []) {
  let twiceArea = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    twiceArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1]
  }
  return twiceArea / 2
}

function ringCentroid(ring = []) {
  const area = ringArea(ring)
  if (!Number.isFinite(area) || Math.abs(area) < Number.EPSILON) return null
  let x = 0
  let y = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const cross = ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1]
    x += (ring[index][0] + ring[index + 1][0]) * cross
    y += (ring[index][1] + ring[index + 1][1]) * cross
  }
  return [x / (6 * area), y / (6 * area)]
}

function pointInRing([x, y], ring = []) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[previous]
    const crosses = (y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / ((y2 - y1) || Number.EPSILON) + x1
    if (crosses) inside = !inside
  }
  return inside
}

export function pointInPolygon(point, rings = []) {
  if (!rings.length || !pointInRing(point, rings[0])) return false
  return !rings.slice(1).some((ring) => pointInRing(point, ring))
}

function scanlinePoint(rings, preferredY) {
  const outerRing = rings[0] || []
  const intersections = []
  for (let index = 0; index < outerRing.length - 1; index += 1) {
    const [x1, y1] = outerRing[index]
    const [x2, y2] = outerRing[index + 1]
    if ((y1 > preferredY) === (y2 > preferredY)) continue
    intersections.push(x1 + ((preferredY - y1) * (x2 - x1)) / (y2 - y1))
  }
  intersections.sort((left, right) => left - right)
  const candidates = []
  for (let index = 0; index < intersections.length - 1; index += 2) {
    const left = intersections[index]
    const right = intersections[index + 1]
    candidates.push({ point: [(left + right) / 2, preferredY], width: right - left })
  }
  return candidates.sort((left, right) => right.width - left.width).find(({ point }) => pointInPolygon(point, rings))?.point || null
}

function polygonRepresentativePoint(rings = [], fallback) {
  const outerRing = rings[0] || []
  if (!outerRing.length) return fallback
  const xs = outerRing.map(([x]) => x)
  const ys = outerRing.map(([, y]) => y)
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  const centroid = ringCentroid(outerRing)
  const boundsCenter = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
  for (const candidate of [centroid, boundsCenter]) {
    if (candidate && pointInPolygon(candidate, rings)) return candidate
  }
  for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const point = scanlinePoint(rings, bounds.minY + (bounds.maxY - bounds.minY) * ratio)
    if (point) return point
  }
  return outerRing.find((point) => pointInPolygon(point, rings)) || outerRing[0] || fallback
}

export function geometryRepresentativePoint(geometry, fallback = [0, 0]) {
  if (geometry?.type === 'Point') return geometry.coordinates
  if (geometry?.type === 'Polygon') return polygonRepresentativePoint(geometry.coordinates, fallback)
  if (geometry?.type === 'MultiPolygon') {
    const polygon = [...geometry.coordinates].sort((left, right) => Math.abs(ringArea(right[0])) - Math.abs(ringArea(left[0])))[0]
    return polygonRepresentativePoint(polygon, fallback)
  }
  return fallback
}
