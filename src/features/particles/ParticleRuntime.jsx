import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { useParticles } from './particleStore'

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)
const BILLBOARD_PRESETS = [
  'snow', 'fire', 'fireworks', 'fireflies', 'stardust', 'portal', 'fountain', 'shockwave', 'galaxy',
  'dandelion', 'leaves', 'petals', 'sandstorm', 'bubbles', 'splash', 'steam', 'ash', 'thunder',
  'upload', 'hologram', 'energyCore', 'atom', 'laserDust', 'arcNodes', 'wormhole', 'shield', 'radar',
  'healing', 'ice', 'poison', 'shadow', 'holyLight', 'fireball', 'sword', 'magicCircle', 'charge',
]
const BURST_BEHAVIORS = ['burst']
const LOOP_BURST_BEHAVIORS = ['ring', 'slash', 'charge']
const MAX_DELTA = 1 / 20
const STATS_INTERVAL = 0.15

const selectRuntimeSettings = (state) => ({
  enabled: state.enabled, playing: state.playing, simulationSpeed: state.simulationSpeed, restartToken: state.restartToken,
  preset: state.preset, count: state.count, rate: state.rate, angle: state.angle, opacity: state.opacity, stretch: state.stretch,
  randomColors: state.randomColors, direction: state.direction, wind: state.wind, position: state.position, color: state.color,
  secondary: state.secondary, size: state.size, speed: state.speed, gravity: state.gravity, lifetime: state.lifetime,
  spread: state.spread, spawnHeight: state.spawnHeight, killHeight: state.killHeight,
  behavior: state.behavior,
})

function sampleDirection(direction, angle, target, quaternion) {
  if (angle >= 359.5) {
    const y = Math.random() * 2 - 1
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = Math.random() * Math.PI * 2
    return target.set(Math.cos(phi) * radius, y, Math.sin(phi) * radius)
  }
  const halfAngle = THREE.MathUtils.degToRad(Math.min(angle, 180) * 0.5)
  const cosTheta = THREE.MathUtils.lerp(1, Math.cos(halfAngle), Math.random())
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
  const phi = Math.random() * Math.PI * 2
  target.set(Math.cos(phi) * sinTheta, cosTheta, Math.sin(phi) * sinTheta)
  quaternion.setFromUnitVectors(UP, direction)
  return target.applyQuaternion(quaternion).normalize()
}

function geometryForPreset(preset) {
  if (BILLBOARD_PRESETS.includes(preset)) return new THREE.PlaneGeometry(1, 1)
  if (preset === 'rain' || preset === 'code') return new THREE.BoxGeometry(1, 1, 1)
  if (preset === 'mist') return new THREE.SphereGeometry(0.5, 8, 6)
  return new THREE.IcosahedronGeometry(0.5, 0)
}

function createParticleTexture(preset) {
  if (!BILLBOARD_PRESETS.includes(preset)) return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, 128, 128)

  if (preset === 'snow') {
    context.translate(64, 64)
    context.strokeStyle = '#ffffff'
    context.fillStyle = '#ffffff'
    context.lineWidth = 5
    context.lineCap = 'round'
    context.shadowColor = '#dff7ff'
    context.shadowBlur = 8
    for (let branch = 0; branch < 6; branch += 1) {
      context.save()
      context.rotate(branch * Math.PI / 3)
      context.beginPath()
      context.moveTo(0, 0)
      context.lineTo(0, -50)
      context.stroke()
      for (const y of [-22, -35]) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(-10, y + 10)
        context.moveTo(0, y)
        context.lineTo(10, y + 10)
        context.stroke()
      }
      context.restore()
    }
    context.beginPath()
    context.arc(0, 0, 6, 0, Math.PI * 2)
    context.fill()
  } else if (preset === 'fire') {
    const gradient = context.createRadialGradient(64, 78, 2, 64, 66, 58)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.18, 'rgba(255,255,255,.95)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.save()
    context.scale(0.68, 1)
    context.fillStyle = gradient
    context.fillRect(30, 4, 128, 124)
    context.restore()
  } else {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, preset === 'fireflies' ? 48 : 62)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(preset === 'fireflies' ? 0.08 : 0.12, 'rgba(255,255,255,1)')
    gradient.addColorStop(preset === 'portal' ? 0.26 : 0.36, 'rgba(255,255,255,.62)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    if (preset === 'stardust') {
      context.fillStyle = 'rgba(255,255,255,.72)'
      context.fillRect(61, 10, 6, 108)
      context.fillRect(10, 61, 108, 6)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  return texture
}

function createParticle() {
  return { age: 0, life: 1, size: 1, rotation: 0, spin: 0, seed: 0, layer: 0, radius: 0, phase: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3() }
}

function createPool(capacity) {
  return { active: [], free: Array.from({ length: capacity }, createParticle) }
}

export function ParticleRuntime() {
  const settings = useParticles(useShallow(selectRuntimeSettings))
  const meshRef = useRef(null)
  const accumulator = useRef(0)
  const burstClock = useRef(0)
  const statsClock = useRef(0)
  const colorA = useMemo(() => new THREE.Color(), [])
  const colorB = useMemo(() => new THREE.Color(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const direction = useMemo(() => new THREE.Vector3(), [])
  const wind = useMemo(() => new THREE.Vector3(), [])
  const orientation = useMemo(() => new THREE.Vector3(), [])
  const coneQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const billboardQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const inverseBillboardQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const spinQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const capacity = THREE.MathUtils.clamp(Math.floor(settings.count), 1, 5000)
  const pool = useMemo(() => createPool(capacity), [capacity, settings.restartToken])
  const geometry = useMemo(() => geometryForPreset(settings.preset), [settings.preset])
  const texture = useMemo(() => createParticleTexture(settings.preset), [settings.preset])
  const instanceColor = useMemo(() => {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3)
    attribute.setUsage(THREE.DynamicDrawUsage)
    return attribute
  }, [capacity])
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: texture,
    alphaTest: settings.preset === 'snow' ? 0.025 : 0,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: ['rain', 'snow', 'mist'].includes(settings.preset) ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  }), [settings.preset, texture])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => texture?.dispose(), [texture])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => { material.opacity = settings.opacity; material.needsUpdate = true }, [material, settings.opacity])
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.instanceColor = instanceColor
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    material.needsUpdate = true
  }, [geometry, instanceColor, material, capacity])
  useEffect(() => {
    colorA.set(settings.color)
    colorB.set(settings.secondary)
    pool.active.forEach((particle, index) => {
      const progress = THREE.MathUtils.clamp(particle.age / particle.life, 0, 1)
      color.copy(colorA).lerp(colorB, progress)
      if (settings.randomColors && settings.preset === 'fireworks') color.offsetHSL(particle.seed, 0.08, 0)
      if (settings.preset === 'mist') color.multiplyScalar(THREE.MathUtils.lerp(0.7, 1, Math.sin(Math.PI * progress)))
      instanceColor.setXYZ(index, color.r, color.g, color.b)
    })
    instanceColor.needsUpdate = true
  }, [color, colorA, colorB, instanceColor, pool, settings.color, settings.preset, settings.randomColors, settings.secondary])
  useEffect(() => {
    accumulator.current = 0
    burstClock.current = settings.preset === 'fireworks' ? settings.lifetime : 0
    statsClock.current = STATS_INTERVAL
    if (meshRef.current) meshRef.current.count = 0
    useParticles.getState().setStats(0)
  }, [pool, settings.lifetime, settings.preset])

  useFrame(({ camera }, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh || !settings.enabled || !settings.playing) return

    const delta = Math.min(rawDelta, MAX_DELTA) * settings.simulationSpeed
    billboardQuaternion.copy(camera.quaternion)
    inverseBillboardQuaternion.copy(billboardQuaternion).invert()
    const preset = settings.preset
    direction.set(...settings.direction)
    if (direction.lengthSq() < 1e-6) direction.copy(UP)
    direction.normalize()
    wind.set(...settings.wind)
    colorA.set(settings.color)
    colorB.set(settings.secondary)

    const behavior = settings.behavior || preset
    const isBurst = BURST_BEHAVIORS.includes(behavior)
      || LOOP_BURST_BEHAVIORS.includes(behavior)
      || preset === 'fireworks'
      || preset === 'shockwave'
    let spawnCount = 0
    if (isBurst) {
      burstClock.current += delta
      const interval = preset === 'shockwave' ? settings.lifetime * 0.82 : settings.lifetime
      if (burstClock.current >= interval) {
        burstClock.current %= interval
        spawnCount = Math.max(1, Math.floor(settings.rate))
      }
    } else {
      accumulator.current += settings.rate * delta
      spawnCount = Math.floor(accumulator.current)
      accumulator.current -= spawnCount
    }
    spawnCount = Math.min(spawnCount, pool.free.length)

    for (let amount = 0; amount < spawnCount; amount += 1) {
      const particle = pool.free.pop()
      pool.active.push(particle)
      particle.age = 0
      particle.life = settings.lifetime * THREE.MathUtils.lerp(0.72, 1, Math.random())
      particle.size = settings.size * THREE.MathUtils.lerp(0.72, 1.35, Math.random())
      particle.rotation = Math.random() * Math.PI * 2
      particle.spin = (Math.random() * 2 - 1) * (preset === 'snow' ? 1.2 : 2)
      particle.seed = Math.random()
      particle.layer = preset === 'fireworks' || behavior === 'atom' ? Math.floor(Math.random() * 3) : 0
      particle.radius = 0
      particle.phase = Math.random() * Math.PI * 2
      particle.position.set(settings.position[0], settings.position[1], settings.position[2])

      if (['rain', 'snow', 'code'].includes(preset) || ['fall', 'storm'].includes(behavior)) {
        particle.position.x += (Math.random() * 2 - 1) * settings.spread
        particle.position.z += (Math.random() * 2 - 1) * settings.spread
        particle.position.y += settings.spawnHeight + Math.random() * 0.65
      } else if (behavior === 'drift') {
        particle.position.x -= settings.spread * 0.5
        particle.position.y += Math.random() * settings.spawnHeight
        particle.position.z += (Math.random() * 2 - 1) * settings.spread
      } else if (['burst', 'charge'].includes(behavior) || preset === 'fireworks') {
        const radius = behavior === 'charge' ? settings.spread * THREE.MathUtils.lerp(0.65, 1, Math.random()) : Math.cbrt(Math.random()) * settings.spread * 0.08
        sampleDirection(UP, 360, orientation, coneQuaternion)
        particle.position.addScaledVector(orientation, radius)
      } else if (preset === 'fireflies' || behavior === 'shield') {
        const radius = behavior === 'shield' ? settings.spread : Math.cbrt(Math.random()) * settings.spread
        sampleDirection(UP, 360, orientation, coneQuaternion)
        particle.position.addScaledVector(orientation, radius)
      } else if (preset === 'portal') {
        particle.radius = settings.spread * THREE.MathUtils.lerp(0.72, 1.08, Math.random())
        particle.position.x += Math.cos(particle.phase) * particle.radius
        particle.position.y += Math.sin(particle.phase) * particle.radius
        particle.position.z += (Math.random() * 2 - 1) * 0.16
      } else if (preset === 'galaxy') {
        const arm = Math.floor(Math.random() * 4)
        particle.radius = settings.spread * Math.pow(Math.random(), 0.62)
        particle.phase = arm * Math.PI / 2 + particle.radius * 1.22 + (Math.random() - 0.5) * 0.34
        particle.position.x += Math.cos(particle.phase) * particle.radius
        particle.position.z += Math.sin(particle.phase) * particle.radius
        particle.position.y += (Math.random() - 0.5) * (0.12 + particle.radius * 0.045)
      } else if (['orbit', 'core', 'atom', 'wormhole', 'circle'].includes(behavior)) {
        particle.radius = settings.spread * THREE.MathUtils.lerp(0.18, 1, Math.pow(Math.random(), 0.7))
        particle.position.x += Math.cos(particle.phase) * particle.radius
        particle.position.z += Math.sin(particle.phase) * particle.radius
        particle.position.y += behavior === 'wormhole' ? (particle.radius - settings.spread * 0.5) * 0.6 : (Math.random() - 0.5) * 0.25
      } else if (['ring', 'slash'].includes(behavior) || preset === 'shockwave') {
        particle.phase = behavior === 'slash' ? THREE.MathUtils.lerp(-1.15, 1.15, Math.random()) : Math.random() * Math.PI * 2
        particle.position.x += Math.cos(particle.phase) * settings.spread * 0.15
        particle.position.z += Math.sin(particle.phase) * settings.spread * 0.15
      } else if (behavior === 'implode') {
        sampleDirection(UP, 360, orientation, coneQuaternion)
        particle.position.addScaledVector(orientation, settings.spread * THREE.MathUtils.lerp(0.65, 1, Math.random()))
      } else if (['stream', 'scan', 'beam', 'beamDown'].includes(behavior)) {
        particle.position.x += (Math.random() * 2 - 1) * settings.spread
        particle.position.y += (Math.random() - 0.5) * (behavior === 'scan' ? settings.spread : 0.7)
        particle.position.z += (Math.random() * 2 - 1) * settings.spread * 0.25
      } else {
        particle.position.x += (Math.random() * 2 - 1) * settings.spread * 0.2
        particle.position.z += (Math.random() * 2 - 1) * settings.spread * 0.2
      }

      if (['ring', 'slash'].includes(behavior) || preset === 'shockwave') particle.velocity.set(Math.cos(particle.phase), 0, Math.sin(particle.phase))
      else if (['orbit', 'core', 'atom', 'wormhole', 'shield', 'circle'].includes(behavior) || preset === 'galaxy' || preset === 'portal') particle.velocity.set(0, 0, 0)
      else if (behavior === 'implode' || behavior === 'charge') {
        orientation.set(...settings.position)
        particle.velocity.copy(particle.position).sub(orientation).normalize().negate()
      } else sampleDirection(direction, preset === 'fireworks' || behavior === 'burst' ? 360 : settings.angle, particle.velocity, coneQuaternion)
      const speedVariation = preset === 'fireworks'
        ? THREE.MathUtils.lerp(0.5 + particle.layer * 0.18, 0.8 + particle.layer * 0.2, Math.random())
        : THREE.MathUtils.lerp(0.58, 1.18, Math.random())
      particle.velocity.multiplyScalar(settings.speed * speedVariation)
    }

    let index = 0
    while (index < pool.active.length) {
      const particle = pool.active[index]
      particle.age += delta
      const progress = particle.age / particle.life
      const belowFloor = ['rain', 'snow', 'code'].includes(preset) && particle.position.y <= settings.killHeight
      if (progress >= 1 || belowFloor) {
        pool.free.push(particle)
        const last = pool.active.pop()
        if (index < pool.active.length) pool.active[index] = last
        continue
      }

      particle.velocity.y += settings.gravity * delta
      particle.velocity.addScaledVector(wind, delta)
      if (preset === 'snow') {
        particle.position.x += Math.sin(particle.age * 1.7 + particle.seed * 12) * delta * 0.28
        particle.position.z += Math.cos(particle.age * 1.25 + particle.seed * 9) * delta * 0.2
      }
      if (preset === 'fire') {
        particle.velocity.x += Math.sin(particle.age * 8 + particle.seed * 18) * delta * 0.35
        particle.velocity.z += Math.cos(particle.age * 7 + particle.seed * 15) * delta * 0.28
        particle.velocity.multiplyScalar(Math.exp(-0.32 * delta))
      }
      if (preset === 'fireworks') particle.velocity.multiplyScalar(Math.exp(-(0.34 + particle.layer * 0.12) * delta))
      if (preset === 'fireflies') {
        particle.velocity.x += Math.sin(particle.age * 1.7 + particle.phase) * delta * 0.38
        particle.velocity.y += Math.cos(particle.age * 1.3 + particle.seed * 11) * delta * 0.24
        particle.velocity.z += Math.sin(particle.age * 1.5 + particle.seed * 17) * delta * 0.32
        particle.velocity.multiplyScalar(Math.exp(-0.75 * delta))
      }
      if (preset === 'stardust') {
        const dx = particle.position.x - settings.position[0]
        const dz = particle.position.z - settings.position[2]
        particle.velocity.x += -dz * delta * 1.15
        particle.velocity.z += dx * delta * 1.15
      }
      if (['fall', 'drift', 'bubble', 'smoke', 'ash', 'heal'].includes(behavior)) {
        particle.velocity.x += Math.sin(particle.age * 1.7 + particle.phase) * delta * 0.32
        particle.velocity.z += Math.cos(particle.age * 1.35 + particle.seed * 17) * delta * 0.24
      }
      if (behavior === 'electric') {
        particle.position.x += (Math.random() - 0.5) * settings.spread * delta * 3
        particle.position.z += (Math.random() - 0.5) * settings.spread * delta * 3
      }
      if (preset === 'portal') {
        particle.phase += delta * settings.speed * THREE.MathUtils.lerp(0.72, 1.25, particle.seed)
        particle.radius *= Math.exp(-0.12 * delta)
        particle.position.x = settings.position[0] + Math.cos(particle.phase) * particle.radius
        particle.position.y = settings.position[1] + Math.sin(particle.phase) * particle.radius
        particle.position.z = settings.position[2] + Math.sin(particle.phase * 3 + particle.seed * 8) * 0.12
      } else if (preset === 'galaxy' || ['orbit', 'core', 'atom', 'wormhole', 'circle'].includes(behavior)) {
        const orbitSpeed = settings.speed / Math.sqrt(Math.max(0.55, particle.radius))
        particle.phase += delta * orbitSpeed * (particle.layer % 2 ? -1 : 1)
        const pulse = behavior === 'core' ? 0.78 + Math.sin(particle.age * 5 + particle.seed * 8) * 0.22 : 1
        particle.position.x = settings.position[0] + Math.cos(particle.phase) * particle.radius * pulse
        particle.position.z = settings.position[2] + Math.sin(particle.phase) * particle.radius * pulse
        if (behavior === 'atom') particle.position.y = settings.position[1] + Math.sin(particle.phase * (particle.layer + 1)) * particle.radius * 0.65
        if (behavior === 'wormhole') particle.position.y = settings.position[1] + (particle.radius - settings.spread * 0.5) * 0.65
      } else if (behavior === 'shield') {
        particle.phase += delta * settings.speed
        orientation.set(...settings.position)
        particle.position.sub(orientation).applyAxisAngle(UP, delta * settings.speed * 0.35).add(orientation)
      } else {
        particle.position.addScaledVector(particle.velocity, delta)
      }
      particle.rotation += particle.spin * delta

      let envelope = Math.max(0.04, 1 - progress * progress)
      if (preset === 'fire') envelope = Math.sin(Math.PI * progress)
      if (preset === 'mist') envelope = Math.sin(Math.PI * Math.min(1, progress * 1.35)) * THREE.MathUtils.lerp(0.7, 1.8, progress)
      if (preset === 'fireflies') envelope = (0.62 + Math.max(0, Math.sin(particle.age * 2.6 + particle.seed * 28)) * 0.85) * Math.sin(Math.PI * Math.min(1, progress * 1.8))
      if (preset === 'stardust') envelope *= 0.72 + Math.max(0, Math.sin(particle.age * 7 + particle.seed * 20)) * 0.55
      if (preset === 'shockwave') envelope = Math.sin(Math.PI * progress)
      if (preset === 'galaxy') envelope = Math.sin(Math.PI * Math.min(1, progress * 2.5)) * (0.7 + particle.seed * 0.55)
      if (['electric', 'scan', 'beam', 'beamDown', 'slash'].includes(behavior)) envelope *= 0.45 + Math.random() * 0.8
      if (['charge', 'implode'].includes(behavior)) envelope = Math.sin(Math.PI * progress)
      let scale = particle.size * envelope
      dummy.position.copy(particle.position)
      if (BILLBOARD_PRESETS.includes(preset)) {
        dummy.quaternion.copy(billboardQuaternion)
        if (preset === 'fireworks' || preset === 'shockwave' || ['burst', 'ring', 'slash', 'beam', 'beamDown', 'electric'].includes(behavior)) {
          orientation.copy(particle.velocity).applyQuaternion(inverseBillboardQuaternion)
          const screenAngle = Math.atan2(orientation.x, orientation.y)
          spinQuaternion.setFromAxisAngle(FORWARD, -screenAngle)
        } else {
          spinQuaternion.setFromAxisAngle(FORWARD, particle.rotation)
        }
        dummy.quaternion.multiply(spinQuaternion)
      } else {
        orientation.copy(particle.velocity)
        if (orientation.lengthSq() < 1e-6) orientation.copy(UP)
        dummy.quaternion.setFromUnitVectors(UP, orientation.normalize())
      }
      if (preset === 'rain' || preset === 'code') dummy.scale.set(scale * 0.3, scale * settings.stretch, scale * 0.3)
      else if (preset === 'snow') dummy.scale.set(scale, scale, 1)
      else if (preset === 'fire') {
        scale *= 0.72 + Math.sin(particle.age * 10 + particle.seed * 20) * 0.1
        dummy.scale.set(scale * 0.78, scale * settings.stretch * THREE.MathUtils.lerp(1.15, 0.55, progress), 1)
      } else if (preset === 'fireworks') {
        const trail = 1 + settings.stretch * 0.16 * (1 - progress) * (0.7 + particle.layer * 0.22)
        dummy.scale.set(scale * (0.7 + particle.layer * 0.12), scale * trail, 1)
      } else if (preset === 'shockwave') {
        dummy.scale.set(scale * 0.65, scale * settings.stretch, 1)
      } else if (preset === 'stardust') {
        dummy.scale.set(scale, scale * settings.stretch, 1)
      } else if (preset === 'portal') {
        dummy.scale.set(scale * 0.7, scale * settings.stretch, 1)
      } else if (preset === 'mist') dummy.scale.set(scale * 1.25, scale * settings.stretch, scale * 1.25)
      else if (['fall', 'drift'].includes(behavior)) dummy.scale.set(scale * 0.65, scale * settings.stretch, 1)
      else if (['beam', 'beamDown', 'electric', 'slash', 'scan'].includes(behavior)) dummy.scale.set(scale * 0.55, scale * settings.stretch, 1)
      else if (BILLBOARD_PRESETS.includes(preset)) dummy.scale.set(scale, scale, 1)
      else dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)

      color.copy(colorA).lerp(colorB, progress)
      if (settings.randomColors && preset === 'fireworks') color.offsetHSL(particle.seed, 0.08, 0)
      if (preset === 'fireworks') {
        const twinkle = 0.62 + Math.max(0, Math.sin(particle.age * (13 + particle.seed * 9) + particle.seed * 30)) * 0.75
        color.multiplyScalar(twinkle * (0.82 + particle.layer * 0.12))
      }
      if (preset === 'fire') color.multiplyScalar(0.9 + Math.sin(particle.age * 9 + particle.seed * 16) * 0.14)
      if (preset === 'fireflies') color.multiplyScalar(0.72 + Math.max(0, Math.sin(particle.age * 2.6 + particle.seed * 28)) * 0.7)
      if (preset === 'stardust') color.offsetHSL(Math.sin(particle.phase) * 0.035, 0.04, 0.08)
      if (preset === 'portal') color.multiplyScalar(0.8 + Math.sin(particle.phase * 3) * 0.2)
      if (preset === 'galaxy') color.copy(colorA).lerp(colorB, THREE.MathUtils.clamp(particle.radius / settings.spread, 0, 1))
      if (preset === 'mist') color.multiplyScalar(THREE.MathUtils.lerp(0.7, 1, Math.sin(Math.PI * progress)))
      mesh.setColorAt(index, color)
      index += 1
    }

    mesh.count = pool.active.length
    if (pool.active.length > 0) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
        mesh.instanceColor.needsUpdate = true
      }
    }
    statsClock.current += rawDelta
    if (statsClock.current >= STATS_INTERVAL) {
      statsClock.current = 0
      useParticles.getState().setStats(pool.active.length)
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      instanceColor={instanceColor}
      visible={settings.enabled}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}
