import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useParticles } from './particleStore'

function softTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d'); const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#fffd'); g.addColorStop(1, '#fff0')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
}

export function ParticleRuntime() {
  const settings = useParticles(); const { camera } = useThree(); const mesh = useRef(); const data = useRef(null)
  const texture = useMemo(() => softTexture(), []); const dummy = useMemo(() => new THREE.Object3D(), []); const frameColor = useMemo(() => new THREE.Color(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), [texture])
  const count = Math.max(1, Math.floor(settings.count || 1))
  useLayoutEffect(() => {
    if (!mesh.current) return undefined
    const positions = new Float32Array(count * 3); const velocities = new Float32Array(count * 3); const ages = new Float32Array(count); const colors = new Array(count)
    const primary = new THREE.Color(settings.color); const secondary = new THREE.Color(settings.secondary); const direction = new THREE.Vector3(...(settings.direction || [0, -1, 0])).normalize()
    for (let i = 0; i < count; i += 1) { const o = i * 3; const spread = settings.spread || 1; positions[o] = (Math.random() - 0.5) * spread; positions[o + 1] = (Math.random() - 0.5) * spread + (settings.preset === 'rain' || settings.preset === 'code' ? spread * 0.5 : 0); positions[o + 2] = (Math.random() - 0.5) * spread; const speed = (settings.speed || 1) * (0.55 + Math.random() * 0.7); velocities[o] = direction.x * speed + (Math.random() - 0.5) * (settings.angle || 10) * 0.01; velocities[o + 1] = direction.y * speed; velocities[o + 2] = direction.z * speed + (Math.random() - 0.5) * (settings.angle || 10) * 0.01; ages[i] = Math.random() * (settings.lifetime || 1); colors[i] = settings.randomColors ? primary.clone().lerp(secondary, Math.random()) : primary.clone().lerp(secondary, i / count) }
    data.current = { positions, velocities, ages, colors, count }
    mesh.current.count = count
    for (let i = 0; i < count; i += 1) mesh.current.setColorAt(i, colors[i])
    mesh.current.instanceColor.needsUpdate = true
    mesh.current.visible = true
    return () => { data.current = null }
  }, [count, settings.preset, settings.direction?.join(','), settings.speed, settings.angle, settings.spread, settings.lifetime, settings.color, settings.secondary, settings.randomColors])
  useFrame((_, delta) => {
    if (!mesh.current || !settings.enabled) { if (mesh.current) mesh.current.visible = false; return }
    if (!data.current) return
    mesh.current.visible = true; const state = data.current; const gravity = settings.gravity || 0; const life = Math.max(0.2, settings.lifetime || 1); const baseSize = settings.size || 0.05
    for (let i = 0; i < state.count; i += 1) { const o = i * 3; state.ages[i] += delta; if (state.ages[i] > life) { state.ages[i] = 0; state.positions[o] = (Math.random() - 0.5) * settings.spread; state.positions[o + 1] = (settings.preset === 'rain' || settings.preset === 'code' ? settings.spread * 0.5 : 0); state.positions[o + 2] = (Math.random() - 0.5) * settings.spread } state.velocities[o + 1] += gravity * delta; state.positions[o] += state.velocities[o] * delta; state.positions[o + 1] += state.velocities[o + 1] * delta; state.positions[o + 2] += state.velocities[o + 2] * delta; const t = state.ages[i] / life; const fade = Math.sin(Math.PI * t); const size = baseSize * (0.7 + fade * 0.6); dummy.position.set(state.positions[o], state.positions[o + 1] + 1.2, state.positions[o + 2]); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(size, size * ((settings.preset === 'rain' || settings.preset === 'code') ? settings.stretch || 2 : 1), 1); dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix); mesh.current.setColorAt(i, state.colors[i].clone().multiplyScalar(0.35 + fade * 0.65)) }
    mesh.current.instanceMatrix.needsUpdate = true; mesh.current.instanceColor.needsUpdate = true
  })
  useEffect(() => () => { texture.dispose(); geometry.dispose(); material.dispose() }, [texture, geometry, material])
  return <group><instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} /><points position={[0, 1.2, 0]}><sphereGeometry args={[Math.max(0.4, settings.spread * 0.6), 24, 16]} /><pointsMaterial map={texture} color={settings.color} size={Math.max(0.04, settings.size * 1.8)} transparent opacity={settings.enabled ? settings.opacity : 0} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation /></points></group>
}
