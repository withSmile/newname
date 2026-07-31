import { useFrame } from '@react-three/fiber'
import React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PARTICLE_PRESETS, useParticles } from './particleStore'

const seed = (i, spread) => {
  const x = (Math.random() - 0.5) * spread
  const y = (Math.random() - 0.5) * spread
  const z = (Math.random() - 0.5) * spread
  return [x, y, z, i * 0.017 % 1]
}

export function ParticleRuntime() {
  const settings = useParticles()
  const points = useRef()
  const state = useRef({ age: 0 })
  const geometry = useMemo(() => new THREE.BufferGeometry(), [])
  const material = useMemo(() => new THREE.PointsMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }), [])
  const buffers = useMemo(() => ({ position: new Float32Array(settings.count * 3), color: new Float32Array(settings.count * 3), velocity: new Float32Array(settings.count * 3), life: new Float32Array(settings.count) }), [settings.count])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useEffect(() => { material.size = settings.size; material.needsUpdate = true }, [material, settings.size])
  useEffect(() => {
    const primary = new THREE.Color(settings.color); const secondary = new THREE.Color(settings.secondary)
    for (let i = 0; i < settings.count; i += 1) {
      const [x, y, z, t] = seed(i, settings.spread); const o = i * 3
      buffers.position[o] = x; buffers.position[o + 1] = y; buffers.position[o + 2] = z
      const direction = settings.preset === 'rain' || settings.preset === 'snow' ? [x * 0.02, 1, z * 0.02] : [x * 0.8, 1 + Math.random() * 1.8, z * 0.8]
      buffers.velocity[o] = direction[0] * settings.speed; buffers.velocity[o + 1] = direction[1] * settings.speed; buffers.velocity[o + 2] = direction[2] * settings.speed
      buffers.life[i] = t * settings.lifetime
      new THREE.Color().lerpColors(primary, secondary, t).toArray(buffers.color, o)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.position, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(buffers.color, 3)); state.current.age = 0
  }, [buffers, geometry, settings])
  useFrame((_, delta) => {
    if (!settings.enabled || !points.current) { if (points.current) points.current.visible = false; return }
    points.current.visible = true; state.current.age += delta
    const positions = geometry.attributes.position.array
    for (let i = 0; i < settings.count; i += 1) { const o = i * 3; buffers.life[i] += delta; if (buffers.life[i] > settings.lifetime) { const [x, y, z] = seed(i, settings.spread); positions[o] = x; positions[o + 1] = settings.preset === 'rain' || settings.preset === 'snow' ? settings.spread * 0.5 : 0; positions[o + 2] = z; buffers.life[i] = 0 } else { positions[o] += buffers.velocity[o] * delta; positions[o + 1] += (buffers.velocity[o + 1] + settings.gravity * buffers.life[i]) * delta; positions[o + 2] += buffers.velocity[o + 2] * delta } }
    geometry.attributes.position.needsUpdate = true
  })
  return <points ref={points} position={[0, 1.2, 0]} geometry={geometry} material={material} />
}
