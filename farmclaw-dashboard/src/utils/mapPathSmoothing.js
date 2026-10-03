function smoothCoordinatePath(coordinates, subdivisions = 3) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return coordinates || []
  const result = [coordinates[0]]
  const point = (index) => coordinates[Math.max(0, Math.min(coordinates.length - 1, index))]
  const segments = Math.max(2, Number(subdivisions) || 3)
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const p0 = point(index - 1)
    const p1 = point(index)
    const p2 = point(index + 1)
    const p3 = point(index + 2)
    for (let step = 1; step <= segments; step += 1) {
      const t = step / segments
      const t2 = t * t
      const t3 = t2 * t
      result.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ])
    }
  }
  return result
}

export function smoothLineGeoJson(geojson, subdivisions = 3) {
  if (!geojson?.features) return geojson
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const geometry = feature.geometry
      if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) return feature
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: geometry.type === 'LineString'
            ? smoothCoordinatePath(geometry.coordinates, subdivisions)
            : geometry.coordinates.map((line) => smoothCoordinatePath(line, subdivisions))
        }
      }
    })
  }
}
