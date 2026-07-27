import React, { useEffect, useMemo, useRef } from 'react'
import { Line, TransformControls } from '@react-three/drei'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { useShallow } from 'zustand/react/shallow'
import { useRoaming } from './roamingStore'
import { createEditableCurve } from '../../../shared/math/editableCurve'

THREE.Mesh.prototype.raycast = acceleratedRaycast
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree

const keys = new Set()
const direction = new THREE.Vector3()
const right = new THREE.Vector3()
const candidate = new THREE.Vector3()
const down = new THREE.Vector3(0, -1, 0)
const autoTangent = new THREE.Vector3()
const autoTarget = new THREE.Vector3()
const autoLookMatrix = new THREE.Matrix4()
const autoQuaternion = new THREE.Quaternion()

function prepareColliders(roots) {
  const meshes = []
  roots.forEach((root) => root?.traverse((child) => {
    if (!child.isMesh || !child.visible || !child.geometry?.attributes?.position) return
    if (!child.geometry.boundsTree) child.geometry.computeBoundsTree()
    meshes.push(child)
  }))
  return meshes
}

function RoamingPathPointEditor({ points }) {
  const scene = useThree((state) => state.scene)
  const handles = useRef([])
  const [activePoint, setActivePoint] = React.useState(null)
  const target = activePoint === null ? null : handles.current[activePoint]
  return <>
    {points.map((point, index) => <group key={index} ref={(node) => { handles.current[index] = node }} position={point} renderOrder={30} onPointerDown={(event) => { event.stopPropagation(); setActivePoint(index) }}>
      <mesh renderOrder={30}><sphereGeometry args={[0.16, 20, 14]} /><meshBasicMaterial color="#14191b" transparent opacity={0.94} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
      <mesh renderOrder={31}><sphereGeometry args={[0.105, 20, 14]} /><meshBasicMaterial color={activePoint === index ? '#ffffff' : index === 0 ? '#70bd83' : '#ff7652'} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
    </group>)}
    {target && createPortal(<TransformControls object={target} mode="translate" space="world" size={0.76} onMouseUp={() => useRoaming.getState().updatePoint(activePoint, target.position.toArray())} />, scene)}
  </>
}

export function RoamingRuntime({ objectRefs }) {
  const { camera, controls, gl } = useThree()
  const settings = useRoaming(useShallow((state) => ({
    mode: state.mode, pathPoints: state.pathPoints, speed: state.speed, loop: state.loop,
    curveType: state.curveType, tension: state.tension, bendFactor: state.bendFactor, lookAhead: state.lookAhead, eyeHeight: state.eyeHeight,
    colliderRadius: state.colliderRadius, gravity: state.gravity, sprintMultiplier: state.sprintMultiplier,
    pathEdit: state.pathEdit,
  })))
  const colliders = useRef([])
  const yaw = useRef(0)
  const pitch = useRef(0)
  const verticalSpeed = useRef(0)
  const elapsed = useRef(0)
  const progressWrite = useRef(0)
  const raycaster = useMemo(() => { const ray = new THREE.Raycaster(); ray.firstHitOnly = true; return ray }, [])
  const curve = useMemo(() => settings.pathPoints.length > 1 ? createEditableCurve(settings.pathPoints, { type: settings.curveType, closed: settings.loop, tension: settings.tension, bendFactor: settings.bendFactor }) : null, [settings.pathPoints, settings.loop, settings.curveType, settings.tension, settings.bendFactor])
  const curvePoints = useMemo(() => curve?.getPoints(Math.max(32, settings.pathPoints.length * 24)) || [], [curve, settings.pathPoints.length])

  useEffect(() => {
    colliders.current = prepareColliders([...objectRefs.values()])
    useRoaming.getState().setCollisionReady(colliders.current.length > 0)
  }, [objectRefs, settings.mode])

  useEffect(() => {
    const onKeyDown = (event) => keys.add(event.code)
    const onKeyUp = (event) => keys.delete(event.code)
    const onMouseMove = (event) => {
      if (settings.mode !== 'manual' || document.pointerLockElement !== gl.domElement) return
      yaw.current -= event.movementX * 0.0022
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0022, -1.48, 1.48)
    }
    const onPointerLock = () => { if (settings.mode === 'manual' && document.pointerLockElement !== gl.domElement) useRoaming.getState().setMode('idle') }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLock)
    return () => {
      keys.clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLock)
    }
  }, [settings.mode, gl])

  useEffect(() => {
    if (controls) controls.enabled = settings.mode === 'idle'
    if (settings.mode === 'manual') {
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      pitch.current = euler.x
      yaw.current = euler.y
      verticalSpeed.current = 0
    }
    if (settings.mode === 'auto') elapsed.current = useRoaming.getState().progress
    return () => { if (controls) controls.enabled = true }
  }, [settings.mode, camera, controls])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (settings.mode === 'auto' && curve) {
      const duration = Math.max(0.5, curve.getLength() / Math.max(0.05, settings.speed))
      elapsed.current += dt / duration
      let t = elapsed.current
      if (settings.loop) t %= 1
      else if (t >= 1) { t = 1; useRoaming.getState().setMode('idle') }
      camera.position.copy(curve.getPointAt(t))
      const lookT = settings.loop ? (t + settings.lookAhead) % 1 : Math.min(1, t + settings.lookAhead)
      curve.getTangentAt(lookT, autoTangent).normalize()
      autoTarget.copy(camera.position).add(autoTangent)
      autoLookMatrix.lookAt(camera.position, autoTarget, camera.up)
      autoQuaternion.setFromRotationMatrix(autoLookMatrix)
      camera.quaternion.slerp(autoQuaternion, 1 - Math.exp(-10 * dt))
      progressWrite.current += dt
      if (progressWrite.current > 0.1) { useRoaming.getState().setProgress(t); progressWrite.current = 0 }
      return
    }
    if (settings.mode !== 'manual') return
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    direction.set(0, 0, 0)
    camera.getWorldDirection(candidate).setY(0).normalize()
    right.crossVectors(candidate, camera.up).normalize()
    if (keys.has('KeyW')) direction.add(candidate)
    if (keys.has('KeyS')) direction.sub(candidate)
    if (keys.has('KeyD')) direction.add(right)
    if (keys.has('KeyA')) direction.sub(right)
    const moveSpeed = settings.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? settings.sprintMultiplier : 1)
    if (direction.lengthSq()) {
      direction.normalize()
      const distance = moveSpeed * dt
      raycaster.set(camera.position, direction)
      raycaster.far = settings.colliderRadius + distance
      if (!raycaster.intersectObjects(colliders.current, false).length) camera.position.addScaledVector(direction, distance)
    }
    raycaster.set(camera.position, down)
    raycaster.far = settings.eyeHeight + 0.6
    const floor = raycaster.intersectObjects(colliders.current, false)[0]
    if (floor) {
      const targetY = floor.point.y + settings.eyeHeight
      if (camera.position.y <= targetY + 0.2) { camera.position.y = targetY; verticalSpeed.current = 0 }
      else { verticalSpeed.current -= settings.gravity * dt; camera.position.y += verticalSpeed.current * dt }
    } else if (camera.position.y <= settings.eyeHeight + 0.2) {
      camera.position.y = settings.eyeHeight
      verticalSpeed.current = 0
    } else {
      verticalSpeed.current -= settings.gravity * dt
      camera.position.y += verticalSpeed.current * dt
    }
    if (camera.position.y < -30) camera.position.set(0, settings.eyeHeight, 5)
  })

  if (settings.mode !== 'idle' || !curvePoints.length) return null
  return <group name="RoamingPathHelper">
    <Line points={curvePoints} color="#e17653" lineWidth={1.2} dashed dashSize={0.18} gapSize={0.1} />
    {settings.pathEdit ? <RoamingPathPointEditor points={settings.pathPoints} /> : settings.pathPoints.map((point, index) => <mesh key={index} position={point} renderOrder={20}><sphereGeometry args={[0.09, 12, 8]} /><meshBasicMaterial color={index === 0 ? '#78b784' : '#e17653'} depthTest={false} depthWrite={false} /></mesh>)}
  </group>
}
