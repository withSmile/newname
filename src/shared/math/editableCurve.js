import * as THREE from 'three'

const linePath = (points, closed) => {
  const path = new THREE.CurvePath()
  const source = closed ? [...points, points[0]] : points
  for (let index = 0; index < source.length - 1; index += 1) path.add(new THREE.LineCurve3(source[index], source[index + 1]))
  return path
}

const quadraticPath = (points, closed) => {
  if (points.length < 3) return linePath(points, closed)
  const source = closed ? [...points, points[0], points[1]] : points
  const path = new THREE.CurvePath()
  let start = source[0]
  for (let index = 1; index < source.length - 1; index += 1) {
    const end = index === source.length - 2 ? source[index + 1] : source[index].clone().lerp(source[index + 1], 0.5)
    path.add(new THREE.QuadraticBezierCurve3(start, source[index], end))
    start = end
  }
  return path
}

const cubicPath = (points, closed) => {
  if (points.length < 4) return quadraticPath(points, closed)
  const source = closed ? [...points, points[0], points[1], points[2]] : points
  const path = new THREE.CurvePath()
  let index = 0
  while (index + 3 < source.length) { path.add(new THREE.CubicBezierCurve3(source[index], source[index + 1], source[index + 2], source[index + 3])); index += 3 }
  if (index < source.length - 1) path.add(new THREE.LineCurve3(source[index], source[source.length - 1]))
  return path
}

const engineeringPath = (points, closed, bendFactor) => {
  if (points.length < 3) return linePath(points, closed)
  const path = new THREE.CurvePath()
  const factor = THREE.MathUtils.clamp(bendFactor, 0.02, 0.48)
  if (closed) {
    let cursor = points[0].clone().lerp(points[1], factor)
    for (let step = 1; step <= points.length; step += 1) {
      const index = step % points.length
      const corner = points[index]
      const entry = corner.clone().lerp(points[(index - 1 + points.length) % points.length], factor)
      const exit = corner.clone().lerp(points[(index + 1) % points.length], factor)
      path.add(new THREE.LineCurve3(cursor, entry)); path.add(new THREE.QuadraticBezierCurve3(entry, corner, exit)); cursor = exit
    }
    return path
  }
  let cursor = points[0]
  for (let index = 1; index < points.length - 1; index += 1) {
    const corner = points[index]
    const entry = corner.clone().lerp(points[index - 1], factor)
    const exit = corner.clone().lerp(points[index + 1], factor)
    path.add(new THREE.LineCurve3(cursor, entry)); path.add(new THREE.QuadraticBezierCurve3(entry, corner, exit)); cursor = exit
  }
  path.add(new THREE.LineCurve3(cursor, points[points.length - 1]))
  return path
}

export function createEditableCurve(rawPoints, { type = 'catmullrom', closed = false, tension = 0.5, bendFactor = 0.22 } = {}) {
  const points = rawPoints.map((point) => point.isVector3 ? point.clone() : new THREE.Vector3(...point))
  if (type === 'line') return linePath(points, closed)
  if (type === 'quadratic') return quadraticPath(points, closed)
  if (type === 'cubic') return cubicPath(points, closed)
  if (type === 'curvePath') return engineeringPath(points, closed, bendFactor)
  return new THREE.CatmullRomCurve3(points, closed, type, tension)
}

