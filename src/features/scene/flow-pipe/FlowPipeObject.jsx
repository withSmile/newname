import React, { forwardRef, useEffect, useMemo, useRef } from 'react'
import { TransformControls } from '@react-three/drei'
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

function FlowArrows({ curve, object }) {
  const meshRef = useRef()
  const offset = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const fallbackAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const count = Math.max(3, Math.round(object.flowArrowCount ?? 12))
  useFrame((_, delta) => {
    if (!meshRef.current) return
    const sign = object.flowDirection === 'reverse' ? -1 : 1
    offset.current = (offset.current + delta * (object.flowSpeed ?? 0.5) * 0.08 * sign + 1) % 1
    for (let index = 0; index < count; index += 1) {
      const t = (index / count + offset.current + 1) % 1
      curve.getPointAt(t, position)
      curve.getTangentAt(t, tangent).normalize().multiplyScalar(sign)
      normal.crossVectors(tangent, up)
      if (normal.lengthSq() < 0.001) normal.crossVectors(tangent, fallbackAxis)
      normal.normalize().cross(tangent).normalize()
      dummy.position.copy(position).addScaledVector(normal, (object.pipeRadius ?? 0.16) * 1.12)
      dummy.quaternion.setFromUnitVectors(up, tangent)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })
  const radius = object.pipeRadius ?? 0.16
  return <instancedMesh ref={meshRef} args={[undefined, undefined, count]} renderOrder={4}>
    <coneGeometry args={[radius * 0.62, radius * 1.9, 8]} />
    <meshBasicMaterial color={object.flowEmissive || '#70f3ff'} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
  </instancedMesh>
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
  const geometry = useMemo(() => {
    const baseGeometry = new THREE.TubeGeometry(curve, object.pipeSegments ?? 96, object.pipeRadius ?? 0.16, object.pipeRadialSegments ?? 16, Boolean(object.pipeClosed))
    if ((object.smoothShading ?? object.pipeSmooth) === false) return baseGeometry
    const smoothGeometry = toCreasedNormals(baseGeometry, THREE.MathUtils.degToRad(object.creaseAngle ?? object.pipeCreaseAngle ?? 60))
    if (smoothGeometry !== baseGeometry) baseGeometry.dispose()
    return smoothGeometry
  }, [curve, object.pipeSegments, object.pipeRadius, object.pipeRadialSegments, object.pipeClosed, object.smoothShading, object.creaseAngle, object.pipeSmooth, object.pipeCreaseAngle])

  useEffect(() => {
    if (object.flowMode !== 'texture' || !object.flowTexture) { setTexture(generatedTexture); return undefined }
    let active = true
    const loaded = new THREE.TextureLoader().load(object.flowTexture, (map) => { if (active) setTexture(map) })
    return () => { active = false; loaded.dispose() }
  }, [object.flowMode, object.flowTexture, generatedTexture])
  useEffect(() => () => generatedTexture.dispose(), [generatedTexture])
  useEffect(() => () => geometry.dispose(), [geometry])
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
    <mesh geometry={geometry} raycast={object.pipeEditPoints ? () => null : undefined} castShadow={object.castShadow !== false} receiveShadow={object.receiveShadow !== false} onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <meshStandardMaterial ref={materialRef} color={object.color || '#55c7d2'} map={flowingMap} emissive={object.flowEmissive || '#2bbac7'} emissiveMap={flowingMap} emissiveIntensity={object.flowMode === 'arrow' ? 0.35 : object.flowIntensity ?? 1.5} roughness={object.roughness ?? 0.35} metalness={object.metalness ?? 0.15} transparent={Boolean(object.transparent) || (object.opacity ?? 1) < 1} opacity={object.opacity ?? 1} depthWrite={object.depthWrite !== false} flatShading={(object.smoothShading ?? object.pipeSmooth) === false} wireframe={shading === 'wireframe'} />
      {selected && !object.pipeEditPoints && <lineSegments><edgesGeometry args={[geometry, 18]} /><lineBasicMaterial color="#fff7dd" /></lineSegments>}
    </mesh>
    {object.flowMode === 'arrow' && <FlowArrows curve={curve} object={object} />}
    {selected && object.pipeEditPoints && <PipePointEditor points={points} radius={object.pipeRadius ?? 0.16} onCommit={onUpdatePoints} />}
  </group>
})
