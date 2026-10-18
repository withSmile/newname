import { interactionRuntimeSource } from './features/export/interactionRuntimeSource.js'
import { particleRuntimeSource } from './features/export/particleRuntimeSource.js'
import { flowRuntimeSource } from './features/export/flowRuntimeSource.js'
import { animationRuntimeSource } from './features/export/animationRuntimeSource.js'
import { uiNodeStyle } from './features/ui-editor/uiProject.js'
import { getModelAsset, normalizeAssetPath } from './features/scene/model/modelAssetStore.js'

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
      if (reference.source.startsWith('asset://')) {
        const owner = objects.find((object) => object.name === reference.object && object.modelAssetId)
        if (!owner || !await getModelAsset(owner.modelAssetId)) throw new Error('IndexedDB 模型资源包不存在')
        return
      }
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
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createExportParticles } from './createExportParticles.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { Water } from 'three/addons/objects/Water.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass, FXAAEffect, NoiseEffect, OutlineEffect, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing'
import { N8AOPostPass } from 'n8ao'

${interactionRuntimeSource}
${flowRuntimeSource}
${animationRuntimeSource}

const wrapModes = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping, mirror: THREE.MirroredRepeatWrapping }
THREE.Mesh.prototype.raycast = acceleratedRaycast
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree

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
  // The Water shader combines tiled samples from this local normal texture.
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createGeometry(type) {
  const tubePath = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(-0.35, 0.5, 0), new THREE.Vector3(0.35, -0.5, 0), new THREE.Vector3(0.8, 0, 0)])
  const geometries = {
    sphere: () => new THREE.SphereGeometry(0.7, 48, 32),
    torus: () => new THREE.TorusGeometry(0.65, 0.22, 24, 64),
    cylinder: () => new THREE.CylinderGeometry(0.62, 0.62, 1.25, 40, 12),
    cone: () => new THREE.ConeGeometry(0.68, 1.35, 40, 12),
    plane: () => new THREE.PlaneGeometry(1.8, 1.8, 12, 12),
    reflector: () => new THREE.PlaneGeometry(1.8, 1.8, 12, 12),
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

function applyModelEffect(root, effect, updaters) {
  if (!effect?.enabled || !['hologram', 'fresnel', 'xray', 'scan', 'dissolve'].includes(effect.type)) return
  const type = { hologram: 0, fresnel: 1, xray: 2, scan: 3, dissolve: 4 }[effect.type]
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      if (!material?.isMeshStandardMaterial && !material?.isMeshPhysicalMaterial) return
      const previousCompile = material.onBeforeCompile
      material.onBeforeCompile = (shader, renderer) => {
        previousCompile?.call(material, shader, renderer)
        shader.uniforms.uFxTime = { value: 0 }
        shader.uniforms.uFxColor = { value: new THREE.Color(effect.color || '#38d9ff') }
        shader.uniforms.uFxIntensity = { value: effect.intensity ?? 1.2 }
        shader.uniforms.uFxScale = { value: effect.scale ?? 7 }
        shader.uniforms.uFxProgress = { value: effect.progress ?? 0.42 }
        shader.uniforms.uFxEdgeWidth = { value: effect.edgeWidth ?? 0.12 }
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vFxNormal; varying vec3 vFxWorld; varying vec3 vFxView;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\\nvec4 fxWorld=modelMatrix*vec4(transformed,1.0); vFxWorld=fxWorld.xyz; vFxNormal=normalize(mat3(modelMatrix)*objectNormal); vFxView=normalize(cameraPosition-fxWorld.xyz);')
        const effectCode = type === 0 ? 'fxM=(fxF*1.35+pow(.5+.5*sin((vFxWorld.y+uFxTime*.45)*uFxScale*8.),7.)*.55+.08);' : type === 1 ? 'fxM=fxF*1.6;' : type === 2 ? 'fxM=.28+fxF*1.45;' : type === 3 ? 'float fxP=fract(vFxWorld.y*.08+uFxTime*.18); fxM=fxF*.75+smoothstep(.08,0.,abs(fxP-.5))*2.2;' : 'float fxN=fract(sin(dot(floor(vFxWorld*uFxScale),vec3(12.9898,78.233,37.719)))*43758.5453); float fxD=vFxWorld.y*.12+fxN*.65+.5-(uFxProgress*1.5-.15); if(fxD<0.)discard; fxM=1.-smoothstep(0.,max(.005,uFxEdgeWidth),fxD);'
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\\nuniform float uFxTime; uniform float uFxIntensity; uniform float uFxScale; uniform float uFxProgress; uniform float uFxEdgeWidth; uniform vec3 uFxColor; varying vec3 vFxNormal; varying vec3 vFxWorld; varying vec3 vFxView;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\nfloat fxF=pow(1.0-clamp(abs(dot(normalize(vFxNormal),normalize(vFxView))),0.0,1.0),2.4); float fxM=fxF; ' + effectCode + ' totalEmissiveRadiance+=uFxColor*fxM*uFxIntensity;')
        material.userData.frameModelEffectShader = shader
      }
      material.customProgramCacheKey = () => 'frame-model-effect-' + type + '-v1'
      material.transparent = (effect.opacity ?? 1) < 0.999
      material.opacity = effect.opacity ?? 1
      material.depthWrite = effect.type !== 'hologram' && effect.type !== 'xray' && (effect.opacity ?? 1) >= 0.999
      if (effect.type === 'xray') material.side = THREE.DoubleSide
      material.needsUpdate = true
      updaters.push((delta) => { const shader = material.userData.frameModelEffectShader; if (shader) { shader.uniforms.uFxTime.value += delta * (effect.speed ?? 1); shader.uniforms.uFxProgress.value = effect.progress ?? 0.42; shader.uniforms.uFxEdgeWidth.value = effect.edgeWidth ?? 0.12 } })
    })
  })
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
    emissive: object.emissiveColor || (emissiveMap ? '#ffffff' : '#000000'), emissiveIntensity: object.emissiveIntensity ?? 1,
    alphaMap, transparent: Boolean(alphaMap) || Boolean(object.transparent) || (object.opacity ?? 1) < 1, opacity: object.opacity ?? 1, alphaTest: object.alphaTest ?? 0, depthWrite: object.depthWrite !== false,
    displacementMap, displacementScale: object.displacementScale ?? 0.1,
    side: object.doubleSided || ['plane', 'ring'].includes(object.type) ? THREE.DoubleSide : THREE.FrontSide,
  })
}

function createThreeWaterSurface(object, settings, updaters, disposables) {
  const effect = { color: '#0b3943', opacity: 0.9, distortionScale: 3.7, waveScale: 18, speed: 0.8, sunColor: '#ffffff', sunIntensity: 0.65, resolution: 512, clipBias: 0, ...(object.effects?.material || {}) }
  const resolution = [256, 512, 1024].includes(Number(effect.resolution)) ? Number(effect.resolution) : 512
  const phi = THREE.MathUtils.degToRad(90 - (settings.sunElevation ?? 28))
  const theta = THREE.MathUtils.degToRad(settings.sunAzimuth ?? 135)
  const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  const waterNormals = createWaterNormalTexture()
  const water = new Water(createGeometry(object.type), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: effect.clipBias,
    waterNormals,
    sunDirection,
    sunColor: new THREE.Color(effect.sunColor).multiplyScalar(effect.sunIntensity),
    waterColor: effect.color,
    distortionScale: effect.distortionScale,
    alpha: effect.opacity,
    side: THREE.DoubleSide,
    fog: false,
  })
  water.material.uniforms.size.value = effect.waveScale
  water.material.transparent = effect.opacity < 0.999
  water.material.depthWrite = effect.opacity >= 0.999
  water.renderOrder = 1
  updaters.push((delta) => { water.material.uniforms.time.value += delta * effect.speed })
  disposables.push(waterNormals, water.material.uniforms.mirrorSampler.value, water.geometry, water.material)
  const group = new THREE.Group()
  group.add(water)
  return group
}

function createReflectorSurface(object, disposables) {
  const effect = { color: '#b8dbe2', opacity: 1, resolution: 512, clipBias: 0.003, multisample: 4, ...(object.effects?.material?.type === 'mirror' ? object.effects.material : {}), ...(object.mirror || {}) }
  const resolution = [256, 512, 1024].includes(Number(effect.resolution)) ? Number(effect.resolution) : 512
  const shader = {
    ...Reflector.ReflectorShader,
    uniforms: { ...Reflector.ReflectorShader.uniforms, mirrorOpacity: { value: effect.opacity } },
    fragmentShader: Reflector.ReflectorShader.fragmentShader
      .replace('uniform vec3 color;', 'uniform vec3 color;\\nuniform float mirrorOpacity;')
      .replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( blendOverlay( base.rgb, color ), mirrorOpacity )'),
  }
  const reflector = new Reflector(new THREE.PlaneGeometry(1.8, 1.8), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: effect.clipBias,
    multisample: effect.multisample,
    color: effect.color,
    shader,
  })
  reflector.material.transparent = effect.opacity < 0.999
  reflector.material.depthWrite = effect.opacity >= 0.999
  reflector.renderOrder = 1
  disposables.push({ dispose: () => { reflector.dispose(); reflector.geometry.dispose() } })
  const group = new THREE.Group()
  group.add(reflector)
  return group
}

function createScreenFluidSurface(effect, updaters, disposables) {
  const count = THREE.MathUtils.clamp(Math.round(effect.fluidCount ?? 900), 100, 2600)
  const spread = Math.max(0.4, effect.fluidSpread ?? 2.4)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const seed = (index * 0.61803398875) % 1
    const angle = seed * Math.PI * 2 * 7
    const layer = ((index * 37) % count) / count
    const radius = Math.sqrt(layer) * spread * (0.38 + (index % 11) / 18)
    positions[index * 3] = Math.cos(angle) * radius
    positions[index * 3 + 1] = 0.35 + layer * spread * 1.15 + Math.sin(angle * 1.7) * 0.16
    positions[index * 3 + 2] = Math.sin(angle) * radius
    seeds[index] = seed
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSpeed: { value: effect.speed ?? 0.8 }, uPointSize: { value: effect.fluidPointSize ?? 0.34 }, uSpread: { value: spread }, uColor: { value: new THREE.Color(effect.color || '#25b9ff') }, uSecondary: { value: new THREE.Color(effect.fluidSecondary || '#083d72') }, uOpacity: { value: effect.fluidOpacity ?? 0.72 }, uStrength: { value: effect.strength ?? 0.9 } },
    vertexShader: 'uniform float uTime; uniform float uSpeed; uniform float uPointSize; uniform float uSpread; attribute float aSeed; varying float vSeed; varying float vDepthFade; void main(){vSeed=aSeed; vec3 p=position; float phase=aSeed*18.8496+uTime*uSpeed; p.x+=sin(phase*1.3+position.y*2.0)*0.16*uSpread; p.z+=cos(phase*1.1+position.y*1.6)*0.16*uSpread; p.y+=sin(phase*.7)*.12; vec4 vp=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*vp; gl_PointSize=clamp(uPointSize*(260.0/max(1.0,-vp.z)),3.0,96.0); vDepthFade=smoothstep(26.0,2.0,-vp.z);}',
    fragmentShader: 'uniform vec3 uColor; uniform vec3 uSecondary; uniform float uOpacity; uniform float uStrength; varying float vSeed; varying float vDepthFade; void main(){vec2 p=gl_PointCoord*2.0-1.0; float r2=dot(p,p); if(r2>1.0) discard; vec3 n=normalize(vec3(p,sqrt(max(0.0,1.0-r2)))); vec3 l=normalize(vec3(-.35,.72,.58)); float d=.25+max(dot(n,l),0.0)*.8; float f=pow(1.0-n.z,2.4); float s=pow(max(dot(reflect(-l,n),vec3(0,0,1)),0.0),28.0); float t=pow(max(0.0,n.z),.65); vec3 c=mix(uSecondary,uColor,t*.75+fract(vSeed*17.0)*.12)*d+vec3(.72,.9,1.0)*(f*.65+s*uStrength*1.8); float a=smoothstep(1.0,.72,r2)*uOpacity*vDepthFade*(.48+t*.52); gl_FragColor=vec4(c,a);}'
  })
  const points = new THREE.Points(geometry, material)
  points.position.fromArray(effect.position || [0, 0, 0])
  updaters.push((delta) => { material.uniforms.uTime.value += delta; material.uniforms.uColor.value.set(effect.color || '#25b9ff'); material.uniforms.uSecondary.value.set(effect.fluidSecondary || '#083d72'); material.uniforms.uOpacity.value = effect.fluidOpacity ?? 0.72 })
  disposables.push({ dispose: () => { geometry.dispose(); material.dispose() } })
  return points
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
  const { settings, objects } = structuredClone(config)
  const assetBaseUrl = options.assetBaseUrl || new URL('../', import.meta.url)
  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.postProcessingQuality === 'high' ? 2 : settings.postProcessingQuality === 'performance' ? 1 : 1.5))
  renderer.shadowMap.enabled = options.shadows ?? true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = settings.exposure ?? 1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(settings.cameraFov || 42, 1, settings.cameraNear || 0.1, settings.cameraFar || 1000)
  camera.position.fromArray(settings.cameraPosition || [6.5, 4.8, 7.5])
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.fromArray(settings.cameraTarget || [0, 0.7, 0])
  controls.enableDamping = true
  controls.enabled = options.controls ?? true

  const disposables = []
  const mixers = []
  const nodes = new Map()
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.className = 'frame-runtime-labels'
  container.appendChild(labelRenderer.domElement)
  const sceneEffectUpdaters = []
  await applyEnvironment(scene, renderer, settings, disposables)
  if (settings.fogEnabled) scene.fog = new THREE.Fog(settings.fogColor, settings.fogNear, settings.fogFar)

  scene.add(new THREE.AmbientLight('#ffffff', settings.ambient))
  const key = new THREE.DirectionalLight(settings.keyLightColor, settings.keyLightIntensity)
  key.position.fromArray(settings.keyLightPosition)
  key.castShadow = options.shadows ?? true
  const shadowResolution = settings.postProcessingQuality === 'high' ? 2048 : settings.postProcessingQuality === 'performance' ? 512 : 1024
  key.shadow.mapSize.set(shadowResolution, shadowResolution)
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
  const modelManager = new THREE.LoadingManager()
  const gltfLoader = new GLTFLoader(modelManager)
  gltfLoader.setMeshoptDecoder(MeshoptDecoder)
  const modelLoaders = { fbx: new FBXLoader(modelManager), obj: new OBJLoader(modelManager), stl: new STLLoader(modelManager), ply: new PLYLoader(modelManager), dae: new ColladaLoader(modelManager), '3mf': new ThreeMFLoader(modelManager) }
  const outlineTargets = []
  let dracoLoader
  let ktx2Loader
  if (config.build?.draco) {
    dracoLoader = new DRACOLoader(modelManager)
    dracoLoader.setDecoderPath(new URL('assets/decoders/draco/gltf/', assetBaseUrl).href)
    gltfLoader.setDRACOLoader(dracoLoader)
  }
  if (config.build?.ktx2) {
    ktx2Loader = new KTX2Loader(modelManager)
    ktx2Loader.setTranscoderPath(new URL('assets/decoders/basis/', assetBaseUrl).href)
    ktx2Loader.detectSupport(renderer)
    gltfLoader.setKTX2Loader(ktx2Loader)
  }
  for (const object of objects) {
    let node
    if (object.type === 'model') {
      const format = object.modelFormat || object.modelSource.split('.').pop().toLowerCase()
      const companionLookup = new Map((object.modelFiles || []).map((path) => [path.split('/').pop().toLowerCase(), path]))
      modelManager.setURLModifier((url) => {
        const basename = url.split(/[?#]/)[0].split('/').pop().toLowerCase()
        const companion = companionLookup.get(basename)
        return companion ? new URL(companion, assetBaseUrl).href : url
      })
      if (format === 'obj' && object.modelMtlSource) {
        const materials = await new MTLLoader(modelManager).loadAsync(new URL(object.modelMtlSource, assetBaseUrl).href)
        materials.preload()
        modelLoaders.obj.setMaterials(materials)
      }
      const loaded = format === 'glb' || format === 'gltf' ? await gltfLoader.loadAsync(new URL(object.modelSource, assetBaseUrl).href) : await modelLoaders[format].loadAsync(new URL(object.modelSource, assetBaseUrl).href)
      const source = format === 'glb' || format === 'gltf' ? loaded.scene : format === 'dae' ? loaded.scene : loaded
      const geometry = format === 'stl' || format === 'ply' ? loaded : null
      const model = geometry ? new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: object.color || '#b8c1c7', roughness: object.roughness ?? 0.6, metalness: object.metalness ?? 0.05 })) : cloneSkeleton(source)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
      const sourceScale = Number.isFinite(Number(object.sceneScale)) && Number(object.sceneScale) > 0 ? Number(object.sceneScale) : 1
      const fitScale = object.modelFitMode === 'source' ? 1 : (object.modelTargetSize || 1.8) / maxDimension
      const pivot=new THREE.Group()
      if (object.modelPivotMode === 'ground') pivot.position.set(-center.x, -bounds.min.y, -center.z)
      else if (object.modelPivotMode !== 'origin') pivot.position.copy(center).multiplyScalar(-1)
      pivot.add(model)
      const normalized = new THREE.Group()
      normalized.scale.setScalar(THREE.MathUtils.clamp(fitScale * sourceScale, 1e-7, 1e7))
      normalized.add(pivot)
      node = new THREE.Group()
      node.add(normalized)
      const largeModel = (() => { let triangles = 0; let meshes = 0; model.traverse((child) => { if (!child.isMesh) return; meshes += 1; triangles += child.geometry?.index ? child.geometry.index.count / 3 : (child.geometry?.attributes?.position?.count || 0) / 3 }); return triangles > 500000 || meshes > 500 })()
      const hiddenPaths = new Set(object.modelHiddenNodes || [])
      const applyVisibility = (parent, parentPath = '') => parent.children.forEach((child, index) => { const segment = (child.name || child.type || 'Object') + '[' + index + ']'; const path = parentPath ? parentPath + '/' + segment : segment; child.visible = !hiddenPaths.has(path); applyVisibility(child, path) })
      applyVisibility(model)
      model.traverse((child) => {
        if (!child.isMesh) return
        if (object.modelNormalMode && object.modelNormalMode !== 'source' && child.geometry?.attributes?.position) {
          const sourceGeometry = child.geometry.clone()
          child.geometry = object.modelNormalMode === 'smooth' ? toCreasedNormals(sourceGeometry, THREE.MathUtils.degToRad(object.creaseAngle || 60)) : sourceGeometry
        }
        child.castShadow = !['none', 'receive'].includes(object.modelShadowMode) && !(object.modelShadowMode === 'auto' && largeModel) && object.castShadow !== false
        child.receiveShadow = object.modelShadowMode !== 'none' && object.receiveShadow !== false
        if (object.modelBvhEnabled !== false && !(largeModel && child.geometry.attributes?.position?.count > 1000000)) child.geometry.computeBoundsTree?.({ targetLeafSize: largeModel ? 30 : 10 })
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.filter(Boolean).forEach((material) => {
          if (object.modelMaterialOverride) {
            if ('roughness' in material) material.roughness = object.roughness ?? material.roughness
            if ('metalness' in material) material.metalness = object.metalness ?? material.metalness
          }
          material.transparent = Boolean(object.transparent || (object.opacity ?? 1) < 1)
          material.opacity = object.opacity ?? 1
          material.depthWrite = object.depthWrite !== false
          material.side = object.doubleSided ? THREE.DoubleSide : THREE.FrontSide
          material.flatShading = object.modelNormalMode === 'flat'
          material.needsUpdate = true
        })
      })
      applyModelEffect(model, object.effects?.model || object.effects?.material, sceneEffectUpdaters)
      const clips = loaded.animations || source?.animations || []
      if (clips.length && object.animationClipEnabled !== false) {
        const clip = object.animationClipName ? clips.find(clip => clip.name === object.animationClipName) : clips[0]
        if (clip) {
          const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(clip)
          action.timeScale = object.animationClipSpeed ?? 1
          action.setEffectiveWeight(object.animationClipWeight ?? 1)
          action.setLoop(object.animationClipLoop === 'once' ? THREE.LoopOnce : object.animationClipLoop === 'pingpong' ? THREE.LoopPingPong : THREE.LoopRepeat, object.animationClipLoop === 'once' ? 1 : Infinity)
          action.clampWhenFinished = object.animationClipLoop === 'once'
          action.play(); mixers.push(mixer)
        }
      }
    } else if (object.type === 'flowPipe') {
      const curve = createPipeCurve(object.pipePoints || [[-1,0,0],[1,0,0]], object)
      const geometry = new THREE.TubeGeometry(curve, object.pipeSegments ?? 96, object.pipeRadius ?? .16, object.pipeRadialSegments ?? 16, Boolean(object.pipeClosed))
      const texture = object.flowMode === 'texture' && object.flowTexture ? await textureLoader.loadAsync(new URL(object.flowTexture,assetBaseUrl).href) : createPatternTexture(object.flowMode || 'glow')
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(object.flowRepeat ?? 4,1)
      const material = new THREE.MeshStandardMaterial({ color:object.color || '#55c7d2', map:texture, emissive:object.flowGlowColor || object.flowEmissive || '#2bbac7', emissiveMap:texture, emissiveIntensity:object.flowIntensity ?? 1.5, roughness:object.roughness ?? .35, metalness:object.metalness ?? .15, transparent:Boolean(object.transparent), opacity:object.opacity ?? 1 })
      node=new THREE.Mesh(geometry,material)
      sceneEffectUpdaters.push(delta => { texture.offset.x+=delta*(object.flowSpeed ?? .5)*(object.flowDirection === 'reverse' ? 1 : -1) })
    } else if (object.type === 'reflector') {
      node = createReflectorSurface(object, disposables)
    } else if (object.type !== 'flowPipe' && ['threeWater', 'gpuRippleWater'].includes(object.effects?.material?.type)) {
      node = createThreeWaterSurface(object, settings, sceneEffectUpdaters, disposables)
    } else {
      node = new THREE.Mesh(createGeometry(object.type), await createMaterial(object, textureLoader, assetBaseUrl))
    }
    node.name = object.name
    node.position.fromArray(object.position)
    node.rotation.fromArray(object.rotation)
    node.scale.fromArray(object.scale)
    node.visible = object.visible !== false
    if (object.type !== 'model') node.traverse((child) => { if (child.isMesh) { child.castShadow = object.castShadow !== false; child.receiveShadow = object.receiveShadow !== false } })
    if (object.type !== 'model') applyModelEffect(node, object.effects?.model || object.effects?.material, sceneEffectUpdaters)
    if (object.effects?.outline?.enabled) outlineTargets.push(node)
    scene.add(node)
    nodes.set(object.id,{ object, node })
    if (object.annotationEnabled) {
      const element=document.createElement('div'); element.className='frame-runtime-label'
      element.textContent=object.annotationText || object.name
      Object.assign(element.style,{ color:object.annotationTextColor || '#e2edf3', background:object.annotationBackground || '#101b24', fontSize:(object.annotationFontSize || 14)+'px', padding:(object.annotationPadding ?? 8)+'px', borderRadius:(object.annotationRadius ?? 3)+'px' })
      const label=new CSS2DObject(element); label.position.fromArray(object.annotationOffset || [0,1,0]); node.add(label)
    }
  }
  const updateAnimations=createObjectAnimationUpdater(objects,nodes)
  const particleSettings=options.particles || (typeof config.particles === 'object' ? config.particles : null)
  const particleSystem=particleSettings?.enabled ? createExportParticles(particleSettings) : null
  if (particleSystem) scene.add(particleSystem.mesh)
  const interaction=createSceneInteraction({ container, renderer, scene, camera, controls, nodes, locked:options.sceneLocked ?? config.editor?.sceneLocked ?? false, onSelect:options.onSelect })
  const hud=createRuntimeHud(container,interaction,renderer,options)

  const sceneEffect = config.sceneEffects || settings.sceneEffect
  if (sceneEffect?.enabled && sceneEffect.type === 'screenFluid') {
    scene.add(createScreenFluidSurface(sceneEffect, sceneEffectUpdaters, disposables))
  }
  if (sceneEffect?.enabled && sceneEffect.type === 'water') {
    let waterNormals
    try {
      waterNormals = await textureLoader.loadAsync(new URL(sceneEffect.waterNormals || '/textures/waternormals.jpg', assetBaseUrl).href)
      waterNormals.colorSpace = THREE.NoColorSpace
      waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping
      waterNormals.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    } catch {
      // Keep exported scenes functional when assets are intentionally omitted.
      waterNormals = createWaterNormalTexture()
    }
    const resolution = [256, 512, 1024].includes(sceneEffect.waterResolution) ? sceneEffect.waterResolution : 512
    const phi = THREE.MathUtils.degToRad(90 - (settings.sunElevation ?? 28))
    const theta = THREE.MathUtils.degToRad(settings.sunAzimuth ?? 135)
    const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
    if (settings.backgroundMode === 'color' && sceneEffect.waterSkyEnabled === true) {
      const sky = new Sky()
      sky.scale.setScalar(450000)
      sky.material.uniforms.turbidity.value = 8
      sky.material.uniforms.rayleigh.value = 2.4
      sky.material.uniforms.mieCoefficient.value = 0.006
      sky.material.uniforms.mieDirectionalG.value = 0.82
      sky.material.uniforms.sunPosition.value.copy(sunDirection)
      scene.add(sky)
      disposables.push(sky.geometry, sky.material)
    }
    // Match the editor Water setup so exported reflections and motion remain predictable.
    const water = new Water(new THREE.PlaneGeometry(1, 1), {
      textureWidth: resolution,
      textureHeight: resolution,
      waterNormals,
      sunDirection,
      sunColor: new THREE.Color(sceneEffect.waterSunColor || '#ffffff').multiplyScalar(sceneEffect.waterSunIntensity ?? 0.65),
      waterColor: sceneEffect.color || '#0b3943',
      distortionScale: (sceneEffect.strength ?? 0.62) * 6,
      alpha: sceneEffect.waterAlpha ?? 1,
      side: THREE.DoubleSide,
      fog: Boolean(scene.fog),
    })
    const targetObject = sceneEffect.targetMode === 'object' ? objects.find((object) => object.id === sceneEffect.targetObjectId) : null
    const inheritTargetTransform = Boolean(targetObject && sceneEffect.inheritTargetTransform !== false)
    const effectGroup = new THREE.Group()
    if (inheritTargetTransform) {
      effectGroup.position.fromArray(targetObject.position || [0, 0, 0])
      effectGroup.rotation.fromArray(targetObject.rotation || [0, 0, 0])
      effectGroup.scale.fromArray(targetObject.scale || [1, 1, 1])
    }
    const effectPosition = sceneEffect.position || [0, 0.04, 0]
    const effectRotation = sceneEffect.rotation || [0, 0, 0]
    const effectSize = sceneEffect.size || [sceneEffect.scale ?? 6, sceneEffect.scale ?? 6]
    water.position.fromArray(effectPosition)
    water.rotation.set(-Math.PI / 2 + THREE.MathUtils.degToRad(effectRotation[0] || 0), THREE.MathUtils.degToRad(effectRotation[1] || 0), THREE.MathUtils.degToRad(effectRotation[2] || 0))
    water.scale.set(Math.max(0.01, effectSize[0] || 6), Math.max(0.01, effectSize[1] || 6), 1)
    effectGroup.add(water)
    water.material.uniforms.size.value = sceneEffect.waterWaveScale ?? 18
    water.material.transparent = (sceneEffect.waterAlpha ?? 1) < 0.999
    water.material.depthWrite = (sceneEffect.waterAlpha ?? 1) >= 0.999
    scene.add(effectGroup)
    disposables.push(waterNormals, water.material.uniforms.mirrorSampler.value)
    sceneEffectUpdaters.push((delta) => { water.material.uniforms.time.value += delta * (sceneEffect.speed ?? 0.8) })
  }

  if (sceneEffect?.enabled && sceneEffect.type === 'clipping' && sceneEffect.clippingEnabled !== false) {
    renderer.localClippingEnabled = true
    const clippingTarget = sceneEffect.targetMode === 'object' ? objects.find((object) => object.id === sceneEffect.targetObjectId) : null
    const clippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
    const matchesTarget = (object) => {
      if (!clippingTarget?.name) return true
      let current = object
      while (current) {
        if (current.name === clippingTarget.name) return true
        current = current.parent
      }
      return false
    }
    scene.traverse((object) => {
      if (!object.isMesh || !matchesTarget(object)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => { material.clippingPlanes = [clippingPlane]; material.clipShadows = true; material.needsUpdate = true })
    })
    let clippingTime = 0
    const clippingPoint = new THREE.Vector3()
    const clippingNormal = new THREE.Vector3()
    const clippingTargetQuaternion = new THREE.Quaternion()
    const clippingEffectQuaternion = new THREE.Quaternion()
    sceneEffectUpdaters.push((delta) => {
      clippingTime += delta
      const axis = sceneEffect.clippingAxis === 'y' ? [0, 1, 0] : sceneEffect.clippingAxis === 'z' ? [0, 0, 1] : [1, 0, 0]
      const effectRotation = sceneEffect.rotation || [0, 0, 0]
      clippingEffectQuaternion.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(effectRotation[0] || 0), THREE.MathUtils.degToRad(effectRotation[1] || 0), THREE.MathUtils.degToRad(effectRotation[2] || 0)))
      clippingNormal.set(...axis).applyQuaternion(clippingEffectQuaternion)
      clippingPoint.fromArray(sceneEffect.position || [0, 0, 0])
      if (clippingTarget && sceneEffect.inheritTargetTransform !== false) {
        const targetRotation = clippingTarget.rotation || [0, 0, 0]
        clippingTargetQuaternion.setFromEuler(new THREE.Euler(targetRotation[0] || 0, targetRotation[1] || 0, targetRotation[2] || 0))
        clippingNormal.applyQuaternion(clippingTargetQuaternion)
        const targetScale = clippingTarget.scale || [1, 1, 1]
        clippingPoint.multiply(new THREE.Vector3(targetScale[0] || 1, targetScale[1] || 1, targetScale[2] || 1)).applyQuaternion(clippingTargetQuaternion).add(new THREE.Vector3(...(clippingTarget.position || [0, 0, 0])))
      }
      if (sceneEffect.clippingInvert) clippingNormal.multiplyScalar(-1)
      const sweep = sceneEffect.clippingAnimate === false ? 0 : Math.sin(clippingTime * (sceneEffect.speed ?? 0)) * (sceneEffect.scale ?? 0) * (sceneEffect.clippingSweep ?? 0)
      clippingPoint.addScaledVector(clippingNormal, (sceneEffect.clippingOffset ?? 0) + sweep)
      clippingPlane.setFromNormalAndCoplanarPoint(clippingNormal, clippingPoint)
    })
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
    if (settings.outlineEnabled && outlineTargets.length) {
      const outline = new OutlineEffect(scene, camera, {
        edgeStrength: settings.outlineEdgeStrength ?? 3,
        pulseSpeed: settings.outlinePulseSpeed ?? 0,
        visibleEdgeColor: settings.outlineVisibleEdgeColor || '#ff7a4d',
        hiddenEdgeColor: settings.outlineHiddenEdgeColor || '#3f2018',
        blur: settings.outlineBlur === true,
        xRay: settings.outlineXRay !== false,
      })
      outline.selection.set(outlineTargets)
      effects.push(outline)
    }
    if (settings.postProcessingQuality === 'performance') effects.push(new FXAAEffect())
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }))
    if (settings.aoEnabled || effects.length) {
      const multisampling = settings.postProcessingQuality === 'high' ? 8 : settings.postProcessingQuality === 'balanced' ? 2 : 0
      composer = new EffectComposer(renderer, { multisampling })
      composer.addPass(new RenderPass(scene, camera))
      if (settings.aoEnabled) {
        const aoPass = new N8AOPostPass(scene, camera)
        aoPass.configuration.aoRadius = settings.aoRadius ?? 1.5
        aoPass.configuration.intensity = settings.aoIntensity ?? 1.8
        aoPass.configuration.distanceFalloff = settings.aoDistanceFalloff ?? 0.8
        aoPass.configuration.color = new THREE.Color(settings.aoColor || '#000000')
        aoPass.configuration.halfRes = settings.postProcessingQuality === 'performance'
        aoPass.setQualityMode(settings.postProcessingQuality === 'high' ? 'High' : settings.postProcessingQuality === 'performance' ? 'Performance' : 'Medium')
        composer.addPass(aoPass)
      }
      if (effects.length) composer.addPass(new EffectPass(camera, ...effects))
    }
  }

  const resize = () => {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height, false)
    composer?.setSize(width, height)
    labelRenderer.setSize(width,height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  const clock = new THREE.Clock()
  let frame = 0
  let elapsed = 0
  renderer.info.autoReset=false
  const render = () => {
    frame = requestAnimationFrame(render)
    const rawDelta=clock.getDelta()
    const delta = Math.min(rawDelta,.1)
    elapsed+=delta
    renderer.info.reset()
    if (settings.autoPlayAnimations !== false) updateAnimations(elapsed)
    particleSystem?.update(camera,delta)
    mixers.forEach((mixer) => mixer.update(delta))
    sceneEffectUpdaters.forEach((update) => update(delta))
    controls.update()
    if (composer) composer.render(delta)
    else renderer.render(scene, camera)
    labelRenderer.render(scene,camera)
    hud.sample(rawDelta)
  }
  render()

  return {
    scene, camera, renderer,
    get locked() { return interaction.locked },
    get performanceStats() { return hud.stats },
    get selectedId() { return interaction.selectedId },
    setLocked(value) { interaction.setLocked(value); hud.updateLock() },
    selectObject: interaction.selectObject, updateObject: interaction.updateObject, setTransformMode: interaction.setTransformMode,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      interaction.dispose()
      hud.dispose()
      particleSystem?.mesh.removeFromParent()
      particleSystem?.dispose()
      labelRenderer.domElement.remove()
      mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()) })
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
  readonly locked: boolean
  readonly selectedId: string | null
  readonly performanceStats: Record<string, number> | null
  setLocked(value: boolean): void
  selectObject(id: string): unknown
  updateObject(id: string, patch: { position?: number[]; rotation?: number[]; scale?: number[] }): boolean
  setTransformMode(mode: 'translate' | 'rotate' | 'scale'): void
  dispose(): void
}

export interface ThreeSceneProps {
  className?: string
  controls?: boolean
  grid?: boolean
  shadows?: boolean
  sceneLocked?: boolean
  performanceMonitor?: boolean
  onReady?: (runtime: ThreeSceneRuntime) => void
}

export interface SceneConfig {
  version: number
  name: string
  exportedAt: string
  build: { draco: boolean; ktx2: boolean }
  settings: Record<string, unknown>
  sceneEffects?: Record<string, unknown> | null
  editor: Record<string, unknown>
  objects: Array<Record<string, unknown>>
  structure?: Record<string, unknown>
  particles?: Record<string, unknown> | string
}
`

// Build a small index for humans and tooling. The full object data stays in
// `objects` for backwards compatibility; this index only stores IDs and roles.
const createExportStructure = (objects, settings, includesUi, includesScene, hasParticles) => {
  const categories = {
    renderables: [],
    models: [],
    annotations: [],
    effects: [],
    water: [],
    mirrors: [],
  }
  objects.forEach((object) => {
    const id = object.id || object.name
    if (object.type !== 'annotation') categories.renderables.push(id)
    if (object.type === 'model') categories.models.push(id)
    if (object.annotationEnabled) categories.annotations.push(id)
    if (object.effects && Object.keys(object.effects).length) categories.effects.push(id)
    const materialType = object.effects?.material?.type
    if (materialType === 'threeWater' || materialType === 'gpuRippleWater') categories.water.push(id)
    if (materialType === 'mirror' || object.type === 'reflector' || object.mirror) categories.mirrors.push(id)
  })
  return {
    schemaVersion: 1,
    description: 'FRAME export index: use category IDs to navigate the complete objects array.',
    layers: {
      scene: includesScene ? 'src/config/scene.config' : null,
      ui: includesUi ? 'src/config/ui.config' : null,
      particles: includesScene && hasParticles ? 'src/config/particles.config' : null,
      assets: 'src/assets',
      runtime: includesScene ? 'src/runtime/createThreeScene' : null,
    },
    categories,
    sceneFeatures: {
      background: includesScene ? settings.backgroundMode || 'color' : null,
      postProcessing: includesScene ? Boolean(settings.postProcessingEnabled) : false,
      sceneEffect: includesScene ? settings.sceneEffect?.type || null : null,
    },
  }
}

const componentFor = (framework, language) => {
  const typed = language === 'ts'
  const moduleExtension = typed ? 'ts' : 'js'
  const importExtension = typed ? '' : `.${moduleExtension}`
  if (framework === 'react') return `import React, { useEffect, useRef } from 'react'
${typed ? "import type { ThreeSceneProps, ThreeSceneRuntime } from '../types'\n" : ''}import { sceneConfig } from '../config/scene.config${importExtension}'
import { createThreeScene } from '../runtime/createThreeScene${importExtension}'
import { particleConfig } from '../config/particles.config${importExtension}'
import '../styles/three-scene.css'

export function ThreeScene(${typed ? "{ className = '', controls = true, grid, shadows = true, sceneLocked, performanceMonitor = true, onReady }: ThreeSceneProps" : "{ className = '', controls = true, grid, shadows = true, sceneLocked, performanceMonitor = true, onReady }"}) {
  const containerRef = useRef${typed ? '<HTMLDivElement | null>' : ''}(null)
  useEffect(() => {
    let disposed = false
    let runtime${typed ? ': ThreeSceneRuntime | undefined' : ''}
    if (!containerRef.current) return undefined
    createThreeScene(containerRef.current, sceneConfig, { controls, grid, shadows, sceneLocked, performanceMonitor, particles: particleConfig, assetBaseUrl: new URL('../', import.meta.url) }).then((instance) => {
      if (disposed) instance.dispose()
      else { runtime = instance; onReady?.(instance) }
    })
    return () => { disposed = true; runtime?.dispose() }
  }, [controls, grid, shadows, sceneLocked, performanceMonitor, onReady])
  return <div ref={containerRef} className={\`three-scene \${className}\`} />
}
`

  return `<script setup${typed ? ' lang="ts"' : ''}>
import { onBeforeUnmount, onMounted, ref } from 'vue'
${typed ? "import type { ThreeSceneRuntime } from '../types'\n" : ''}import { sceneConfig } from '../config/scene.config${importExtension}'
import { createThreeScene } from '../runtime/createThreeScene${importExtension}'
import { particleConfig } from '../config/particles.config${importExtension}'
import '../styles/three-scene.css'

${typed ? "const props = withDefaults(defineProps<{ controls?: boolean; grid?: boolean; shadows?: boolean; sceneLocked?: boolean; performanceMonitor?: boolean }>(), { controls: true, shadows: true, performanceMonitor: true })\nconst emit = defineEmits<{ ready: [runtime: ThreeSceneRuntime] }>()\nconst container = ref<HTMLDivElement | null>(null)\nlet runtime: ThreeSceneRuntime | undefined" : "const props = defineProps({ controls: { type: Boolean, default: true }, grid: { type: Boolean, default: undefined }, shadows: { type: Boolean, default: true }, sceneLocked: { type: Boolean, default: undefined }, performanceMonitor: { type: Boolean, default: true } })\nconst emit = defineEmits(['ready'])\nconst container = ref(null)\nlet runtime"}
let disposed = false
onMounted(async () => {
  if (!container.value) return
  const instance = await createThreeScene(container.value, sceneConfig, { ...props, particles: particleConfig, assetBaseUrl: new URL('../', import.meta.url) })
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

const readmeFor = (framework, sceneName, language, optimize, exportMode = 'scene') => `# ${sceneName}

由 FRAME Three Editor 导出的可移植 ${framework === 'react' ? 'React' : 'Vue'} ${language === 'ts' ? 'TypeScript' : 'JavaScript'} 场景组件。

## 使用

1. 将整个 \`three_scene\` 目录复制到目标项目。
2. 安装依赖：\`npm install\`。
${optimize ? '3. 执行资源优化：`npm run optimize:assets`。脚本使用内容哈希跳过未变化模型。\n4.' : '3.'} 从 \`src/index.${language === 'ts' ? 'ts' : 'js'}\` 导入 \`${exportMode === 'ui' ? 'UiCanvas' : exportMode === 'composite' ? 'CompositeScene' : 'ThreeScene'}\`。
5. 给组件或父容器设置明确高度，例如 \`height: 600px\`。

${exportMode === 'ui' ? '\`<UiCanvas />\`' : exportMode === 'composite' ? '\`<CompositeScene />\`' : framework === 'react' ? '\`<ThreeScene controls grid shadows />\`' : '\`<ThreeScene :controls="true" :grid="true" :shadows="true" />\`'}

## 交互与性能

- 画面左上角的锁图标控制全局锁。锁住后不能选择或变换对象，仍可操作观察视角；初始状态来自 scene.config.editor.sceneLocked。
- 解锁后点击对象显示移动控件。onReady / ready 返回的 runtime 支持 setTransformMode('translate' | 'rotate' | 'scale')、selectObject(id)、updateObject(id, patch) 和 setLocked(boolean)。锁定时编辑 API 同样拒绝修改。
- 性能面板显示 FPS、帧间隔及包含阴影/后期的绘制调用；performanceMonitor=false 可隐藏面板，runtime.performanceStats 可读取采样结果。
- 平滑法线、指定模型动画、流光管道、对象动画与粒子模拟由导出运行时执行；粒子配置通过组件注入，不需要手动拼装。

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
  peerDependencies: framework === 'react' ? { react: '>=18', three: '>=0.180', 'three-mesh-bvh': '>=0.9', postprocessing: '>=6.37', n8ao: '>=1.10' } : { vue: '>=3.4', three: '>=0.180', 'three-mesh-bvh': '>=0.9', postprocessing: '>=6.37', n8ao: '>=1.10' },
  devDependencies: {
    ...(optimize ? { '@gltf-transform/cli': '^4.4.1' } : {}),
    ...(language === 'ts' ? { typescript: '^5.8.0', '@types/three': '^0.180.0', ...(framework === 'react' ? { '@types/react': '^19.0.0' } : {}) } : {}),
  },
}, null, 2)

export async function buildSceneProject({ framework, language = 'js', folderName, exportMode = 'scene', objects, settings, editor, ui, particles, sceneEffects, includeAssets = true, includeReadme = true, optimizeDraco = false, optimizeKtx2 = false }) {
  const files = new Map()
  const exportedObjects = structuredClone(objects)
  const exportedSettings = structuredClone(settings)
  const sourceCache = new Map()
  const contentCache = new Map()
  const includesScene = exportMode !== 'ui'
  const includesUi = exportMode !== 'scene'
  const hasModels = includesScene && exportedObjects.some((object) => object.type === 'model')
  const draco = includesScene && includeAssets && (optimizeDraco || hasModels)
  const ktx2 = includesScene && includeAssets && (optimizeKtx2 || hasModels)
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

  for (const object of includesScene ? exportedObjects : []) {
    const objectSlug = slugify(object.name, object.id)
    if (object.type === 'model' && object.modelAssetId && includeAssets) {
      const modelPackage = await getModelAsset(object.modelAssetId)
      if (!modelPackage) throw new Error(`模型资源包不存在：${object.name}`)
      const packageFolder = `assets/models/${objectSlug}-${object.modelAssetId.slice(-6)}`
      const packagePaths = new Map()
      modelPackage.files.forEach((entry) => {
        const safePath = normalizeAssetPath(entry.name).split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
        const assetPath = `${packageFolder}/${safePath}`
        files.set(`src/${assetPath}`, entry.blob)
        packagePaths.set(normalizeAssetPath(entry.name), assetPath)
      })
      object.modelSource = packagePaths.get(normalizeAssetPath(modelPackage.mainFile))
      const mtlEntry = modelPackage.files.find((entry) => extensionFrom(entry.name, entry.name, '') === 'mtl')
      object.modelMtlSource = mtlEntry ? packagePaths.get(normalizeAssetPath(mtlEntry.name)) : undefined
      object.modelFiles = [...packagePaths.values()]
      delete object.modelAssetId
      delete object.embeddedModelAsset
    } else if (object.type === 'model' && object.modelSource) {
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

  if (includesScene && exportedSettings.sceneEffect?.type === 'water') {
    exportedSettings.sceneEffect.waterNormals = await addAsset('/textures/waternormals.jpg', 'textures', 'waternormals', 'jpg')
  }

  const decoderFiles = [...(draco ? DRACO_DECODERS : []), ...(ktx2 ? KTX2_TRANSCODERS : [])]
  for (const decoder of decoderFiles) files.set(`src/assets/decoders/${decoder}`, await fetchAsset(`/decoders/${decoder}`))

  const moduleExtension = language === 'ts' ? 'ts' : 'js'
  const componentExtension = framework === 'react' ? (language === 'ts' ? 'tsx' : 'jsx') : 'vue'
  const hasParticles = Boolean(particles && Object.keys(particles).length)
  const structure = createExportStructure(exportedObjects, exportedSettings, includesUi, includesScene, hasParticles)
  const config = { version: 4, name: folderName, exportedAt: new Date().toISOString(), build: { draco, ktx2 }, settings: exportedSettings, sceneEffects: sceneEffects || null, editor, objects: exportedObjects, structure, ...(hasParticles ? { particles: './particles.config' } : {}) }
  if (includesScene) {
    const configComment = '// Generated scene entry: settings controls the renderer, objects contains complete object data, and structure provides category indexes.\n'
    files.set(`src/config/scene.config.${moduleExtension}`, `${configComment}${language === 'ts' ? "import type { SceneConfig } from '../types'\n\n" : ''}export const sceneConfig${language === 'ts' ? ': SceneConfig' : ''} = ${JSON.stringify(config, null, 2)}\n`)
    files.set('src/config/EXPORT_STRUCTURE.md', [
      '# Export structure',
      '',
      '- `scene.config`: renderer settings, complete object data, and the `structure` category index.',
      '- `particles.config`: serializable particle settings snapshot, generated for scene exports.',
      '- `runtime`: generated Three.js runtime; it reads config and owns resource/effect lifecycle.',
      '- `assets/models`: models and companion files.',
      '- `assets/textures`: material textures and water normal maps.',
      '- `structure.categories`: object IDs grouped as renderables, models, annotations, effects, water, and mirrors.',
      '',
      'Use `structure` to find an object category, then edit the matching entry in `objects`. Keep transient runtime state out of scene config.',
      '',
    ].join('\\n'))
    files.set(`src/config/particles.config.${moduleExtension}`, `// Generated particle simulation settings. Runtime behavior is driven by this serializable snapshot.\nexport const particleConfig = ${JSON.stringify(particles || { enabled: false }, null, 2)}\n`)
    files.set(`src/runtime/createThreeScene.${moduleExtension}`, `${language === 'ts' ? '// @ts-nocheck -- generated Three.js runtime; public API is typed in types.ts.\n' : ''}${sceneRuntime.replace('./createExportParticles.js', language === 'ts' ? './createExportParticles' : './createExportParticles.js')}`)
    files.set(`src/runtime/createExportParticles.${moduleExtension}`, `${language === 'ts' ? '// @ts-nocheck\n' : ''}${particleRuntimeSource}`)
    files.set(`src/components/ThreeScene.${componentExtension}`, componentFor(framework, language))
    files.set('src/styles/three-scene.css', `.three-scene { position: relative; width: 100%; height: 100%; min-height: 320px; overflow: hidden; background: ${exportedSettings.background}; }\n.three-scene canvas { display: block; width: 100%; height: 100%; }
.frame-runtime-labels{position:absolute;inset:0;pointer-events:none}.frame-runtime-label{white-space:nowrap;font-family:system-ui,sans-serif}.frame-runtime-hud{position:absolute;left:14px;top:14px;z-index:20;display:flex;align-items:flex-start;gap:10px;color:#cbd5df;font:11px system-ui,sans-serif}.frame-runtime-lock{width:32px;height:32px;display:grid;place-items:center;color:#f6a36b;background:#29221e;border:1px solid #815333;border-radius:5px;cursor:pointer}.frame-runtime-lock[aria-pressed=true]{background:#a75129;color:#fff}.frame-runtime-performance{background:#10171ded;border:1px solid #354047;border-radius:6px;min-width:180px}.frame-runtime-performance button{padding:8px 10px;width:100%;text-align:left;color:#efa26f;border:0;background:none;cursor:pointer}.frame-runtime-performance pre{padding:0 10px 10px;margin:0;line-height:1.9;font:11px/1.9 monospace}\n`)
  }
  if (includesUi) {
    const uiConfig = ui || { version: 1, template: 'minimal', canvas: { width: 1440, height: 900 }, nodes: [] }
    files.set(`src/config/ui.config.${moduleExtension}`, `export const uiConfig${language === 'ts' ? ': { version: number; template?: string; canvas: { width: number; height: number; background?: string; [key: string]: unknown }; nodes: Array<{ id: string; type: string; text?: string; [key: string]: unknown }>; [key: string]: unknown }' : ''} = ${JSON.stringify(uiConfig, null, 2)}\n`)
    files.set(`src/runtime/uiNodeStyle.${moduleExtension}`, `${language === 'ts' ? '// @ts-nocheck\n' : ''}export const uiNodeStyle${language === 'ts' ? ': any' : ''} = ${uiNodeStyle.toString()}\n`)
    const uiComponent = framework === 'react'
      ? `import { uiConfig } from '../config/ui.config${language === 'ts' ? '' : '.js'}'\nimport { uiNodeStyle } from '../runtime/uiNodeStyle${language === 'ts' ? '' : '.js'}'\nimport '../styles/ui-canvas.css'\n\nexport function UiCanvas(${language === 'ts' ? "{ className = '' }: { className?: string }" : "{ className = '' }"}) {\n  return <div className={'frame-ui-canvas ' + className} style={{ aspectRatio: uiConfig.canvas.width + ' / ' + uiConfig.canvas.height, background: uiConfig.canvas.background || '#f3f4ef' }}>\n    {uiConfig.nodes.map((${language === 'ts' ? 'node: any' : 'node'}) => <div key={node.id} className={'frame-ui-node frame-ui-' + node.type} style={uiNodeStyle(node, uiConfig.canvas, true)}>{node.text}</div>)}\n  </div>\n}\n`
      : `<script setup${language === 'ts' ? ' lang="ts"' : ''}>\nimport { uiConfig } from '../config/ui.config${language === 'ts' ? '' : '.js'}'\nimport { uiNodeStyle } from '../runtime/uiNodeStyle${language === 'ts' ? '' : '.js'}'\nimport '../styles/ui-canvas.css'\n</script>\n<template><div :class="['frame-ui-canvas', $attrs.class]" :style="{ aspectRatio: uiConfig.canvas.width + ' / ' + uiConfig.canvas.height, background: uiConfig.canvas.background || '#f3f4ef' }"><div v-for="node in uiConfig.nodes" :key="node.id" :class="['frame-ui-node', 'frame-ui-' + node.type]" :style="uiNodeStyle(node, uiConfig.canvas, true)">{{ node.text }}</div></div></template>\n`
    files.set(`src/components/UiCanvas.${componentExtension}`, uiComponent)
    files.set('src/styles/ui-canvas.css', `.frame-ui-canvas{position:relative;container-type:inline-size;width:100%;height:auto;overflow:hidden}.frame-ui-node{position:absolute;box-sizing:border-box}.frame-ui-button{cursor:pointer}\n`)
  }
  if (exportMode === 'composite') {
    const composite = framework === 'react'
      ? `import { ThreeScene } from './ThreeScene${language === 'ts' ? '' : '.jsx'}'\nimport { UiCanvas } from './UiCanvas${language === 'ts' ? '' : '.jsx'}'\nimport '../styles/composite-scene.css'\nexport function CompositeScene() { return <div className="frame-composite"><ThreeScene className="frame-composite-3d" /><UiCanvas className="frame-composite-ui" /></div> }\n`
      : `<script setup${language === 'ts' ? ' lang="ts"' : ''}>\nimport ThreeScene from './ThreeScene.vue'\nimport UiCanvas from './UiCanvas.vue'\nimport '../styles/composite-scene.css'\n</script>\n<template><div class="frame-composite"><ThreeScene class="frame-composite-3d"/><UiCanvas class="frame-composite-ui"/></div></template>\n`
    files.set(`src/components/CompositeScene.${componentExtension}`, composite.replace('<script setup><import-error /></script>\n', ''))
    files.set('src/styles/composite-scene.css', `.frame-composite{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden}.frame-composite-3d,.frame-composite-ui{position:absolute;inset:0}.frame-composite-ui{z-index:2;pointer-events:none}.frame-composite-ui .frame-ui-button{pointer-events:auto}\n`)
  }
  const componentImport = framework === 'vue' ? `./components/ThreeScene.${componentExtension}` : `./components/ThreeScene${language === 'ts' ? '' : '.jsx'}`
  const configImport = `./config/scene.config${language === 'ts' ? '' : '.js'}`
  const uiImport = framework === 'vue' ? `./components/UiCanvas.${componentExtension}` : `./components/UiCanvas${language === 'ts' ? '' : '.jsx'}`
  const compositeImport = framework === 'vue' ? `./components/CompositeScene.${componentExtension}` : `./components/CompositeScene${language === 'ts' ? '' : '.jsx'}`
  const indexLines = []
  if (includesScene) indexLines.push(`export { ${framework === 'vue' ? 'default as ThreeScene' : 'ThreeScene'} } from '${componentImport}'`, `export { sceneConfig } from '${configImport}'`)
  if (includesScene && hasParticles) indexLines.push(`export { particleConfig } from './config/particles.config${language === 'ts' ? '' : '.js'}'`)
  if (includesUi) indexLines.push(`export { ${framework === 'vue' ? 'default as UiCanvas' : 'UiCanvas'} } from '${uiImport}'`, `export { uiConfig } from './config/ui.config${language === 'ts' ? '' : '.js'}'`)
  if (exportMode === 'composite') indexLines.push(`export { ${framework === 'vue' ? 'default as CompositeScene' : 'CompositeScene'} } from '${compositeImport}'`)
  if (language === 'ts' && includesScene) indexLines.push("export type { SceneConfig, ThreeSceneProps, ThreeSceneRuntime } from './types'")
  files.set(`src/index.${moduleExtension}`, `${indexLines.join('\n')}\n`)
  if (language === 'ts' && includesScene) files.set('src/types.ts', typesTemplate)
  if (draco || ktx2) files.set('scripts/optimize-assets.mjs', optimizationScriptFor(draco, ktx2))
  files.set('package.json', packageFor(framework, folderName, language, optimizeDraco || optimizeKtx2))
  if (includeReadme) files.set('README.md', readmeFor(framework, folderName, language, draco || ktx2, exportMode))
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
