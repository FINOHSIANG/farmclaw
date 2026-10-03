import { geometryRepresentativePoint } from './mapGeometry.js'

export function geoJsonBounds(data) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  function visit(coordinates) {
    if (!Array.isArray(coordinates)) return
    if (typeof coordinates[0] === 'number') {
      const [lng, lat] = coordinates
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      west = Math.min(west, lng); east = Math.max(east, lng)
      south = Math.min(south, lat); north = Math.max(north, lat)
    } else coordinates.forEach(visit)
  }
  for (const feature of data?.features || []) visit(feature.geometry?.coordinates)
  return Number.isFinite(west) ? [[west, south], [east, north]] : null
}

export function buildOverviewLabels(sources) {
  const groups = [['farm', '种植地块'], ['pool', '水产塘口'], ['greenhouse', '温室设施']]
  return {
    type: 'FeatureCollection',
    features: groups.flatMap(([sourceId, label]) => {
      const features = sources.get(sourceId)?.features || []
      const centers = features.map(feature => geometryRepresentativePoint(feature.geometry, null)).filter(Boolean)
      if (!centers.length) return []
      const average = centers.reduce((sum, p) => [sum[0] + p[0] / centers.length, sum[1] + p[1] / centers.length], [0, 0])
      // 汇总标签落在距几何中心最近的真实对象上，不创建虚构业务分区。
      const anchor = centers.reduce((best, p) => Math.hypot(p[0] - average[0], p[1] - average[1]) < Math.hypot(best[0] - average[0], best[1] - average[1]) ? p : best)
      return [{ type: 'Feature', properties: { source_id: sourceId, label: `${label} · ${features.length}`, count: features.length }, geometry: { type: 'Point', coordinates: anchor } }]
    })
  }
}
