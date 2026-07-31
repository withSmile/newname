import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BatchedRenderer, ParticleSystem, RenderMode } from 'three.quarks'
import { ApplyForce, Bezier, ColorOverLife, ConstantColor, ConstantValue, Gradient, IntervalValue, PiecewiseBezier, PointEmitter, ConeEmitter, SphereEmitter, SizeOverLife } from 'quarks.core'
import { useParticles } from './particleStore'

function softTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.92)'); g.addColorStop(0.52, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
}

const v4 = (hex, alpha = 1) => { const color = new THREE.Color(hex); return new THREE.Vector4(color.r, color.g, color.b, alpha) }

function makeSystem(settings, texture) {
  const isFireworks = settings.preset === 'fireworks'; const isRain = settings.preset === 'rain'; const isSnow = settings.preset === 'snow'; const isFire = settings.preset === 'fire'; const isMist = settings.preset === 'mist'; const isCode = settings.preset === 'code'
  const colors = isFire ? new Gradient([[v4('#fff7c7'), 0], [v4('#ffb02e'), 0.45], [v4('#eb3f25'), 1]], [[1, 0], [0.8, 0.7], [0, 1]]) : new Gradient([[v4(settings.color), 0], [v4(settings.secondary), 0.75], [v4(settings.secondary), 1]], [[1, 0], [0.9, 0.6], [0, 1]])
  const radians = THREE.MathUtils.degToRad(settings.angle)
  const shape = isFireworks ? new SphereEmitter({ radius: 0.02, thickness: 0, speed: new IntervalValue(settings.speed * 0.7, settings.speed * 1.25) }) : isRain || isSnow || isCode ? new ConeEmitter({ radius: settings.spread * 0.65, angle: radians }) : isFire ? new ConeEmitter({ radius: settings.spread * 0.22, angle: radians }) : isMist ? new ConeEmitter({ radius: settings.spread * 0.18, angle: radians }) : new PointEmitter()
  const size = new PiecewiseBezier([[new Bezier(isFire ? 0.35 : 0.55, 1.15, 0.9, 0.8), 0], [new Bezier(0.8, 0.55, 0.2, 0), 1]])
  const system = new ParticleSystem({ duration: settings.lifetime, looping: true, prewarm: !isFireworks, startLife: new IntervalValue(settings.lifetime * 0.55, settings.lifetime), startSpeed: new IntervalValue(settings.speed * 0.55, settings.speed * 1.2), startSize: new IntervalValue(settings.size * 0.7, settings.size * 1.4), startColor: new ConstantColor(v4(settings.color)), emissionOverTime: new ConstantValue(isFireworks ? 0 : settings.rate), emissionBursts: isFireworks ? [{ time: 0.05, count: new ConstantValue(settings.count), cycle: 1, interval: 0, probability: 1 }] : [], shape, behaviors: [new ColorOverLife(colors), new SizeOverLife(size), new ApplyForce(new THREE.Vector3(0, 1, 0), new ConstantValue(settings.gravity))], renderMode: isRain || isCode ? RenderMode.StretchedBillBoard : RenderMode.BillBoard, rendererEmitterSettings: isRain || isCode ? { speedFactor: 0.08, lengthFactor: settings.stretch } : {}, material: new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: settings.opacity, depthWrite: false, blending: isMist || isSnow || isRain ? THREE.NormalBlending : THREE.AdditiveBlending, vertexColors: true }) })
  const falls = isRain || isSnow || isCode
  system.emitter.position.set(0, falls ? settings.spread * 0.85 : 0, 0)
  if (falls) system.emitter.rotation.x = Math.PI
  return system
}

export function ParticleRuntime() {
  const settings = useParticles(); const renderer = useMemo(() => new BatchedRenderer(), []); const texture = useMemo(() => softTexture(), []); const systemRef = useRef(null)
  useEffect(() => { if (!settings.enabled) return undefined; const system = makeSystem(settings, texture); systemRef.current = system; renderer.addSystem(system); renderer.add(system.emitter); return () => { renderer.remove(system.emitter); renderer.deleteSystem(system); system.dispose(); systemRef.current = null } }, [renderer, settings.enabled, settings.preset, settings.count, settings.rate, settings.angle, settings.opacity, settings.stretch, settings.color, settings.secondary, settings.size, settings.speed, settings.gravity, settings.lifetime, settings.spread, texture])
  useFrame((_, delta) => renderer.update(delta))
  useEffect(() => () => { texture.dispose(); renderer.traverse((child) => { if (child.material) child.material.dispose() }) }, [renderer, texture])
  return <primitive object={renderer} />
}
