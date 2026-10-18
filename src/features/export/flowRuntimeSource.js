export const flowRuntimeSource = String.raw`function createPatternTexture(mode) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, 256, 64)
  {
    const gradient = context.createLinearGradient(0, 0, 256, 0)
    gradient.addColorStop(0, '#071012')
    gradient.addColorStop(0.35, '#15373c')
    gradient.addColorStop(0.5, '#ffffff')
    gradient.addColorStop(0.65, '#15373c')
    gradient.addColorStop(1, '#071012')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function linePath(points, closed) {
  const path = new THREE.CurvePath()
  const pathPoints = closed ? [...points, points[0]] : points
  for (let index = 0; index < pathPoints.length - 1; index += 1) path.add(new THREE.LineCurve3(pathPoints[index], pathPoints[index + 1]))
  return path
}

function quadraticPath(points, closed) {
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

function cubicPath(points, closed) {
  if (points.length < 4) return quadraticPath(points, closed)
  const source = closed ? [...points, points[0], points[1], points[2]] : points
  const path = new THREE.CurvePath()
  let index = 0
  while (index + 3 < source.length) {
    path.add(new THREE.CubicBezierCurve3(source[index], source[index + 1], source[index + 2], source[index + 3]))
    index += 3
  }
  if (index < source.length - 1) path.add(new THREE.LineCurve3(source[index], source[source.length - 1]))
  return path
}

function engineeringPath(points, closed, bendFactor) {
  if (points.length < 3) return linePath(points, closed)
  const path = new THREE.CurvePath()
  const factor = THREE.MathUtils.clamp(bendFactor, 0.02, 0.48)
  if (closed) {
    let cursor = points[0].clone().lerp(points[1], factor)
    for (let step = 1; step <= points.length; step += 1) {
      const index = step % points.length
      const corner = points[index]
      const previous = points[(index - 1 + points.length) % points.length]
      const next = points[(index + 1) % points.length]
      const entry = corner.clone().lerp(previous, factor)
      const exit = corner.clone().lerp(next, factor)
      path.add(new THREE.LineCurve3(cursor, entry))
      path.add(new THREE.QuadraticBezierCurve3(entry, corner, exit))
      cursor = exit
    }
    return path
  }
  const source = closed ? [...points, points[0], points[1]] : points
  let cursor = source[0]
  for (let index = 1; index < source.length - 1; index += 1) {
    const corner = source[index]
    const entry = corner.clone().lerp(source[index - 1], factor)
    const exit = corner.clone().lerp(source[index + 1], factor)
    if (cursor.distanceToSquared(entry) > 1e-6) path.add(new THREE.LineCurve3(cursor, entry))
    path.add(new THREE.QuadraticBezierCurve3(entry, corner, exit))
    cursor = exit
  }
  if (!closed && cursor.distanceToSquared(source[source.length - 1]) > 1e-6) path.add(new THREE.LineCurve3(cursor, source[source.length - 1]))
  return path
}

function createPipeCurve(rawPoints, object) {
  const points = rawPoints.map((point) => new THREE.Vector3(...point))
  const type = object.pipeCurveType || 'catmullrom'
  const closed = Boolean(object.pipeClosed)
  if (type === 'line') return linePath(points, closed)
  if (type === 'quadratic') return quadraticPath(points, closed)
  if (type === 'cubic') return cubicPath(points, closed)
  if (type === 'curvePath') return engineeringPath(points, closed, object.pipeBendFactor ?? 0.22)
  return new THREE.CatmullRomCurve3(points, closed, type, object.pipeTension ?? 0.5)
}

function createArrowTrailGeometry(size, tailScale) {
  const positions = []
  const colors = []
  const tailLength = size * THREE.MathUtils.clamp(tailScale, 0.8, 8)
  const tailHalfWidth = size * 0.11
  const headHalfWidth = size * 0.5
  const headLength = size * 0.95
  const pushVertex = (x, y, alpha) => {
    positions.push(x, y, 0)
    colors.push(1, 1, 1, alpha)
  }
  const pushTriangle = (a, b, c) => {
    ;[a, b, c].forEach(([x, y, alpha]) => pushVertex(x, y, alpha))
  }

  // Vertex alpha fades the tail without requiring one transparent mesh per segment.
  pushTriangle([-tailHalfWidth * 0.22, -tailLength, 0], [tailHalfWidth * 0.22, -tailLength, 0], [-tailHalfWidth, 0, 0.9])
  pushTriangle([tailHalfWidth * 0.22, -tailLength, 0], [tailHalfWidth, 0, 0.9], [-tailHalfWidth, 0, 0.9])
  pushTriangle([-headHalfWidth, 0, 0.96], [headHalfWidth, 0, 0.96], [0, headLength, 1])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

`
