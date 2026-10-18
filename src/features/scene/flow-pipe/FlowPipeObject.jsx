import React, { forwardRef, useEffect, useMemo, useRef } from 'react'
import { Line, TransformControls } from '@react-three/drei'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

function createPatternTexture(mode) {
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

function FlowRibbon({ curve, object, selected, onSelect }) {
  const segments = THREE.MathUtils.clamp(Math.round(object.pipeSegments ?? 96), 16, 256)
  const points = useMemo(() => curve.getSpacedPoints(segments), [curve, segments])
  const width = Math.max(0.025, object.flowPathWidth ?? 0.09)
  const color = object.flowArrowColor || object.flowEmissive || '#70f3ff'
  const handleSelect = (event) => { event.stopPropagation(); onSelect() }
  return <>
    <Line points={points} color={selected ? '#fff4dd' : '#10282d'} lineWidth={width * (selected ? 1.9 : 1.65)} worldUnits transparent opacity={selected ? 0.72 : 0.5} depthWrite={false} renderOrder={1} onClick={handleSelect} />
    <Line points={points} color={color} lineWidth={width} worldUnits transparent opacity={0.52} depthWrite={false} renderOrder={2} onClick={handleSelect} />
  </>
}

function FlowArrows({ curve, object, surfaceOffset = 0, onSelect }) {
  const meshRef = useRef()
  const haloRef = useRef()
  const offset = useRef(0)
  const camera = useThree((state) => state.camera)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const cameraLocal = useMemo(() => new THREE.Vector3(), [])
  const planeNormal = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const fallbackAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const rotation = useMemo(() => new THREE.Matrix4(), [])
  const length = useMemo(() => Math.max(curve.getLength(), 0.001), [curve])
  const arrowSize = Math.max(0.04, object.flowArrowSize ?? 0.28)
  // Density is arrows per world unit; derive it from spacing for older saved scenes.
  const legacyDensity = 1 / Math.max(0.08, object.flowArrowSpacing ?? 0.72)
  const density = THREE.MathUtils.clamp(object.flowArrowDensity ?? legacyDensity, 0.2, 8)
  const count = THREE.MathUtils.clamp(Math.round(length * density), 1, 128)
  const geometry = useMemo(() => createArrowTrailGeometry(arrowSize, object.flowArrowTailLength ?? 2.4), [arrowSize, object.flowArrowTailLength])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    meshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    haloRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [count])
  useFrame((_, delta) => {
    if (!meshRef.current) return
    const sign = object.flowDirection === 'reverse' ? -1 : 1
    // Normalize by curve length so speed remains world-units per second on every path.
    offset.current = (offset.current + delta * Math.max(0, object.flowSpeed ?? 0.5) / length * sign + 1) % 1
    camera.getWorldPosition(cameraLocal)
    meshRef.current.parent?.worldToLocal(cameraLocal)
    for (let index = 0; index < count; index += 1) {
      const t = (index / count + offset.current + 1) % 1
      curve.getPointAt(t, position)
      curve.getTangentAt(t, tangent).normalize().multiplyScalar(sign)

      // Build a camera-facing frame around the curve tangent so flat arrows stay readable.
      planeNormal.copy(cameraLocal).sub(position)
      planeNormal.addScaledVector(tangent, -planeNormal.dot(tangent))
      if (planeNormal.lengthSq() < 0.0001) planeNormal.copy(up).addScaledVector(tangent, -up.dot(tangent))
      if (planeNormal.lengthSq() < 0.0001) planeNormal.copy(fallbackAxis).addScaledVector(tangent, -fallbackAxis.dot(tangent))
      planeNormal.normalize()
      side.crossVectors(tangent, planeNormal).normalize()
      planeNormal.crossVectors(side, tangent).normalize()
      rotation.makeBasis(side, tangent, planeNormal)
      dummy.position.copy(position).addScaledVector(planeNormal, surfaceOffset)
      dummy.quaternion.setFromRotationMatrix(rotation)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
      if (haloRef.current) {
        dummy.scale.set(1.42, 1.04, 1.42)
        dummy.updateMatrix()
        haloRef.current.setMatrixAt(index, dummy.matrix)
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (haloRef.current) haloRef.current.instanceMatrix.needsUpdate = true
  })
  const color = object.flowArrowColor || object.flowEmissive || '#70f3ff'
  const handleSelect = (event) => { event.stopPropagation(); onSelect() }
  return <>
    <instancedMesh ref={haloRef} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={3} onClick={handleSelect}>
      <meshBasicMaterial color={color} vertexColors transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={4} onClick={handleSelect}>
      <meshBasicMaterial color={color} vertexColors transparent opacity={0.96} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  </>
}

function PipePointEditor({ points, radius, onCommit }) {
  const handles = useRef([])
  const scene = useThree((state) => state.scene)
  const [activePoint, setActivePoint] = React.useState(null)
  const target = activePoint === null ? null : handles.current[activePoint]
  const handleRadius = Math.max(0.14, radius * 1.15)
  return <>
    {points.map((point, index) => <group key={index} ref={(node) => { handles.current[index] = node }} position={point} renderOrder={20} onPointerDown={(event) => { event.stopPropagation(); setActivePoint(index) }}>
      <mesh renderOrder={20}>
        <sphereGeometry args={[handleRadius, 20, 14]} />
        <meshBasicMaterial color="#15191b" transparent opacity={0.92} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh renderOrder={21}>
        <sphereGeometry args={[handleRadius * 0.68, 20, 14]} />
        <meshBasicMaterial color={activePoint === index ? '#ffffff' : '#ff7652'} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>)}
    {target && createPortal(<TransformControls object={target} mode="translate" space="local" size={0.72} onMouseUp={() => {
      const next = points.map((point) => [...point])
      next[activePoint] = target.position.toArray()
      onCommit(next)
    }} />, scene)}
  </>
}

export const FlowPipeObject = forwardRef(function FlowPipeObject({ object, selected, shading, onSelect, onUpdatePoints }, ref) {
  const materialRef = useRef()
  const generatedTexture = useMemo(() => createPatternTexture(object.flowMode || 'glow'), [object.flowMode])
  const [texture, setTexture] = React.useState(generatedTexture)
  const points = object.pipePoints?.length > 1 ? object.pipePoints : [[-1.5, 0, 0], [0, 0.5, 0], [1.5, 0, 0]]
  const curve = useMemo(() => createPipeCurve(points, object), [points, object.pipeClosed, object.pipeCurveType, object.pipeTension, object.pipeBendFactor])
  const arrowCarrier = object.flowArrowCarrier || 'ribbon'
  const usesTube = object.flowMode !== 'arrow' || arrowCarrier === 'tube'
  const geometry = useMemo(() => {
    if (!usesTube) return null
    const baseGeometry = new THREE.TubeGeometry(curve, object.pipeSegments ?? 96, object.pipeRadius ?? 0.16, object.pipeRadialSegments ?? 16, Boolean(object.pipeClosed))
    if ((object.smoothShading ?? object.pipeSmooth) === false) return baseGeometry
    const smoothGeometry = toCreasedNormals(baseGeometry, THREE.MathUtils.degToRad(object.creaseAngle ?? object.pipeCreaseAngle ?? 60))
    if (smoothGeometry !== baseGeometry) baseGeometry.dispose()
    return smoothGeometry
  }, [usesTube, curve, object.pipeSegments, object.pipeRadius, object.pipeRadialSegments, object.pipeClosed, object.smoothShading, object.creaseAngle, object.pipeSmooth, object.pipeCreaseAngle])

  useEffect(() => {
    if (object.flowMode !== 'texture' || !object.flowTexture) { setTexture(generatedTexture); return undefined }
    let active = true
    const loaded = new THREE.TextureLoader().load(object.flowTexture, (map) => { if (active) setTexture(map) })
    return () => { active = false; loaded.dispose() }
  }, [object.flowMode, object.flowTexture, generatedTexture])
  useEffect(() => () => generatedTexture.dispose(), [generatedTexture])
  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(Math.max(0.25, object.flowRepeat ?? 4), 1)
    texture.needsUpdate = true
  }, [texture, object.flowRepeat])
  useFrame((_, delta) => {
    if (!texture) return
    texture.offset.x += delta * (object.flowSpeed ?? 0.5) * (object.flowDirection === 'reverse' ? 1 : -1)
  })

  const flowingMap = object.flowMode === 'arrow' ? null : texture
  return <group ref={ref} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible}>
    {geometry && <mesh geometry={geometry} raycast={object.pipeEditPoints ? () => null : undefined} castShadow={object.castShadow !== false} receiveShadow={object.receiveShadow !== false} onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <meshStandardMaterial ref={materialRef} color={object.color || '#55c7d2'} map={flowingMap} emissive={object.flowGlowColor || object.flowEmissive || '#2bbac7'} emissiveMap={flowingMap} emissiveIntensity={object.flowMode === 'arrow' ? 0.35 : object.flowIntensity ?? 1.5} roughness={object.roughness ?? 0.35} metalness={object.metalness ?? 0.15} transparent={Boolean(object.transparent) || (object.opacity ?? 1) < 1} opacity={object.opacity ?? 1} depthWrite={object.depthWrite !== false} flatShading={(object.smoothShading ?? object.pipeSmooth) === false} wireframe={shading === 'wireframe'} />
      {selected && !object.pipeEditPoints && <lineSegments><edgesGeometry args={[geometry, 18]} /><lineBasicMaterial color="#fff7dd" /></lineSegments>}
    </mesh>}
    {object.flowMode === 'arrow' && arrowCarrier === 'ribbon' && <FlowRibbon curve={curve} object={object} selected={selected} onSelect={onSelect} />}
    {object.flowMode === 'arrow' && <FlowArrows curve={curve} object={object} surfaceOffset={arrowCarrier === 'tube' ? (object.pipeRadius ?? 0.16) * 1.08 : 0.012} onSelect={onSelect} />}
    {selected && object.pipeEditPoints && <PipePointEditor points={points} radius={object.pipeRadius ?? 0.16} onCommit={onUpdatePoints} />}
  </group>
})
