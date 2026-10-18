import { shaderMaterial, Sky } from '@react-three/drei'
import { extend, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
import { useShallow } from 'zustand/react/shallow'
import { useEditor } from '../../store'
import { useSceneEffects } from './sceneEffectStore'
import { ScreenSpaceFluidEffect } from './ScreenSpaceFluidEffect'

const RippleMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color('#78e5ff'), uStrength: 0.9 },
  `varying vec2 vUv;
   void main() {
     vUv = uv;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
  `uniform float uTime;
   uniform vec3 uColor;
   uniform float uStrength;
   varying vec2 vUv;
   void main() {
     vec2 p = vUv - 0.5;
     float d = length(p);
     float rings = 0.5 + 0.5 * sin(d * 58.0 - uTime * 5.5);
     float outer = 1.0 - smoothstep(0.08, 0.52, d);
     float inner = smoothstep(0.0, 0.1, d);
     float a = rings * outer * inner * uStrength;
     gl_FragColor = vec4(uColor * (0.45 + a * 1.2), a * 0.72);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
   }`,
)

extend({ RippleMaterial })

function createWaterNormalTexture(size = 256) {
  const data = new Uint8Array(size * size * 4)
  const normal = new THREE.Vector3()
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const dx = Math.cos(u * 3 + Math.sin(v * 2)) * 0.9 + Math.cos((u + v) * 5) * 0.35
      const dy = Math.cos(v * 4 - Math.sin(u * 2)) * 0.75 + Math.cos((u - v) * 6) * 0.3
      // Water reads the sampled normal as xzy, so blue stores the upward component.
      normal.set(-dx, -dy, 2.8).normalize()
      const offset = (y * size + x) * 4
      data[offset] = Math.round((normal.x * 0.5 + 0.5) * 255)
      data[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
      data[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
      data[offset + 3] = 255
    }
  }

  // Water samples this normal map four times at different scales, so it must tile cleanly.
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function useWaterNormalTexture() {
  const gl = useThree((state) => state.gl)
  const fallback = useMemo(() => createWaterNormalTexture(), [])
  const [texture, setTexture] = useState(fallback)
  useEffect(() => {
    let active = true
    // Keep the procedural texture active until the detailed Three.js example map is ready.
    const loaded = new THREE.TextureLoader().load('/textures/waternormals.jpg', () => {
      if (active) setTexture(loaded)
    })
    loaded.colorSpace = THREE.NoColorSpace
    loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
    loaded.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    return () => { active = false; loaded.dispose() }
  }, [gl])
  useEffect(() => () => fallback.dispose(), [fallback])
  return texture
}

function EffectTransform({ settings, targetObject, children }) {
  const bound = settings.targetMode === 'object' && targetObject && settings.inheritTargetTransform !== false
  const targetPosition = bound ? targetObject.position || [0, 0, 0] : [0, 0, 0]
  const targetRotation = bound ? targetObject.rotation || [0, 0, 0] : [0, 0, 0]
  const targetScale = bound ? targetObject.scale || [1, 1, 1] : [1, 1, 1]
  const position = Array.isArray(settings.position) ? settings.position : [0, 0.04, 0]
  const rotation = Array.isArray(settings.rotation) ? settings.rotation : [0, 0, 0]
  const size = Array.isArray(settings.size) ? settings.size : [settings.scale ?? 6, settings.scale ?? 6]
  return <group position={targetPosition} rotation={targetRotation} scale={targetScale}>
    <group position={position} rotation={[-Math.PI / 2 + THREE.MathUtils.degToRad(rotation[0] || 0), THREE.MathUtils.degToRad(rotation[1] || 0), THREE.MathUtils.degToRad(rotation[2] || 0)]}>
      <group scale={[Math.max(0.01, Number(size[0]) || 6), Math.max(0.01, Number(size[1]) || 6), 1]}>{children}</group>
    </group>
  </group>
}

function MirrorSurface({ settings, targetObject }) {
  const material = useRef()
  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.envMapIntensity = settings.strength * (1.8 + Math.sin(clock.elapsedTime * settings.speed) * 0.08)
  })
  return <EffectTransform settings={settings} targetObject={targetObject}><mesh userData={{ sceneEffectHelper: true }}><planeGeometry args={[1, 1]} /><meshPhysicalMaterial ref={material} color={settings.color} metalness={1} roughness={Math.max(0.015, 0.22 - settings.strength * 0.12)} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={settings.strength * 1.8} transparent opacity={0.88} depthWrite={false} side={THREE.DoubleSide} /></mesh></EffectTransform>
}

function WaterSurface({ settings, environment, targetObject }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const waterNormals = useWaterNormalTexture()
  const resolution = [256, 512, 1024].includes(settings.waterResolution) ? settings.waterResolution : 512
  const hasFog = Boolean(scene.fog)
  const sunDirection = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - environment.sunElevation)
    const theta = THREE.MathUtils.degToRad(environment.sunAzimuth)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [environment.sunElevation, environment.sunAzimuth])
  const water = useMemo(() => {
    // Three Water owns the reflection camera and render target; keep one instance per quality level.
    const surface = new Water(new THREE.PlaneGeometry(1, 1), {
      textureWidth: resolution,
      textureHeight: resolution,
      waterNormals,
      sunDirection,
      sunColor: new THREE.Color(settings.waterSunColor || '#ffffff').multiplyScalar(settings.waterSunIntensity ?? 0.65),
      waterColor: settings.color,
      distortionScale: settings.strength * 6,
      alpha: settings.waterAlpha ?? 1,
      side: THREE.DoubleSide,
      fog: hasFog,
    })
    surface.userData.sceneEffectHelper = true
    surface.material.transparent = (settings.waterAlpha ?? 1) < 0.999
    surface.material.depthWrite = (settings.waterAlpha ?? 1) >= 0.999
    surface.renderOrder = 1
    return surface
  }, [hasFog, resolution, sunDirection, waterNormals])
  useEffect(() => {
    const uniforms = water.material.uniforms
    uniforms.waterColor.value.set(settings.color)
    uniforms.sunColor.value.set(settings.waterSunColor || '#ffffff').multiplyScalar(settings.waterSunIntensity ?? 0.65)
    uniforms.sunDirection.value.copy(sunDirection)
    uniforms.distortionScale.value = settings.strength * 6
    // Water was designed for ocean-scale planes; increase size to retain detail on editor-scale surfaces.
    uniforms.size.value = settings.waterWaveScale ?? 18
    uniforms.alpha.value = settings.waterAlpha ?? 1
    water.material.transparent = uniforms.alpha.value < 0.999
    water.material.depthWrite = uniforms.alpha.value >= 0.999
    waterNormals.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    waterNormals.needsUpdate = true
  }, [gl, settings.color, settings.strength, settings.waterAlpha, settings.waterSunColor, settings.waterSunIntensity, settings.waterWaveScale, sunDirection, water, waterNormals])
  useEffect(() => () => {
    water.material.uniforms.mirrorSampler.value?.dispose()
    water.geometry.dispose()
    water.material.dispose()
  }, [water])
  useFrame((_, delta) => { water.material.uniforms.time.value += delta * settings.speed })
  return <>
    {environment.backgroundMode === 'color' && settings.waterSkyEnabled === true && <Sky userData={{ sceneEffectHelper: true }} distance={450000} sunPosition={sunDirection} turbidity={8} rayleigh={2.4} mieCoefficient={0.006} mieDirectionalG={0.82} />}
    <EffectTransform settings={settings} targetObject={targetObject}><primitive object={water} dispose={null} /></EffectTransform>
  </>
}

function RippleSurface({ settings, targetObject }) {
  const material = useRef()
  useFrame(({ clock }) => { if (material.current) material.current.uTime = clock.elapsedTime * settings.speed })
  return <EffectTransform settings={settings} targetObject={targetObject}><mesh userData={{ sceneEffectHelper: true }}><planeGeometry args={[1, 1]} /><rippleMaterial ref={material} transparent depthWrite={false} uColor={new THREE.Color(settings.color)} uStrength={settings.strength} side={THREE.DoubleSide} /></mesh></EffectTransform>
}

function belongsToTarget(object, targetObject) {
  if (!targetObject || !targetObject.name) return true
  let current = object
  while (current) {
    if (current.name === targetObject.name) return true
    current = current.parent
  }
  return false
}

function ClippingEffect({ settings, targetObject }) {
  const { gl, scene } = useThree()
  const plane = useRef(new THREE.Plane(new THREE.Vector3(1, 0, 0), 0))
  const point = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const effectQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const targetEuler = useMemo(() => new THREE.Euler(), [])
  const effectEuler = useMemo(() => new THREE.Euler(), [])
  useEffect(() => {
    const previousClippingEnabled = gl.localClippingEnabled
    gl.localClippingEnabled = true
    const changed = []
    scene.traverse((object) => {
      if (!object.isMesh || object.userData.sceneEffectHelper || !belongsToTarget(object, settings.targetMode === 'object' ? targetObject : null)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!material) return
        changed.push([material, material.clippingPlanes, material.clipShadows])
        material.clippingPlanes = [plane.current]
        material.clipShadows = true
        material.needsUpdate = true
      })
    })
    return () => {
      changed.forEach(([material, clippingPlanes, clipShadows]) => {
        material.clippingPlanes = clippingPlanes
        material.clipShadows = clipShadows
        material.needsUpdate = true
      })
      gl.localClippingEnabled = previousClippingEnabled
    }
  }, [gl, scene, settings.targetMode, targetObject?.name])
  useFrame(({ clock }) => {
    const axis = settings.clippingAxis === 'y' ? [0, 1, 0] : settings.clippingAxis === 'z' ? [0, 0, 1] : [1, 0, 0]
    const inherited = settings.targetMode === 'object' && targetObject && settings.inheritTargetTransform !== false
    const position = Array.isArray(settings.position) ? settings.position : [0, 0, 0]
    const rotation = Array.isArray(settings.rotation) ? settings.rotation : [0, 0, 0]
    normal.set(...axis)
    effectEuler.set(THREE.MathUtils.degToRad(rotation[0] || 0), THREE.MathUtils.degToRad(rotation[1] || 0), THREE.MathUtils.degToRad(rotation[2] || 0))
    effectQuaternion.setFromEuler(effectEuler)
    normal.applyQuaternion(effectQuaternion)
    point.set(position[0] || 0, position[1] || 0, position[2] || 0)
    if (inherited) {
      const targetRotation = targetObject.rotation || [0, 0, 0]
      const targetScale = targetObject.scale || [1, 1, 1]
      targetEuler.set(targetRotation[0] || 0, targetRotation[1] || 0, targetRotation[2] || 0)
      targetQuaternion.setFromEuler(targetEuler)
      normal.applyQuaternion(targetQuaternion)
      point.multiply(new THREE.Vector3(targetScale[0] || 1, targetScale[1] || 1, targetScale[2] || 1)).applyQuaternion(targetQuaternion).add(new THREE.Vector3(...(targetObject.position || [0, 0, 0])))
    }
    if (settings.clippingInvert) normal.multiplyScalar(-1)
    const baseOffset = Number(settings.clippingOffset) || 0
    const sweep = settings.clippingAnimate === false ? 0 : Math.sin(clock.elapsedTime * (Number(settings.speed) || 0)) * (Number(settings.scale) || 0) * (Number(settings.clippingSweep) || 0)
    point.addScaledVector(normal, baseOffset + sweep)
    plane.current.setFromNormalAndCoplanarPoint(normal, point)
  })
  return null
}

export function SceneEffectRuntime() {
  const settings = useSceneEffects(useShallow((state) => ({ enabled: state.enabled, preset: state.preset, type: state.type, color: state.color, strength: state.strength, scale: state.scale, speed: state.speed, position: state.position, rotation: state.rotation, size: state.size, targetMode: state.targetMode, targetObjectId: state.targetObjectId, inheritTargetTransform: state.inheritTargetTransform, clippingEnabled: state.clippingEnabled, clippingAxis: state.clippingAxis, clippingOffset: state.clippingOffset, clippingInvert: state.clippingInvert, clippingAnimate: state.clippingAnimate, clippingSweep: state.clippingSweep, waterAlpha: state.waterAlpha, waterResolution: state.waterResolution, waterSunColor: state.waterSunColor, waterSunIntensity: state.waterSunIntensity, waterWaveScale: state.waterWaveScale, waterSkyEnabled: state.waterSkyEnabled, fluidSecondary: state.fluidSecondary, fluidCount: state.fluidCount, fluidPointSize: state.fluidPointSize, fluidOpacity: state.fluidOpacity, fluidSpread: state.fluidSpread })))
  const environment = useEditor(useShallow((state) => ({ backgroundMode: state.backgroundMode, sunElevation: state.sunElevation, sunAzimuth: state.sunAzimuth })))
  const objects = useEditor((state) => state.objects)
  const targetObject = settings.targetMode === 'object' ? objects.find((object) => object.id === settings.targetObjectId) : null
  if (!settings.enabled) return null
  if (settings.type === 'screenFluid') return <ScreenSpaceFluidEffect settings={settings} />
  // Object-assigned effects are rendered by SceneObject; never create helper planes for them.
  if (settings.targetMode === 'object') return null
  if (settings.type === 'clipping') return settings.clippingEnabled !== false ? <ClippingEffect settings={settings} targetObject={targetObject} /> : null
  if (settings.type === 'mirror') return <MirrorSurface settings={settings} targetObject={targetObject} />
  if (settings.type === 'ripple') return <RippleSurface settings={settings} targetObject={targetObject} />
  return <WaterSurface settings={settings} environment={environment} targetObject={targetObject} />
}
