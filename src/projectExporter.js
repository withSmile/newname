const TEXTURE_CHANNELS = ['baseColor', 'normal', 'roughness', 'metalness', 'ao', 'emissive', 'alpha', 'displacement']
const EXPORT_MANIFEST = '.frame-export-manifest.json'
const DRACO_DECODERS = ['draco/gltf/draco_decoder.js', 'draco/gltf/draco_decoder.wasm', 'draco/gltf/draco_wasm_wrapper.js']
const KTX2_TRANSCODERS = ['basis/basis_transcoder.js', 'basis/basis_transcoder.wasm']

const slugify = (value, fallback = 'asset') => {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || fallback
}

const extensionFrom = (source, name, fallback) => {
  const mime = /^data:([^;,]+)/.exec(source || '')?.[1]
  const mimeExtension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'model/gltf-binary': 'glb' }[mime]
  if (mimeExtension) return mimeExtension
  const cleanName = String(name || source || '').split(/[?#]/)[0]
  return /\.([a-z0-9]{2,5})$/i.exec(cleanName)?.[1].toLowerCase() || fallback
}

const fetchAsset = async (source) => {
  const response = await fetch(source)
  if (!response.ok) throw new Error(`资源读取失败：${source}`)
  if (response.headers.get('content-type')?.includes('text/html')) throw new Error(`资源地址返回了 HTML：${source}`)
  return response.blob()
}

const hashBytes = async (value) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(await value.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const collectAssetReferences = (objects) => objects.flatMap((object) => {
  const references = []
  if (object.type === 'model' && object.modelSource) references.push({ object: object.name, kind: '模型', source: object.modelSource })
  for (const channel of TEXTURE_CHANNELS) {
    const texture = object.textures?.[channel]
    if (texture?.data) references.push({ object: object.name, kind: `${channel} 贴图`, source: texture.data })
  }
  if (object.map && !object.textures?.baseColor?.data) references.push({ object: object.name, kind: '基础色贴图', source: object.map })
  return references
})

export async function validateSceneAssets(objects) {
  const references = collectAssetReferences(objects)
  const issues = []
  await Promise.all(references.map(async (reference) => {
    try {
      if (reference.source.startsWith('data:')) {
        if (!/^data:[^;,]+(?:;base64)?,.+/.test(reference.source)) throw new Error('Data URL 无效')
        return
      }
      const response = await fetch(reference.source, { method: reference.source.startsWith('blob:') ? 'GET' : 'HEAD' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (response.headers.get('content-type')?.includes('text/html')) throw new Error('资源地址返回了 HTML 页面')
    } catch (error) {
      issues.push({ ...reference, message: error?.message || '无法读取资源' })
    }
  }))
  return { references: references.length, issues }
}

const sceneRuntime = `import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass, NoiseEffect, RenderPass, VignetteEffect } from 'postprocessing'

const wrapModes = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping, mirror: THREE.MirroredRepeatWrapping }

function createGeometry(type) {
  const tubePath = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(-0.35, 0.5, 0), new THREE.Vector3(0.35, -0.5, 0), new THREE.Vector3(0.8, 0, 0)])
  const geometries = {
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
    lathe: () => new THREE.LatheGeometry([new THREE.Vector2(0.08, -0.7), new THREE.Vector2(0.48, -0.55), new THREE.Vector2(0.32, 0), new THREE.Vector2(0.52, 0.55), new THREE.Vector2(0.12, 0.72)], 40),
  }
  const geometry = (geometries[type] || (() => new THREE.BoxGeometry(1, 1, 1, 16, 16, 16)))()
  geometry.center()
  if (geometry.attributes.uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv.clone())
  return geometry
}

async function loadTexture(loader, source, object, colorTexture, assetBaseUrl) {
  if (!source) return null
  const texture = await loader.loadAsync(new URL(source, assetBaseUrl).href)
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = texture.wrapT = wrapModes[object.textureWrap || 'repeat']
  texture.repeat.fromArray(object.textureRepeat || [object.mapRepeat ?? 1, object.mapRepeat ?? 1])
  texture.offset.fromArray(object.textureOffset || [0, 0])
  texture.center.set(0.5, 0.5)
  texture.rotation = THREE.MathUtils.degToRad(object.textureRotation ?? object.mapRotation ?? 0)
  texture.flipY = object.textureFlipY ?? true
  texture.needsUpdate = true
  return texture
}

async function createMaterial(object, textureLoader, assetBaseUrl) {
  const textures = object.textures || {}
  const [map, normalMap, roughnessMap, metalnessMap, aoMap, emissiveMap, alphaMap, displacementMap] = await Promise.all([
    loadTexture(textureLoader, textures.baseColor?.data || object.map, object, true, assetBaseUrl),
    loadTexture(textureLoader, textures.normal?.data, object, false, assetBaseUrl),
    loadTexture(textureLoader, textures.roughness?.data, object, false, assetBaseUrl),
    loadTexture(textureLoader, textures.metalness?.data, object, false, assetBaseUrl),
    loadTexture(textureLoader, textures.ao?.data, object, false, assetBaseUrl),
    loadTexture(textureLoader, textures.emissive?.data, object, true, assetBaseUrl),
    loadTexture(textureLoader, textures.alpha?.data, object, false, assetBaseUrl),
    loadTexture(textureLoader, textures.displacement?.data, object, false, assetBaseUrl),
  ])
  return new THREE.MeshStandardMaterial({
    color: object.color || '#ffffff', roughness: object.roughness ?? 0.5, metalness: object.metalness ?? 0,
    envMapIntensity: object.envMapIntensity ?? 1, map, normalMap,
    normalScale: new THREE.Vector2(object.normalScale ?? 1, object.normalScale ?? 1), roughnessMap, metalnessMap,
    aoMap, aoMapIntensity: object.aoIntensity ?? 1, emissiveMap,
    emissive: emissiveMap ? object.emissiveColor || '#ffffff' : '#000000', emissiveIntensity: object.emissiveIntensity ?? 1,
    alphaMap, transparent: Boolean(alphaMap) || Boolean(object.transparent) || (object.opacity ?? 1) < 1, opacity: object.opacity ?? 1, alphaTest: object.alphaTest ?? 0, depthWrite: object.depthWrite !== false, side: object.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    displacementMap, displacementScale: object.displacementScale ?? 0.1,
    side: object.doubleSided || ['plane', 'ring'].includes(object.type) ? THREE.DoubleSide : THREE.FrontSide,
  })
}

function addLight(scene, light) {
  if (!light.enabled) return
  let result
  if (light.type === 'ambient') result = new THREE.AmbientLight(light.color, light.intensity)
  if (light.type === 'directional') result = new THREE.DirectionalLight(light.color, light.intensity)
  if (light.type === 'point') result = new THREE.PointLight(light.color, light.intensity, light.distance, light.decay)
  if (light.type === 'spot') result = new THREE.SpotLight(light.color, light.intensity, light.distance, THREE.MathUtils.degToRad(light.angle), light.penumbra)
  if (light.type === 'hemisphere') result = new THREE.HemisphereLight(light.skyColor, light.groundColor, light.intensity)
  if (!result) return
  if (light.position) result.position.fromArray(light.position)
  result.castShadow = Boolean(light.castShadow)
  scene.add(result)
}

async function applyEnvironment(scene, renderer, settings, disposables) {
  if (settings.backgroundMode === 'hdr' && settings.skyboxHdr) {
    const texture = await new RGBELoader().loadAsync(settings.skyboxHdr)
    texture.mapping = THREE.EquirectangularReflectionMapping
    scene.background = texture
    scene.environment = texture
    scene.environmentIntensity = settings.environmentIntensity
    scene.environmentRotation.set(0, THREE.MathUtils.degToRad(settings.environmentRotation || 0), 0)
    scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(settings.environmentRotation || 0), 0)
    disposables.push(texture)
    return
  }
  if (settings.backgroundMode === 'cube' && settings.skyboxCube?.length === 6) {
    const texture = await new THREE.CubeTextureLoader().loadAsync(settings.skyboxCube)
    scene.background = texture
    scene.environment = texture
    scene.environmentIntensity = settings.environmentIntensity
    scene.environmentRotation.set(0, THREE.MathUtils.degToRad(settings.environmentRotation || 0), 0)
    scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(settings.environmentRotation || 0), 0)
    disposables.push(texture)
    return
  }
  const pmrem = new THREE.PMREMGenerator(renderer)
  let source
  if (settings.backgroundMode === 'sky') {
    const phi = THREE.MathUtils.degToRad(90 - settings.sunElevation)
    const theta = THREE.MathUtils.degToRad(settings.sunAzimuth)
    const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
    const sky = new Sky()
    sky.scale.setScalar(450000)
    sky.material.uniforms.turbidity.value = settings.skyTurbidity
    sky.material.uniforms.rayleigh.value = settings.skyRayleigh
    sky.material.uniforms.mieCoefficient.value = settings.skyMieCoefficient
    sky.material.uniforms.mieDirectionalG.value = settings.skyMieDirectionalG
    sky.material.uniforms.sunPosition.value.copy(sun)
    scene.add(sky)
    source = new THREE.Scene()
    source.add(sky.clone())
  } else {
    scene.background = new THREE.Color(settings.background)
    source = new RoomEnvironment()
  }
  const environment = pmrem.fromScene(source, 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = settings.environmentIntensity
  scene.environmentRotation.set(0, THREE.MathUtils.degToRad(settings.environmentRotation), 0)
  disposables.push(environment, pmrem)
  source.clear()
  source.dispose?.()
}

export async function createThreeScene(container, config, options = {}) {
  const { settings, objects } = config
  const assetBaseUrl = options.assetBaseUrl || new URL('../', import.meta.url)
  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = options.shadows ?? true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = settings.exposure ?? 1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(settings.cameraFov || 42, 1, settings.cameraNear || 0.1, settings.cameraFar || 1000)
  camera.position.set(6.5, 4.8, 7.5)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.7, 0)
  controls.enableDamping = true
  controls.enabled = options.controls ?? true

  const disposables = []
  const mixers = []
  await applyEnvironment(scene, renderer, settings, disposables)
  if (settings.fogEnabled) scene.fog = new THREE.Fog(settings.fogColor, settings.fogNear, settings.fogFar)

  scene.add(new THREE.AmbientLight('#ffffff', settings.ambient))
  const key = new THREE.DirectionalLight(settings.keyLightColor, settings.keyLightIntensity)
  key.position.fromArray(settings.keyLightPosition)
  key.castShadow = options.shadows ?? true
  key.shadow.mapSize.set(2048, 2048)
  scene.add(key)
  const fill = new THREE.PointLight(settings.fillLightColor, settings.fillLightIntensity, settings.fillLightDistance)
  fill.position.fromArray(settings.fillLightPosition)
  scene.add(fill)
  if (settings.rimLightEnabled) {
    const rim = new THREE.SpotLight(settings.rimLightColor, settings.rimLightIntensity, 20, THREE.MathUtils.degToRad(settings.rimLightAngle), 0.7)
    rim.position.fromArray(settings.rimLightPosition)
    scene.add(rim)
  }
  if (settings.hemisphereEnabled) scene.add(new THREE.HemisphereLight(settings.hemisphereSkyColor, settings.hemisphereGroundColor, settings.hemisphereIntensity))
  ;(settings.customLights || []).forEach((light) => addLight(scene, light))

  const textureLoader = new THREE.TextureLoader()
  const gltfLoader = new GLTFLoader()
  const modelLoaders = { fbx: new FBXLoader(), obj: new OBJLoader(), stl: new STLLoader(), ply: new PLYLoader(), dae: new ColladaLoader(), '3mf': new ThreeMFLoader() }
  let dracoLoader
  let ktx2Loader
  if (config.build?.draco) {
    dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(new URL('assets/decoders/draco/gltf/', assetBaseUrl).href)
    gltfLoader.setDRACOLoader(dracoLoader)
  }
  if (config.build?.ktx2) {
    ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath(new URL('assets/decoders/basis/', assetBaseUrl).href)
    ktx2Loader.detectSupport(renderer)
    gltfLoader.setKTX2Loader(ktx2Loader)
  }
  for (const object of objects) {
    let node
    if (object.type === 'model') {
      const format = object.modelFormat || object.modelSource.split('.').pop().toLowerCase()
      const loaded = format === 'glb' || format === 'gltf' ? await gltfLoader.loadAsync(new URL(object.modelSource, assetBaseUrl).href) : await modelLoaders[format].loadAsync(new URL(object.modelSource, assetBaseUrl).href)
      const source = format === 'glb' || format === 'gltf' ? loaded.scene : format === 'dae' ? loaded.scene : loaded
      const geometry = format === 'stl' || format === 'ply' ? loaded : null
      const model = geometry ? new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: object.color || '#b8c1c7', roughness: object.roughness ?? 0.6, metalness: object.metalness ?? 0.05 })) : cloneSkeleton(source)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const normalizedScale = 1.8 / Math.max(size.x, size.y, size.z, 0.001)
      model.position.sub(center)
      const normalized = new THREE.Group()
      normalized.scale.setScalar(normalizedScale)
      normalized.add(model)
      node = new THREE.Group()
      node.add(normalized)
      const clips = loaded.animations || source?.animations || []
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(clips[0]).play()
        mixers.push(mixer)
      }
    } else {
      node = new THREE.Mesh(createGeometry(object.type), await createMaterial(object, textureLoader, assetBaseUrl))
    }
    node.name = object.name
    node.position.fromArray(object.position)
    node.rotation.fromArray(object.rotation)
    node.scale.fromArray(object.scale)
    node.visible = object.visible !== false
    node.traverse((child) => { if (child.isMesh) { child.castShadow = object.castShadow !== false; child.receiveShadow = object.receiveShadow !== false } })
    scene.add(node)
  }

  const grid = options.grid ?? config.editor?.grid
  if (grid) {
    const sceneSize = settings.sceneSize || 30
    const helper = new THREE.GridHelper(sceneSize, Math.max(2, Math.round(sceneSize / (settings.gridSize || 0.5))), settings.gridSectionColor, settings.gridColor)
    helper.material.transparent = true
    helper.material.opacity = 0.55
    scene.add(helper)
  }
  if (settings.worldAxesEnabled) {
    const axes = new THREE.AxesHelper(settings.worldAxesSize || 3)
    axes.position.fromArray(settings.worldAxesPosition || [0, 0.015, 0])
    axes.material.transparent = (settings.worldAxesOpacity ?? 0.9) < 1
    axes.material.opacity = settings.worldAxesOpacity ?? 0.9
    axes.material.depthTest = settings.worldAxesDepthTest !== false
    scene.add(axes)
  }

  let composer = null
  if (settings.postProcessingEnabled) {
    const effects = []
    if (settings.bloomEnabled) effects.push(new BloomEffect({ intensity: settings.bloomIntensity, luminanceThreshold: settings.bloomThreshold, luminanceSmoothing: settings.bloomSmoothing, mipmapBlur: true }))
    if (settings.depthOfFieldEnabled) effects.push(new DepthOfFieldEffect(camera, { focusDistance: settings.depthOfFieldFocusDistance, focalLength: settings.depthOfFieldFocalLength, bokehScale: settings.depthOfFieldBokehScale }))
    if (settings.chromaticAberrationEnabled) effects.push(new ChromaticAberrationEffect({ offset: new THREE.Vector2(settings.chromaticAberrationOffset, settings.chromaticAberrationOffset), radialModulation: true, modulationOffset: 0.5 }))
    if (settings.noiseEnabled) effects.push(new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, opacity: settings.noiseOpacity }))
    if (settings.vignetteEnabled) effects.push(new VignetteEffect({ eskil: false, offset: settings.vignetteOffset, darkness: settings.vignetteDarkness }))
    if (effects.length) {
      const multisampling = settings.postProcessingQuality === 'high' ? 8 : settings.postProcessingQuality === 'balanced' ? 4 : 0
      composer = new EffectComposer(renderer, { multisampling })
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new EffectPass(camera, ...effects))
    }
  }

  const resize = () => {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height, false)
    composer?.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  const clock = new THREE.Clock()
  let frame = 0
  const render = () => {
    frame = requestAnimationFrame(render)
    const delta = clock.getDelta()
    mixers.forEach((mixer) => mixer.update(delta))
    controls.update()
    if (composer) composer.render(delta)
    else renderer.render(scene, camera)
  }
  render()

  return {
    scene, camera, renderer,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      composer?.dispose()
      dracoLoader?.dispose()
      ktx2Loader?.dispose()
      scene.traverse((child) => {
        child.geometry?.dispose()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose() })
          material.dispose()
        })
      })
      disposables.forEach((item) => item.dispose?.())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
`

const typesTemplate = `export interface ThreeSceneRuntime {
  scene: unknown
  camera: unknown
  renderer: unknown
  dispose(): void
}

export interface ThreeSceneProps {
  className?: string
  controls?: boolean
  grid?: boolean
  shadows?: boolean
  onReady?: (runtime: ThreeSceneRuntime) => void
}

export interface SceneConfig {
  version: number
  name: string
  exportedAt: string
  build: { draco: boolean; ktx2: boolean }
  settings: Record<string, unknown>
  editor: Record<string, unknown>
  objects: Array<Record<string, unknown>>
}
`

const componentFor = (framework, language) => {
  const typed = language === 'ts'
  const moduleExtension = typed ? 'ts' : 'js'
  const importExtension = typed ? '' : `.${moduleExtension}`
  if (framework === 'react') return `import React, { useEffect, useRef } from 'react'
${typed ? "import type { ThreeSceneProps, ThreeSceneRuntime } from '../types'\n" : ''}import { sceneConfig } from '../config/scene.config${importExtension}'
import { createThreeScene } from '../runtime/createThreeScene${importExtension}'
import '../styles/three-scene.css'

export function ThreeScene(${typed ? "{ className = '', controls = true, grid, shadows = true, onReady }: ThreeSceneProps" : "{ className = '', controls = true, grid, shadows = true, onReady }"}) {
  const containerRef = useRef${typed ? '<HTMLDivElement | null>' : ''}(null)
  useEffect(() => {
    let disposed = false
    let runtime${typed ? ': ThreeSceneRuntime | undefined' : ''}
    if (!containerRef.current) return undefined
    createThreeScene(containerRef.current, sceneConfig, { controls, grid, shadows, assetBaseUrl: new URL('../', import.meta.url) }).then((instance) => {
      if (disposed) instance.dispose()
      else { runtime = instance; onReady?.(instance) }
    })
    return () => { disposed = true; runtime?.dispose() }
  }, [controls, grid, shadows, onReady])
  return <div ref={containerRef} className={\`three-scene \${className}\`} />
}
`

  return `<script setup${typed ? ' lang="ts"' : ''}>
import { onBeforeUnmount, onMounted, ref } from 'vue'
${typed ? "import type { ThreeSceneRuntime } from '../types'\n" : ''}import { sceneConfig } from '../config/scene.config${importExtension}'
import { createThreeScene } from '../runtime/createThreeScene${importExtension}'
import '../styles/three-scene.css'

${typed ? "const props = withDefaults(defineProps<{ controls?: boolean; grid?: boolean; shadows?: boolean }>(), { controls: true, shadows: true })\nconst emit = defineEmits<{ ready: [runtime: ThreeSceneRuntime] }>()\nconst container = ref<HTMLDivElement | null>(null)\nlet runtime: ThreeSceneRuntime | undefined" : "const props = defineProps({ controls: { type: Boolean, default: true }, grid: { type: Boolean, default: undefined }, shadows: { type: Boolean, default: true } })\nconst emit = defineEmits(['ready'])\nconst container = ref(null)\nlet runtime"}
let disposed = false
onMounted(async () => {
  if (!container.value) return
  const instance = await createThreeScene(container.value, sceneConfig, { ...props, assetBaseUrl: new URL('../', import.meta.url) })
  if (disposed) instance.dispose()
  else { runtime = instance; emit('ready', instance) }
})
onBeforeUnmount(() => { disposed = true; runtime?.dispose() })
</script>

<template><div ref="container" class="three-scene" /></template>
`
}

const optimizationScriptFor = (draco, ktx2) => `import { createHash } from 'node:crypto'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const settings = ${JSON.stringify({ draco, ktx2 })}
const modelsDirectory = resolve('src/assets/models')
const cacheFile = resolve('.frame-optimize-cache.json')
const binary = resolve('node_modules/.bin/gltf-transform' + (process.platform === 'win32' ? '.cmd' : ''))
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
const run = (args) => {
  const result = spawnSync(binary, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error('glTF Transform failed: ' + args[0])
}

let cache = {}
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* First optimization run. */ }
let files = []
try { files = (await readdir(modelsDirectory)).filter((name) => name.toLowerCase().endsWith('.glb')) } catch { /* No models. */ }
for (const name of files) {
  const source = resolve(modelsDirectory, name)
  const sourceHash = digest(await readFile(source))
  if (cache[name]?.outputHash === sourceHash && JSON.stringify(cache[name].settings) === JSON.stringify(settings)) {
    console.log('skip unchanged:', name)
    continue
  }
  let current = source
  const temporary = []
  if (settings.draco) {
    const output = source + '.frame-draco.glb'
    run(['draco', current, output])
    current = output
    temporary.push(output)
  }
  if (settings.ktx2) {
    const output = source + '.frame-ktx2.glb'
    run(['uastc', current, output])
    current = output
    temporary.push(output)
  }
  if (current !== source) {
    await rm(source, { force: true })
    await rename(current, source)
    await Promise.all(temporary.filter((path) => path !== current).map((path) => rm(path, { force: true })))
  }
  cache[name] = { settings, outputHash: digest(await readFile(source)) }
  console.log('optimized:', name)
}
await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\\n')
`

const readmeFor = (framework, sceneName, language, optimize) => `# ${sceneName}

由 FRAME Three Editor 导出的可移植 ${framework === 'react' ? 'React' : 'Vue'} ${language === 'ts' ? 'TypeScript' : 'JavaScript'} 场景组件。

## 使用

1. 将整个 \`three_scene\` 目录复制到目标项目。
2. 安装依赖：\`npm install\`。
${optimize ? '3. 执行资源优化：`npm run optimize:assets`。脚本使用内容哈希跳过未变化模型。\n4.' : '3.'} 从 \`src/index.${language === 'ts' ? 'ts' : 'js'}\` 导入 \`ThreeScene\`。
5. 给组件或父容器设置明确高度，例如 \`height: 600px\`。

${framework === 'react' ? '\`<ThreeScene controls grid shadows />\`' : '\`<ThreeScene :controls="true" :grid="true" :shadows="true" />\`'}

## 目录职责

- \`components\`：框架组件和生命周期绑定。
- \`runtime\`：Three.js 场景、灯光、环境、模型、材质和销毁逻辑。
- \`config\`：编辑器导出的结构化场景配置。
- \`assets\`：模型、贴图和本地 Draco/KTX2 解码器。
- \`scripts\`：Draco 几何压缩与 GLB 内嵌纹理 KTX2/UASTC 压缩。

独立 PNG/JPG 贴图保持源格式；KTX2 自动化针对 GLB 内嵌纹理。模型授权信息保留在场景配置中，发布前请复核许可要求。
`

const packageFor = (framework, sceneName, language, optimize) => JSON.stringify({
  name: `@frame/${slugify(sceneName, 'three-scene')}`,
  version: '1.0.0',
  private: true,
  type: 'module',
  sideEffects: ['**/*.css'],
  scripts: optimize ? { 'optimize:assets': 'node scripts/optimize-assets.mjs' } : {},
  peerDependencies: framework === 'react' ? { react: '>=18', three: '>=0.180', postprocessing: '>=6.37' } : { vue: '>=3.4', three: '>=0.180', postprocessing: '>=6.37' },
  devDependencies: {
    ...(optimize ? { '@gltf-transform/cli': '^4.4.1' } : {}),
    ...(language === 'ts' ? { typescript: '^5.8.0', '@types/three': '^0.180.0', ...(framework === 'react' ? { '@types/react': '^19.0.0' } : {}) } : {}),
  },
}, null, 2)

export async function buildSceneProject({ framework, language = 'js', folderName, objects, settings, editor, includeAssets = true, includeReadme = true, optimizeDraco = false, optimizeKtx2 = false }) {
  const files = new Map()
  const exportedObjects = structuredClone(objects)
  const sourceCache = new Map()
  const contentCache = new Map()
  const draco = includeAssets && optimizeDraco
  const ktx2 = includeAssets && optimizeKtx2
  const addAsset = async (source, folder, baseName, extension) => {
    if (!includeAssets || !source) return source
    if (sourceCache.has(source)) return sourceCache.get(source)
    const blob = await fetchAsset(source)
    const hash = await hashBytes(blob)
    const contentKey = `${hash}.${extension}`
    if (contentCache.has(contentKey)) {
      const existing = contentCache.get(contentKey)
      sourceCache.set(source, existing)
      return existing
    }
    const finalPath = `assets/${folder}/${slugify(baseName)}-${hash.slice(0, 10)}.${extension}`
    files.set(`src/${finalPath}`, blob)
    sourceCache.set(source, finalPath)
    contentCache.set(contentKey, finalPath)
    return finalPath
  }

  for (const object of exportedObjects) {
    const objectSlug = slugify(object.name, object.id)
    if (object.type === 'model' && object.modelSource) {
      const extension = extensionFrom(object.modelSource, object.name, 'glb')
      object.modelSource = await addAsset(object.modelSource, 'models', objectSlug, extension)
    }
    object.textures = object.textures || {}
    for (const channel of TEXTURE_CHANNELS) {
      const texture = object.textures[channel]
      if (!texture?.data) continue
      const extension = extensionFrom(texture.data, texture.name, 'png')
      texture.data = await addAsset(texture.data, 'textures', `${objectSlug}-${channel}`, extension)
    }
    if (object.map && !object.textures.baseColor?.data) {
      const extension = extensionFrom(object.map, object.mapName, 'png')
      object.map = await addAsset(object.map, 'textures', `${objectSlug}-baseColor`, extension)
    }
  }

  const decoderFiles = [...(draco ? DRACO_DECODERS : []), ...(ktx2 ? KTX2_TRANSCODERS : [])]
  for (const decoder of decoderFiles) files.set(`src/assets/decoders/${decoder}`, await fetchAsset(`/decoders/${decoder}`))

  const moduleExtension = language === 'ts' ? 'ts' : 'js'
  const componentExtension = framework === 'react' ? (language === 'ts' ? 'tsx' : 'jsx') : 'vue'
  const config = { version: 2, name: folderName, exportedAt: new Date().toISOString(), build: { draco, ktx2 }, settings, editor, objects: exportedObjects }
  files.set(`src/config/scene.config.${moduleExtension}`, `${language === 'ts' ? "import type { SceneConfig } from '../types'\n\n" : ''}export const sceneConfig${language === 'ts' ? ': SceneConfig' : ''} = ${JSON.stringify(config, null, 2)}\n`)
  files.set(`src/runtime/createThreeScene.${moduleExtension}`, `${language === 'ts' ? '// @ts-nocheck -- generated Three.js runtime; public API is typed in types.ts.\n' : ''}${sceneRuntime}`)
  files.set(`src/components/ThreeScene.${componentExtension}`, componentFor(framework, language))
  files.set('src/styles/three-scene.css', `.three-scene { width: 100%; height: 100%; min-height: 320px; overflow: hidden; background: ${settings.background}; }\n.three-scene canvas { display: block; width: 100%; height: 100%; }\n`)
  const componentImport = framework === 'vue' ? `./components/ThreeScene.${componentExtension}` : `./components/ThreeScene${language === 'ts' ? '' : '.jsx'}`
  const configImport = `./config/scene.config${language === 'ts' ? '' : '.js'}`
  files.set(`src/index.${moduleExtension}`, `export { ThreeScene } from '${componentImport}'\nexport { sceneConfig } from '${configImport}'\n${language === 'ts' ? "export type { SceneConfig, ThreeSceneProps, ThreeSceneRuntime } from './types'\n" : ''}`)
  if (language === 'ts') files.set('src/types.ts', typesTemplate)
  if (draco || ktx2) files.set('scripts/optimize-assets.mjs', optimizationScriptFor(draco, ktx2))
  files.set('package.json', packageFor(framework, folderName, language, draco || ktx2))
  if (includeReadme) files.set('README.md', readmeFor(framework, folderName, language, draco || ktx2))
  return files
}

const writeFile = async (root, path, value) => {
  const parts = path.split('/')
  const fileName = parts.pop()
  let directory = root
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true })
  const handle = await directory.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(value)
  await writable.close()
}

const readJsonFile = async (root, path) => {
  try {
    const handle = await root.getFileHandle(path)
    return JSON.parse(await (await handle.getFile()).text())
  } catch { return null }
}

const removeFile = async (root, path) => {
  const parts = path.split('/')
  const fileName = parts.pop()
  let directory = root
  try {
    for (const part of parts) directory = await directory.getDirectoryHandle(part)
    await directory.removeEntry(fileName)
  } catch { /* Already removed or no longer accessible. */ }
}

const createExportManifest = async (files) => {
  const hashes = {}
  for (const [path, value] of files) hashes[path] = await hashBytes(typeof value === 'string' ? value : value)
  return { version: 1, generatedBy: 'FRAME Three Editor', generatedAt: new Date().toISOString(), files: hashes }
}

export async function chooseProjectDirectory(folderName) {
  if (!window.showDirectoryPicker) return null
  const parent = await window.showDirectoryPicker({ id: 'frame-project-export', mode: 'readwrite' })
  return parent.getDirectoryHandle(slugify(folderName, 'three_scene'), { create: true })
}

export async function writeProjectDirectory(directory, files, onProgress) {
  const previousManifest = await readJsonFile(directory, EXPORT_MANIFEST)
  const nextManifest = await createExportManifest(files)
  let current = 0
  let written = 0
  let skipped = 0
  for (const [path, value] of files) {
    if (previousManifest?.files?.[path] === nextManifest.files[path]) skipped += 1
    else { await writeFile(directory, path, value); written += 1 }
    current += 1
    onProgress?.(current, files.size, path)
  }
  const staleFiles = Object.keys(previousManifest?.files || {}).filter((path) => !nextManifest.files[path])
  for (const path of staleFiles) await removeFile(directory, path)
  await writeFile(directory, EXPORT_MANIFEST, JSON.stringify(nextManifest, null, 2) + '\n')
  return { written, skipped, removed: staleFiles.length }
}

export async function downloadProjectZip(folderName, files, onProgress) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const manifest = await createExportManifest(files)
  let current = 0
  for (const [path, value] of files) {
    zip.file(`${slugify(folderName, 'three_scene')}/${path}`, value)
    current += 1
    onProgress?.(current, files.size, path)
  }
  zip.file(`${slugify(folderName, 'three_scene')}/${EXPORT_MANIFEST}`, JSON.stringify(manifest, null, 2) + '\n')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slugify(folderName, 'three_scene')}.zip`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function getProjectSummary(objects) {
  const models = objects.filter((object) => object.type === 'model' && object.modelSource).length
  const textures = objects.reduce((count, object) => count + TEXTURE_CHANNELS.filter((channel) => object.textures?.[channel]?.data).length + (object.map ? 1 : 0), 0)
  return { objects: objects.length, models, textures }
}
