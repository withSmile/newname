import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { Water } from 'three/addons/objects/Water.js'
import { useEditor } from '../../store'

export const DEFAULT_THREE_WATER = {
  type: 'threeWater',
  color: '#0b3943',
  opacity: 0.9,
  distortionScale: 3.7,
  waveScale: 18,
  speed: 0.8,
  sunColor: '#ffffff',
  sunIntensity: 0.65,
  resolution: 512,
  clipBias: 0,
}

export const DEFAULT_REFLECTOR = {
  type: 'mirror',
  color: '#b8dbe2',
  opacity: 1,
  resolution: 512,
  clipBias: 0.003,
  multisample: 4,
}

function createWaterNormalTexture(size = 256) {
  const data = new Uint8Array(size * size * 4)
  const normal = new THREE.Vector3()
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const dx = Math.cos(u * 3 + Math.sin(v * 2)) * 0.9 + Math.cos((u + v) * 5) * 0.35
      const dy = Math.cos(v * 4 - Math.sin(u * 2)) * 0.75 + Math.cos((u - v) * 6) * 0.3
      normal.set(-dx, -dy, 2.8).normalize()
      const offset = (y * size + x) * 4
      data[offset] = Math.round((normal.x * 0.5 + 0.5) * 255)
      data[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
      data[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
      data[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function useWaterNormals() {
  const gl = useThree((state) => state.gl)
  const fallback = useMemo(() => createWaterNormalTexture(), [])
  const [texture, setTexture] = useState(fallback)
  useEffect(() => {
    let active = true
    const loaded = new THREE.TextureLoader().load('/textures/waternormals.jpg', () => { if (active) setTexture(loaded) })
    loaded.colorSpace = THREE.NoColorSpace
    loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
    loaded.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    return () => { active = false; loaded.dispose() }
  }, [gl])
  useEffect(() => () => fallback.dispose(), [fallback])
  return texture
}

function createWaterGeometry(type) {
  const tubePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.8, 0, 0),
    new THREE.Vector3(-0.35, 0.5, 0),
    new THREE.Vector3(0.35, -0.5, 0),
    new THREE.Vector3(0.8, 0, 0),
  ])
  const factories = {
    sphere: () => new THREE.SphereGeometry(0.7, 48, 32),
    torus: () => new THREE.TorusGeometry(0.65, 0.22, 24, 64),
    cylinder: () => new THREE.CylinderGeometry(0.62, 0.62, 1.25, 40, 12),
    cone: () => new THREE.ConeGeometry(0.68, 1.35, 40, 12),
    plane: () => new THREE.PlaneGeometry(1.8, 1.8, 12, 12),
    capsule: () => new THREE.CapsuleGeometry(0.42, 0.8, 8, 24),
    ring: () => new THREE.RingGeometry(0.38, 0.72, 48, 12),
    tetrahedron: () => new THREE.TetrahedronGeometry(0.9, 1),
    octahedron: () => new THREE.OctahedronGeometry(0.9, 1),
    dodecahedron: () => new THREE.DodecahedronGeometry(0.82, 1),
    icosahedron: () => new THREE.IcosahedronGeometry(0.86, 1),
    pipe: () => new THREE.TubeGeometry(tubePath, 32, 0.16, 16, false),
    torusKnot: () => new THREE.TorusKnotGeometry(0.52, 0.16, 96, 16, 2, 3),
    lathe: () => new THREE.LatheGeometry([
      new THREE.Vector2(0.08, -0.7),
      new THREE.Vector2(0.48, -0.55),
      new THREE.Vector2(0.32, 0),
      new THREE.Vector2(0.52, 0.55),
      new THREE.Vector2(0.12, 0.72),
    ], 40),
  }
  const geometry = factories[type]?.() || new THREE.BoxGeometry(1, 1, 1, 16, 16, 16)
  geometry.computeBoundingBox()
  geometry.center()
  geometry.computeBoundingSphere()
  if (geometry.attributes.uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv.clone())
  return geometry
}

export const ThreeWaterObject = forwardRef(function ThreeWaterObject({ object, selected, shading, onSelect }, ref) {
  const rootRef = useRef()
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const sunElevation = useEditor((state) => state.sunElevation)
  const sunAzimuth = useEditor((state) => state.sunAzimuth)
  const waterNormals = useWaterNormals()
  const settings = { ...DEFAULT_THREE_WATER, ...(object.effects?.material || {}) }
  const resolution = [256, 512, 1024].includes(Number(settings.resolution)) ? Number(settings.resolution) : 512
  const sunDirection = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - (sunElevation ?? 28))
    const theta = THREE.MathUtils.degToRad(sunAzimuth ?? 135)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [sunElevation, sunAzimuth])
  const water = useMemo(() => {
    const surface = new Water(createWaterGeometry(object.type), {
      textureWidth: resolution,
      textureHeight: resolution,
      clipBias: settings.clipBias,
      waterNormals,
      sunDirection,
      sunColor: new THREE.Color(settings.sunColor).multiplyScalar(settings.sunIntensity),
      waterColor: settings.color,
      distortionScale: settings.distortionScale,
      alpha: settings.opacity,
      side: THREE.DoubleSide,
      fog: Boolean(scene.fog),
    })
    surface.name = `${object.name} Water`
    surface.renderOrder = 1
    return surface
  }, [object.name, object.type, resolution, settings.clipBias, scene.fog, sunDirection, waterNormals])
  useImperativeHandle(ref, () => rootRef.current)
  useEffect(() => {
    const uniforms = water.material.uniforms
    uniforms.waterColor.value.set(settings.color)
    uniforms.sunColor.value.set(settings.sunColor).multiplyScalar(settings.sunIntensity)
    uniforms.sunDirection.value.copy(sunDirection)
    uniforms.distortionScale.value = settings.distortionScale
    uniforms.size.value = settings.waveScale
    uniforms.alpha.value = settings.opacity
    water.material.wireframe = shading === 'wireframe'
    water.material.transparent = settings.opacity < 0.999
    water.material.depthWrite = settings.opacity >= 0.999
    waterNormals.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    waterNormals.needsUpdate = true
  }, [gl, settings.color, settings.distortionScale, settings.opacity, settings.sunColor, settings.sunIntensity, settings.waveScale, shading, sunDirection, water, waterNormals])
  useEffect(() => () => {
    water.material.uniforms.mirrorSampler.value?.dispose()
    water.geometry.dispose()
    water.material.dispose()
  }, [water])
  useFrame((_, delta) => { water.material.uniforms.time.value += delta * settings.speed })
  return <group ref={rootRef} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onPointerDown={(event) => { event.stopPropagation(); onSelect() }}>
    <primitive object={water} dispose={null} />
    {selected && <Edges geometry={water.geometry} color="#fff7dd" threshold={15} scale={1.006} />}
  </group>
})

export const ReflectorObject = forwardRef(function ReflectorObject({ object, selected, shading, onSelect }, ref) {
  const rootRef = useRef()
  const settings = { ...DEFAULT_REFLECTOR, ...(object.effects?.material?.type === 'mirror' ? object.effects.material : {}), ...(object.mirror || {}) }
  const resolution = [256, 512, 1024].includes(Number(settings.resolution)) ? Number(settings.resolution) : 512
  const reflector = useMemo(() => {
    const shader = {
      ...Reflector.ReflectorShader,
      uniforms: { ...Reflector.ReflectorShader.uniforms, mirrorOpacity: { value: settings.opacity } },
      fragmentShader: Reflector.ReflectorShader.fragmentShader
        .replace('uniform vec3 color;', 'uniform vec3 color;\nuniform float mirrorOpacity;')
        .replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( blendOverlay( base.rgb, color ), mirrorOpacity )'),
    }
    const surface = new Reflector(new THREE.PlaneGeometry(1.8, 1.8), {
      textureWidth: resolution,
      textureHeight: resolution,
      clipBias: settings.clipBias,
      multisample: settings.multisample,
      color: settings.color,
      shader,
    })
    surface.name = `${object.name} Mirror`
    surface.renderOrder = 1
    return surface
  }, [object.name, resolution, settings.clipBias, settings.multisample])
  useImperativeHandle(ref, () => rootRef.current)
  useEffect(() => {
    reflector.material.uniforms.color.value.set(settings.color)
    reflector.material.uniforms.mirrorOpacity.value = settings.opacity
    reflector.material.transparent = settings.opacity < 0.999
    reflector.material.depthWrite = settings.opacity >= 0.999
    reflector.material.wireframe = shading === 'wireframe'
  }, [reflector, settings.color, settings.opacity, shading])
  useEffect(() => () => { reflector.dispose(); reflector.geometry.dispose() }, [reflector])
  return <group ref={rootRef} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onPointerDown={(event) => { event.stopPropagation(); onSelect() }}>
    <primitive object={reflector} dispose={null} />
    {selected && <Edges geometry={reflector.geometry} color="#fff7dd" threshold={15} scale={1.006} />}
  </group>
})
