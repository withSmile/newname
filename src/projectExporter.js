const TEXTURE_CHANNELS = ['baseColor', 'normal', 'roughness', 'metalness', 'ao', 'emissive', 'alpha', 'displacement']

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
  return response.blob()
}

const sceneRuntime = `import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

const wrapModes = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping, mirror: THREE.MirroredRepeatWrapping }

function createGeometry(type) {
  const geometries = {
    sphere: () => new THREE.SphereGeometry(0.7, 48, 32),
    torus: () => new THREE.TorusGeometry(0.65, 0.22, 24, 64),
    cylinder: () => new THREE.CylinderGeometry(0.62, 0.62, 1.25, 40, 12),
    cone: () => new THREE.ConeGeometry(0.68, 1.35, 40, 12),
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
    alphaMap, transparent: Boolean(alphaMap), alphaTest: object.alphaTest ?? 0,
    displacementMap, displacementScale: object.displacementScale ?? 0.1,
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

function applyEnvironment(scene, renderer, settings, disposables) {
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

  const camera = new THREE.PerspectiveCamera(settings.cameraFov || 42, 1, 0.1, 1000)
  camera.position.set(6.5, 4.8, 7.5)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.7, 0)
  controls.enableDamping = true
  controls.enabled = options.controls ?? true

  const disposables = []
  const mixers = []
  applyEnvironment(scene, renderer, settings, disposables)
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
  settings.customLights.forEach((light) => addLight(scene, light))

  const textureLoader = new THREE.TextureLoader()
  const gltfLoader = new GLTFLoader()
  for (const object of objects) {
    let node
    if (object.type === 'model') {
      const gltf = await gltfLoader.loadAsync(new URL(object.modelSource, assetBaseUrl).href)
      const model = cloneSkeleton(gltf.scene)
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
      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(gltf.animations[0]).play()
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
    const helper = new THREE.GridHelper(30, 60, settings.gridSectionColor, settings.gridColor)
    helper.material.transparent = true
    helper.material.opacity = 0.55
    scene.add(helper)
  }

  const resize = () => {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height, false)
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
    renderer.render(scene, camera)
  }
  render()

  return {
    scene, camera, renderer,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
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

const reactComponent = `import React, { useEffect, useRef } from 'react'
import { sceneConfig } from '../config/scene.config.js'
import { createThreeScene } from '../runtime/createThreeScene.js'
import '../styles/three-scene.css'

export function ThreeScene({ className = '', controls = true, grid, shadows = true, onReady }) {
  const containerRef = useRef(null)
  useEffect(() => {
    let disposed = false
    let runtime
    createThreeScene(containerRef.current, sceneConfig, {
      controls, grid, shadows, assetBaseUrl: new URL('../', import.meta.url),
    }).then((instance) => {
      if (disposed) instance.dispose()
      else { runtime = instance; onReady?.(instance) }
    })
    return () => { disposed = true; runtime?.dispose() }
  }, [controls, grid, shadows, onReady])
  return <div ref={containerRef} className={\`three-scene \${className}\`} />
}
`

const vueComponent = `<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { sceneConfig } from '../config/scene.config.js'
import { createThreeScene } from '../runtime/createThreeScene.js'
import '../styles/three-scene.css'

const props = defineProps({ controls: { type: Boolean, default: true }, grid: { type: Boolean, default: undefined }, shadows: { type: Boolean, default: true } })
const emit = defineEmits(['ready'])
const container = ref(null)
let runtime
let disposed = false
onMounted(async () => {
  const instance = await createThreeScene(container.value, sceneConfig, { ...props, assetBaseUrl: new URL('../', import.meta.url) })
  if (disposed) instance.dispose()
  else { runtime = instance; emit('ready', instance) }
})
onBeforeUnmount(() => { disposed = true; runtime?.dispose() })
</script>

<template><div ref="container" class="three-scene" /></template>
`

const readmeFor = (framework, sceneName) => `# ${sceneName}

由 FRAME Three Editor 导出的可移植 ${framework === 'react' ? 'React' : 'Vue'} 场景组件。

## 使用

1. 将整个 \`three_scene\` 目录复制到目标项目。
2. 确保项目已安装 \`three\`${framework === 'react' ? ' 和 \`react\`' : ' 和 \`vue\`'}。
3. 导入组件：\`import { ThreeScene } from './three_scene/src/index.js'\`。
4. 给组件或父容器设置明确高度，例如 \`height: 600px\`。

${framework === 'react' ? '\`<ThreeScene controls grid shadows />\`' : '\`<ThreeScene :controls="true" :grid="true" :shadows="true" />\`'}

## 目录职责

- \`components\`：框架组件和生命周期绑定。
- \`runtime\`：Three.js 场景、灯光、环境、模型、材质和销毁逻辑。
- \`config\`：编辑器导出的结构化场景配置。
- \`assets\`：模型与贴图资源，可随项目一起部署。
- \`styles\`：组件容器样式。

模型授权信息保留在 \`scene.config.js\` 的对象数据中。发布前请复核第三方模型的许可要求。
`

const packageFor = (framework, sceneName) => JSON.stringify({
  name: `@frame/${slugify(sceneName, 'three-scene')}`,
  version: '1.0.0',
  private: true,
  type: 'module',
  sideEffects: ['**/*.css'],
  peerDependencies: framework === 'react' ? { react: '>=18', three: '>=0.180' } : { vue: '>=3.4', three: '>=0.180' },
}, null, 2)

export async function buildSceneProject({ framework, folderName, objects, settings, editor, includeAssets = true, includeReadme = true }) {
  const files = new Map()
  const exportedObjects = structuredClone(objects)
  const assetCache = new Map()
  const addAsset = async (source, path) => {
    if (!includeAssets || !source) return source
    if (assetCache.has(source)) return assetCache.get(source)
    const finalPath = `assets/${path}`
    files.set(`src/${finalPath}`, await fetchAsset(source))
    assetCache.set(source, finalPath)
    return finalPath
  }

  for (const object of exportedObjects) {
    const objectSlug = slugify(object.name, object.id)
    if (object.type === 'model' && object.modelSource) {
      const extension = extensionFrom(object.modelSource, object.name, 'glb')
      object.modelSource = await addAsset(object.modelSource, `models/${objectSlug}.${extension}`)
    }
    object.textures = object.textures || {}
    for (const channel of TEXTURE_CHANNELS) {
      const texture = object.textures[channel]
      if (!texture?.data) continue
      const extension = extensionFrom(texture.data, texture.name, 'png')
      texture.data = await addAsset(texture.data, `textures/${objectSlug}-${channel}.${extension}`)
    }
    if (object.map && !object.textures.baseColor?.data) {
      const extension = extensionFrom(object.map, object.mapName, 'png')
      object.map = await addAsset(object.map, `textures/${objectSlug}-baseColor.${extension}`)
    }
  }

  const config = { version: 1, name: folderName, exportedAt: new Date().toISOString(), settings, editor, objects: exportedObjects }
  files.set('src/config/scene.config.js', `export const sceneConfig = ${JSON.stringify(config, null, 2)}\n`)
  files.set('src/runtime/createThreeScene.js', sceneRuntime)
  files.set(`src/components/ThreeScene.${framework === 'react' ? 'jsx' : 'vue'}`, framework === 'react' ? reactComponent : vueComponent)
  files.set('src/styles/three-scene.css', `.three-scene { width: 100%; height: 100%; min-height: 320px; overflow: hidden; background: ${settings.background}; }\n.three-scene canvas { display: block; width: 100%; height: 100%; }\n`)
  files.set('src/index.js', `export { ThreeScene } from './components/ThreeScene.${framework === 'react' ? 'jsx' : 'vue'}'\nexport { sceneConfig } from './config/scene.config.js'\n`)
  files.set('package.json', packageFor(framework, folderName))
  if (includeReadme) files.set('README.md', readmeFor(framework, folderName))
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

export async function chooseProjectDirectory(folderName) {
  if (!window.showDirectoryPicker) return null
  const parent = await window.showDirectoryPicker({ id: 'frame-project-export', mode: 'readwrite' })
  return parent.getDirectoryHandle(slugify(folderName, 'three_scene'), { create: true })
}

export async function writeProjectDirectory(directory, files, onProgress) {
  let current = 0
  for (const [path, value] of files) {
    await writeFile(directory, path, value)
    current += 1
    onProgress?.(current, files.size, path)
  }
}

export async function downloadProjectZip(folderName, files, onProgress) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  let current = 0
  for (const [path, value] of files) {
    zip.file(`${slugify(folderName, 'three_scene')}/${path}`, value)
    current += 1
    onProgress?.(current, files.size, path)
  }
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
