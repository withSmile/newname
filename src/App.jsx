import React, { forwardRef, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { Center, ContactShadows, Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls, OrthographicCamera, PerspectiveCamera, Sky, TransformControls, useAnimations, useGLTF } from '@react-three/drei'
import { Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, Noise, Outline, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Sky as ThreeSky } from 'three/addons/objects/Sky.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import {
  Box, BoxSelect, Camera, Check, ChevronDown, ChevronsDown, ChevronsUp, Circle, Copy, Download, Eye, EyeOff, FileJson, Focus, ImagePlus,
  Grid3X3, HelpCircle, ImageDown, Lightbulb, Lock, Magnet, Menu, MousePointer2, Move3D,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Plus, Redo2, Rotate3D, Scaling, Search, Settings2, Shapes, Trash2, Undo2, Unlock, Upload, X,
} from 'lucide-react'
import { useEditor } from './store'
import { useShallow } from 'zustand/react/shallow'
import { ExportDialog } from './ExportDialog'
import { RoamingPanel } from './features/interaction/roaming/RoamingPanel'
import { RoamingRuntime } from './features/interaction/roaming/RoamingRuntime'
import { FlowPipeObject } from './features/scene/flow-pipe/FlowPipeObject'
import { FlowPipeInspector } from './features/scene/flow-pipe/FlowPipeInspector'
import { useRoaming } from './features/interaction/roaming/roamingStore'

const geometryFor = (type) => {
  const center = (geometry) => { geometry.computeBoundingBox(); geometry.center(); geometry.computeBoundingSphere(); if (geometry.attributes.uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv.clone()) }
  const tubePath = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(-0.35, 0.5, 0), new THREE.Vector3(0.35, -0.5, 0), new THREE.Vector3(0.8, 0, 0)])
  if (type === 'sphere') return <sphereGeometry args={[0.7, 48, 32]} onUpdate={center} />
  if (type === 'torus') return <torusGeometry args={[0.65, 0.22, 24, 64]} onUpdate={center} />
  if (type === 'cylinder') return <cylinderGeometry args={[0.62, 0.62, 1.25, 40, 12]} onUpdate={center} />
  if (type === 'cone') return <coneGeometry args={[0.68, 1.35, 40, 12]} onUpdate={center} />
  if (type === 'plane') return <planeGeometry args={[1.8, 1.8, 12, 12]} onUpdate={center} />
  if (type === 'capsule') return <capsuleGeometry args={[0.42, 0.8, 8, 24]} onUpdate={center} />
  if (type === 'ring') return <ringGeometry args={[0.38, 0.72, 48, 12]} onUpdate={center} />
  if (type === 'tetrahedron') return <tetrahedronGeometry args={[0.9, 1]} onUpdate={center} />
  if (type === 'octahedron') return <octahedronGeometry args={[0.9, 1]} onUpdate={center} />
  if (type === 'dodecahedron') return <dodecahedronGeometry args={[0.82, 1]} onUpdate={center} />
  if (type === 'icosahedron') return <icosahedronGeometry args={[0.86, 1]} onUpdate={center} />
  if (type === 'pipe') return <primitive object={new THREE.TubeGeometry(tubePath, 32, 0.16, 16, false)} onUpdate={center} attach="geometry" />
  if (type === 'torusKnot') return <torusKnotGeometry args={[0.52, 0.16, 96, 16, 2, 3]} onUpdate={center} />
  if (type === 'lathe') return <primitive object={new THREE.LatheGeometry([new THREE.Vector2(0.08, -0.7), new THREE.Vector2(0.48, -0.55), new THREE.Vector2(0.32, 0), new THREE.Vector2(0.52, 0.55), new THREE.Vector2(0.12, 0.72)], 40)} onUpdate={center} attach="geometry" />
  return <boxGeometry args={[1, 1, 1, 16, 16, 16]} onUpdate={center} />
}

const MODEL_ASSETS = [
  { name: 'Damaged Helmet', source: '/models/DamagedHelmet.glb', category: 'PBR', attribution: 'Khronos glTF Sample Assets · CC BY 4.0' },
  { name: 'Fox', source: '/models/Fox.glb', category: '动画', animated: true, attribution: 'PixelMannen / Autodesk · CC0 + CC BY 4.0' },
  { name: 'Cesium Man', source: '/models/CesiumMan.glb', category: '蒙皮', animated: true, attribution: 'Cesium · CC BY 4.0' },
  { name: 'Khronos Box', source: '/models/Box.glb', category: '基础', attribution: 'Khronos glTF Sample Assets' },
]

const MODEL_FORMATS = {
  glb: { label: 'GLB', description: '材质、贴图、骨骼与动画', recommended: true }, gltf: { label: 'glTF', description: '开放标准场景格式' },
  fbx: { label: 'FBX', description: 'DCC 与动画交换', loader: FBXLoader }, obj: { label: 'OBJ', description: '通用静态网格', loader: OBJLoader },
  stl: { label: 'STL', description: '打印与工程网格', loader: STLLoader, geometry: true }, ply: { label: 'PLY', description: '扫描与点面数据', loader: PLYLoader, geometry: true },
  dae: { label: 'Collada', description: 'DAE 场景交换', loader: ColladaLoader }, '3mf': { label: '3MF', description: '3D 制造格式', loader: ThreeMFLoader },
}

function applyMeshSmoothing(root, object) {
  const smooth = object.smoothShading ?? object.pipeSmooth ?? true
  const creaseAngle = THREE.MathUtils.degToRad(object.creaseAngle ?? object.pipeCreaseAngle ?? 60)
  root?.traverse((child) => {
    if (!child.isMesh) return
    if (child.geometry?.attributes?.position) {
      const sourceGeometry = child.geometry.clone()
      if (smooth) {
        const nextGeometry = toCreasedNormals(sourceGeometry, creaseAngle)
        if (nextGeometry !== sourceGeometry) sourceGeometry.dispose()
        child.geometry = nextGeometry
      } else child.geometry = sourceGeometry
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((material) => { material.flatShading = !smooth; material.needsUpdate = true })
  })
  return root
}
const modelFormatFrom = (name = '') => name.split('.').pop()?.toLowerCase() || 'glb'

const ENVIRONMENT_PRESETS = [
  { id: 'studio', label: '影棚', colors: ['#25292d', '#fff2df'], values: { backgroundMode: 'color', background: '#25292d', environmentIntensity: 1.25, environmentRotation: 0, ambient: 0.45, keyLightColor: '#fff2df', keyLightIntensity: 2.1, fillLightColor: '#79a7c7', fillLightIntensity: 12, rimLightColor: '#f08a62', rimLightIntensity: 2.2, exposure: 1, fogEnabled: false } },
  { id: 'product', label: '产品', colors: ['#d6dadd', '#ffffff'], values: { backgroundMode: 'color', background: '#d6dadd', environmentIntensity: 1.65, environmentRotation: 35, ambient: 0.55, keyLightColor: '#ffffff', keyLightIntensity: 2.8, fillLightColor: '#b6d5df', fillLightIntensity: 8, rimLightColor: '#ffffff', rimLightIntensity: 1.5, exposure: 1.05, fogEnabled: false } },
  { id: 'sunset', label: '夕照', colors: ['#3a2927', '#ffb06b'], values: { backgroundMode: 'sky', background: '#3a2927', environmentIntensity: 1.1, environmentRotation: 0, sunElevation: 4, sunAzimuth: 235, skyTurbidity: 12, skyRayleigh: 3.5, ambient: 0.2, keyLightColor: '#ffb06b', keyLightIntensity: 3.1, fillLightColor: '#6c80bb', fillLightIntensity: 9, rimLightColor: '#ff8059', rimLightIntensity: 2.8, exposure: 1.1, fogEnabled: true, fogColor: '#3a2927', fogNear: 10, fogFar: 30 } },
  { id: 'night', label: '夜景', colors: ['#11161d', '#7fa6ff'], values: { backgroundMode: 'color', background: '#11161d', environmentIntensity: 0.75, environmentRotation: 210, ambient: 0.12, keyLightColor: '#7fa6ff', keyLightIntensity: 2.4, fillLightColor: '#d45b86', fillLightIntensity: 7, rimLightColor: '#8c6cff', rimLightIntensity: 3.2, exposure: 0.9, fogEnabled: true, fogColor: '#11161d', fogNear: 8, fogFar: 26 } },
]

const POST_PROCESSING_PRESETS = [
  { id: 'clean', label: '清晰', values: { bloomEnabled: false, depthOfFieldEnabled: false, vignetteEnabled: false, chromaticAberrationEnabled: false, noiseEnabled: false } },
  { id: 'cinematic', label: '电影', values: { bloomEnabled: true, bloomIntensity: 0.5, bloomThreshold: 0.78, depthOfFieldEnabled: true, depthOfFieldFocusDistance: 0.02, depthOfFieldFocalLength: 0.035, depthOfFieldBokehScale: 1.8, vignetteEnabled: true, vignetteOffset: 0.2, vignetteDarkness: 0.62, chromaticAberrationEnabled: false, noiseEnabled: true, noiseOpacity: 0.025 } },
  { id: 'dream', label: '柔光', values: { bloomEnabled: true, bloomIntensity: 1.05, bloomThreshold: 0.58, bloomSmoothing: 0.3, depthOfFieldEnabled: false, vignetteEnabled: true, vignetteOffset: 0.3, vignetteDarkness: 0.42, chromaticAberrationEnabled: true, chromaticAberrationOffset: 0.0008, noiseEnabled: false } },
]

const SCENE_SETTING_KEYS = ['environmentPreset', 'backgroundMode', 'background', 'environmentIntensity', 'environmentRotation', 'skyTurbidity', 'skyRayleigh', 'skyMieCoefficient', 'skyMieDirectionalG', 'sunElevation', 'sunAzimuth', 'ambient', 'keyLightColor', 'keyLightIntensity', 'keyLightPosition', 'fillLightColor', 'fillLightIntensity', 'fillLightPosition', 'fillLightDistance', 'rimLightEnabled', 'rimLightColor', 'rimLightIntensity', 'rimLightPosition', 'rimLightAngle', 'hemisphereEnabled', 'hemisphereSkyColor', 'hemisphereGroundColor', 'hemisphereIntensity', 'exposure', 'postProcessingEnabled', 'postProcessingQuality', 'outlineEnabled', 'outlineEdgeStrength', 'outlinePulseSpeed', 'outlineVisibleEdgeColor', 'outlineHiddenEdgeColor', 'outlineBlur', 'outlineXRay', 'colorAdjustEnabled', 'brightness', 'contrast', 'hue', 'saturation', 'bloomEnabled', 'bloomIntensity', 'bloomThreshold', 'bloomSmoothing', 'depthOfFieldEnabled', 'depthOfFieldFocusDistance', 'depthOfFieldFocalLength', 'depthOfFieldBokehScale', 'vignetteEnabled', 'vignetteOffset', 'vignetteDarkness', 'chromaticAberrationEnabled', 'chromaticAberrationOffset', 'noiseEnabled', 'noiseOpacity', 'fogEnabled', 'fogColor', 'fogNear', 'fogFar', 'gridColor', 'gridSectionColor', 'gridSize', 'worldAxesEnabled', 'worldAxesSize', 'worldAxesPosition', 'worldAxesOpacity', 'worldAxesDepthTest', 'sceneSize', 'cameraFov', 'cameraNear', 'cameraFar', 'shadowOpacity', 'shadowBlur', 'customLights']
const readSceneSettings = () => { const state = useEditor.getState(); return Object.fromEntries(SCENE_SETTING_KEYS.map((key) => [key, state[key]])) }
const readRoamingSettings = () => { const state = useRoaming.getState(); return Object.fromEntries(['pathPoints', 'speed', 'loop', 'curveType', 'tension', 'bendFactor', 'lookAhead', 'eyeHeight', 'colliderRadius', 'gravity', 'sprintMultiplier'].map((key) => [key, state[key]])) }
SCENE_SETTING_KEYS.push('skyboxHdr', 'skyboxHdrName', 'skyboxCube', 'skyboxCubeNames')

const WRAP_MODES = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping, mirror: THREE.MirroredRepeatWrapping }
const MATERIAL_IMAGE_CACHE = new Map()
const SCENE_OBJECT_REFS = new Map()

const configureTexture = (texture, colorTexture, object, gl) => {
  const repeat = object.textureRepeat || [object.mapRepeat ?? 1, object.mapRepeat ?? 1]
  const offset = object.textureOffset || [0, 0]
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  texture.wrapS = texture.wrapT = WRAP_MODES[object.textureWrap || 'repeat']
  texture.repeat.set(Math.max(0.01, repeat[0]), Math.max(0.01, repeat[1]))
  texture.offset.set(offset[0], offset[1])
  texture.center.set(0.5, 0.5)
  texture.rotation = THREE.MathUtils.degToRad(object.textureRotation ?? object.mapRotation ?? 0)
  texture.flipY = object.textureFlipY ?? true
  texture.needsUpdate = true
}

function useMaterialTexture(source, colorTexture, object) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const cachedImage = source ? MATERIAL_IMAGE_CACHE.get(source) : null
  const immediateTexture = useMemo(() => {
    if (!cachedImage) return null
    const map = new THREE.Texture(cachedImage)
    configureTexture(map, colorTexture, object, gl)
    return map
  }, [source, cachedImage, colorTexture, gl])
  const [loadedTexture, setLoadedTexture] = useState(null)
  useEffect(() => {
    if (!source || immediateTexture) { setLoadedTexture(null); return }
    let active = true
    let loaded = null
    new THREE.TextureLoader().load(source, (map) => {
      loaded = map
      if (!active) { map.dispose(); return }
      configureTexture(map, colorTexture, object, gl)
      setLoadedTexture(map)
      invalidate()
    }, undefined, () => { if (active) setLoadedTexture(null) })
    return () => { active = false; loaded?.dispose() }
  }, [source, colorTexture, immediateTexture, gl, invalidate])
  useEffect(() => () => immediateTexture?.dispose(), [immediateTexture])
  const texture = immediateTexture || loadedTexture
  useEffect(() => {
    if (!texture) return
    configureTexture(texture, colorTexture, object, gl)
    invalidate()
  }, [texture, colorTexture, object.textureRepeat, object.textureOffset, object.textureRotation, object.textureWrap, object.textureFlipY, object.mapRepeat, object.mapRotation, gl, invalidate])
  return texture
}

function ObjectMaterial({ object, shading }) {
  const materialRef = useRef()
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const textures = object.textures || {}
  const baseMap = useMaterialTexture(textures.baseColor?.data || object.map, true, object)
  const normalMap = useMaterialTexture(textures.normal?.data, false, object)
  const roughnessMap = useMaterialTexture(textures.roughness?.data, false, object)
  const metalnessMap = useMaterialTexture(textures.metalness?.data, false, object)
  const aoMap = useMaterialTexture(textures.ao?.data, false, object)
  const emissiveMap = useMaterialTexture(textures.emissive?.data, true, object)
  const alphaMap = useMaterialTexture(textures.alpha?.data, false, object)
  const displacementMap = useMaterialTexture(textures.displacement?.data, false, object)
  const normalScale = useMemo(() => new THREE.Vector2(object.normalScale ?? 1, object.normalScale ?? 1), [object.normalScale])
  const materialKey = [baseMap, normalMap, roughnessMap, metalnessMap, aoMap, emissiveMap, alphaMap, displacementMap].map((map) => map?.uuid || 'none').join(':')
  useEffect(() => {
    if (!materialRef.current) return
    materialRef.current.needsUpdate = true
    gl.compile(scene, camera)
    invalidate()
    const frame = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(frame)
  }, [materialKey, gl, scene, camera, invalidate])
  return <meshStandardMaterial key={materialKey} ref={materialRef}
    color={object.color} roughness={object.roughness} metalness={object.metalness}
    envMapIntensity={object.envMapIntensity ?? 1}
    map={baseMap} normalMap={normalMap} normalScale={normalScale}
    roughnessMap={roughnessMap} metalnessMap={metalnessMap}
    aoMap={aoMap} aoMapIntensity={object.aoIntensity ?? 1}
    emissiveMap={emissiveMap} emissive={emissiveMap ? object.emissiveColor || '#ffffff' : '#000000'} emissiveIntensity={object.emissiveIntensity ?? 1}
    alphaMap={alphaMap} transparent={Boolean(alphaMap) || Boolean(object.transparent) || (object.opacity ?? 1) < 1} opacity={object.opacity ?? 1} alphaTest={object.alphaTest ?? 0} depthWrite={object.depthWrite !== false}
    displacementMap={displacementMap} displacementScale={object.displacementScale ?? 0.1}
    side={object.doubleSided || ['plane', 'ring'].includes(object.type) ? THREE.DoubleSide : THREE.FrontSide}
    flatShading={object.smoothShading === false} wireframe={shading === 'wireframe'}
  />
}

const GLTFImportedModel = forwardRef(function GLTFImportedModel({ object }, ref) {
  const selectedId = useEditor((s) => s.selectedId)
  const setSelected = useEditor((s) => s.setSelected)
  const gltf = useGLTF(object.modelSource)
  const model = useMemo(() => { const cloned = cloneSkeleton(gltf.scene); cloned.traverse((child) => { if (child.isMesh && child.material) child.material = Array.isArray(child.material) ? child.material.map((material) => material.clone()) : child.material.clone() }); return applyMeshSmoothing(cloned, object) }, [gltf.scene, object.smoothShading, object.creaseAngle])
  const animationRoot = useRef()
  const { actions, names } = useAnimations(gltf.animations, animationRoot)
  const normalizedScale = useMemo(() => {
    model.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    return 1.8 / Math.max(size.x, size.y, size.z, 0.001)
  }, [model])
  useEffect(() => { model.traverse((child) => { if (child.isMesh) { child.castShadow = object.castShadow !== false; child.receiveShadow = object.receiveShadow !== false; const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.filter(Boolean).forEach((material) => { material.transparent = Boolean(object.transparent || (object.opacity ?? 1) < 1); material.opacity = object.opacity ?? 1; material.alphaTest = object.alphaTest ?? 0; material.depthWrite = object.depthWrite !== false; material.side = object.doubleSided ? THREE.DoubleSide : THREE.FrontSide; material.needsUpdate = true }) } }) }, [model, object.castShadow, object.receiveShadow, object.transparent, object.opacity, object.alphaTest, object.depthWrite, object.doubleSided])
  useEffect(() => { const action = names.length ? actions[names[0]] : null; action?.reset().fadeIn(0.2).play(); return () => action?.fadeOut(0.15) }, [actions, names])
  return <group ref={ref} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onClick={(e) => { e.stopPropagation(); setSelected(object.id) }}>
    <group ref={animationRoot} scale={normalizedScale}><Center><primitive object={model} /></Center></group>
    {selectedId === object.id && <pointLight intensity={0.01} />}
  </group>
})

const GenericImportedModel = forwardRef(function GenericImportedModel({ object }, ref) {
  const selectedId = useEditor((s) => s.selectedId)
  const setSelected = useEditor((s) => s.setSelected)
  const format = object.modelFormat || modelFormatFrom(object.name)
  const definition = MODEL_FORMATS[format]
  const loaded = useLoader(definition.loader, object.modelSource)
  const source = definition.geometry ? null : (format === 'dae' ? loaded.scene : loaded)
  const model = useMemo(() => {
    if (!source) return null
    const cloned = cloneSkeleton(source)
    cloned.traverse((child) => { if (child.isMesh && child.material) child.material = Array.isArray(child.material) ? child.material.map((material) => material.clone()) : child.material.clone() })
    return applyMeshSmoothing(cloned, object)
  }, [source, object.smoothShading, object.creaseAngle])
  const animationRoot = useRef()
  const clips = loaded.animations || source?.animations || []
  const { actions, names } = useAnimations(clips, animationRoot)
  const normalizedScale = useMemo(() => {
    const target = model || (definition.geometry ? new THREE.Mesh(loaded) : null)
    if (!target) return 1
    const size = new THREE.Box3().setFromObject(target).getSize(new THREE.Vector3())
    return 1.8 / Math.max(size.x, size.y, size.z, 0.001)
  }, [model, loaded, definition.geometry])
  useEffect(() => { const action = names.length ? actions[names[0]] : null; action?.reset().fadeIn(0.2).play(); return () => action?.fadeOut(0.15) }, [actions, names])
  useEffect(() => { model?.traverse((child) => { if (child.isMesh) { child.castShadow = object.castShadow !== false; child.receiveShadow = object.receiveShadow !== false } }) }, [model, object.castShadow, object.receiveShadow])
  return <group ref={ref} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onClick={(e) => { e.stopPropagation(); setSelected(object.id) }}>
    <group ref={animationRoot} scale={normalizedScale}><Center>{definition.geometry ? <mesh geometry={loaded} castShadow receiveShadow><meshStandardMaterial color={object.color || '#b8c1c7'} roughness={object.roughness ?? 0.6} metalness={object.metalness ?? 0.05} flatShading={object.smoothShading === false} /></mesh> : <primitive object={model} />}</Center></group>
    {selectedId === object.id && <pointLight intensity={0.01} />}
  </group>
})

const ImportedModel = forwardRef(function ImportedModel({ object }, ref) {
  const format = object.modelFormat || modelFormatFrom(object.name)
  return format === 'glb' || format === 'gltf' ? <GLTFImportedModel ref={ref} object={object} /> : <GenericImportedModel ref={ref} object={object} />
})

function CustomLight({ light }) {
  if (!light.enabled) return null
  if (light.type === 'ambient') return <ambientLight color={light.color} intensity={light.intensity} />
  if (light.type === 'directional') return <directionalLight color={light.color} intensity={light.intensity} position={light.position} castShadow={light.castShadow} shadow-mapSize={[1024, 1024]} />
  if (light.type === 'point') return <pointLight color={light.color} intensity={light.intensity} position={light.position} distance={light.distance} decay={light.decay} />
  if (light.type === 'spot') return <spotLight color={light.color} intensity={light.intensity} position={light.position} distance={light.distance} angle={THREE.MathUtils.degToRad(light.angle)} penumbra={light.penumbra} castShadow={light.castShadow} />
  if (light.type === 'hemisphere') return <hemisphereLight args={[light.skyColor, light.groundColor, light.intensity]} />
  return null
}

const SceneObject = forwardRef(function SceneObject({ object }, ref) {
  const selectedId = useEditor((s) => s.selectedId)
  const setSelected = useEditor((s) => s.setSelected)
  const shading = useEditor((s) => s.shading)
  const updateObject = useEditor((s) => s.updateObject)
  if (object.type === 'model') return <ImportedModel ref={ref} object={object} />
  if (object.type === 'flowPipe') return <FlowPipeObject ref={ref} object={object} selected={selectedId === object.id} shading={shading} onSelect={() => setSelected(object.id)} onUpdatePoints={(pipePoints) => updateObject(object.id, { pipePoints })} />
  return (
    <mesh
      ref={ref}
      name={object.name}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      visible={object.visible}
      castShadow={object.castShadow !== false} receiveShadow={object.receiveShadow !== false}
      onClick={(e) => { e.stopPropagation(); setSelected(object.id) }}
    >
      {geometryFor(object.type)}
      <ObjectMaterial object={object} shading={shading} />
      {selectedId === object.id && <Edges color="#fff7dd" threshold={15} scale={1.006} />}
    </mesh>
  )
})

function EditableObject({ object }) {
  const ref = useRef()
  const [target, setTarget] = useState(null)
  const bindMesh = useCallback((mesh) => { ref.current = mesh; setTarget(mesh); if (mesh) SCENE_OBJECT_REFS.set(object.id, mesh); else SCENE_OBJECT_REFS.delete(object.id) }, [object.id])
  const selectedId = useEditor((s) => s.selectedId)
  const mode = useEditor((s) => s.mode)
  const space = useEditor((s) => s.space)
  const updateObject = useEditor((s) => s.updateObject)
  const snap = useEditor((s) => s.snap)
  const snapSize = useEditor((s) => s.snapSize)
  const content = <SceneObject ref={bindMesh} object={object} />
  if (selectedId !== object.id || object.locked || (object.type === 'flowPipe' && object.pipeEditPoints)) return content
  return <>{content}{target && <TransformControls object={target} mode={mode} space={space} size={0.78} translationSnap={snap ? snapSize : null} rotationSnap={snap ? THREE.MathUtils.degToRad(15) : null} scaleSnap={snap ? 0.1 : null} onMouseUp={() => {
    const target = ref.current
    if (target) updateObject(object.id, { position: target.position.toArray(), rotation: [target.rotation.x, target.rotation.y, target.rotation.z], scale: target.scale.toArray() })
  }} />}</>
}

function SceneEnvironment({ backgroundMode, sunPosition, skyTurbidity, skyRayleigh, skyMieCoefficient, skyMieDirectionalG }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  const environmentIntensity = useEditor((state) => state.environmentIntensity)
  const environmentRotation = useEditor((state) => state.environmentRotation)
  const textureRef = useRef(null)
  const pmrem = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl)
    generator.compileCubemapShader()
    return generator
  }, [gl])
  useEffect(() => {
    if (backgroundMode !== 'color' && backgroundMode !== 'sky') { if (scene.environment === textureRef.current) scene.environment = null; textureRef.current?.dispose(); textureRef.current = null; invalidate(); return undefined }
    const timer = window.setTimeout(() => {
      let sourceScene
      let cleanupSource = () => {}
      if (backgroundMode === 'sky') {
        sourceScene = new THREE.Scene()
        const sky = new ThreeSky()
        sky.scale.setScalar(100)
        sky.material.uniforms.turbidity.value = skyTurbidity
        sky.material.uniforms.rayleigh.value = skyRayleigh
        sky.material.uniforms.mieCoefficient.value = skyMieCoefficient
        sky.material.uniforms.mieDirectionalG.value = skyMieDirectionalG
        sky.material.uniforms.sunPosition.value.copy(sunPosition)
        sourceScene.add(sky)
        cleanupSource = () => { sky.geometry.dispose(); sky.material.dispose() }
      } else {
        sourceScene = new RoomEnvironment()
        cleanupSource = () => sourceScene.dispose()
      }
      const nextTexture = pmrem.fromScene(sourceScene, 0.04).texture
      cleanupSource()
      const previousTexture = textureRef.current
      textureRef.current = nextTexture
      scene.environment = nextTexture
      previousTexture?.dispose()
      invalidate()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [backgroundMode, sunPosition, skyTurbidity, skyRayleigh, skyMieCoefficient, skyMieDirectionalG, pmrem, scene, invalidate])
  useEffect(() => {
    scene.environmentIntensity = environmentIntensity
    scene.environmentRotation.set(0, THREE.MathUtils.degToRad(environmentRotation), 0)
    scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(environmentRotation), 0)
    invalidate()
  }, [scene, environmentIntensity, environmentRotation, invalidate])
  useEffect(() => () => {
    if (scene.environment === textureRef.current) scene.environment = null
    textureRef.current?.dispose()
    pmrem.dispose()
  }, [scene, pmrem])
  return null
}

function WorldAxes({ size, position, opacity, depthTest }) {
  const helper = useMemo(() => new THREE.AxesHelper(size), [size])
  useEffect(() => { helper.material.transparent = opacity < 1; helper.material.opacity = opacity; helper.material.depthTest = depthTest; helper.material.needsUpdate = true }, [helper, opacity, depthTest])
  useEffect(() => () => { helper.geometry.dispose(); helper.material.dispose() }, [helper])
  return <primitive object={helper} position={position} />
}

function CustomSkybox({ mode, hdrSource, cubeSources, fallbackColor }) {
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (mode !== 'hdr' && mode !== 'cube') return undefined
    if ((mode === 'hdr' && !hdrSource) || (mode === 'cube' && cubeSources?.length !== 6)) { scene.background = new THREE.Color(fallbackColor); scene.environment = null; invalidate(); return () => { if (scene.background?.isColor) scene.background = null } }
    let active = true
    let texture
    const apply = (loaded) => {
      if (!active) { loaded.dispose(); return }
      texture = loaded
      if (mode === 'hdr') loaded.mapping = THREE.EquirectangularReflectionMapping
      scene.background = loaded
      scene.environment = loaded
      invalidate()
    }
    if (mode === 'hdr') new RGBELoader().load(hdrSource, apply)
    else new THREE.CubeTextureLoader().load(cubeSources, apply)
    return () => { active = false; if (scene.background === texture) scene.background = null; if (scene.environment === texture) scene.environment = null; texture?.dispose() }
  }, [mode, hdrSource, cubeSources, fallbackColor, scene, invalidate])
  return null
}

function Scene() {
  const objects = useEditor((s) => s.objects)
  const grid = useEditor((s) => s.grid)
  const shadows = useEditor((s) => s.shadows)
  const background = useEditor((s) => s.background)
  const backgroundMode = useEditor((s) => s.backgroundMode)
  const skyboxHdr = useEditor((s) => s.skyboxHdr)
  const skyboxCube = useEditor((s) => s.skyboxCube)
  const skyTurbidity = useEditor((s) => s.skyTurbidity)
  const skyRayleigh = useEditor((s) => s.skyRayleigh)
  const skyMieCoefficient = useEditor((s) => s.skyMieCoefficient)
  const skyMieDirectionalG = useEditor((s) => s.skyMieDirectionalG)
  const sunElevation = useEditor((s) => s.sunElevation)
  const sunAzimuth = useEditor((s) => s.sunAzimuth)
  const ambient = useEditor((s) => s.ambient)
  const keyLightColor = useEditor((s) => s.keyLightColor)
  const keyLightIntensity = useEditor((s) => s.keyLightIntensity)
  const keyLightPosition = useEditor((s) => s.keyLightPosition)
  const fillLightColor = useEditor((s) => s.fillLightColor)
  const fillLightIntensity = useEditor((s) => s.fillLightIntensity)
  const fillLightPosition = useEditor((s) => s.fillLightPosition)
  const fillLightDistance = useEditor((s) => s.fillLightDistance)
  const rimLightEnabled = useEditor((s) => s.rimLightEnabled)
  const rimLightColor = useEditor((s) => s.rimLightColor)
  const rimLightIntensity = useEditor((s) => s.rimLightIntensity)
  const rimLightPosition = useEditor((s) => s.rimLightPosition)
  const rimLightAngle = useEditor((s) => s.rimLightAngle)
  const hemisphereEnabled = useEditor((s) => s.hemisphereEnabled)
  const hemisphereSkyColor = useEditor((s) => s.hemisphereSkyColor)
  const hemisphereGroundColor = useEditor((s) => s.hemisphereGroundColor)
  const hemisphereIntensity = useEditor((s) => s.hemisphereIntensity)
  const customLights = useEditor((s) => s.customLights)
  const fogEnabled = useEditor((s) => s.fogEnabled)
  const fogColor = useEditor((s) => s.fogColor)
  const fogNear = useEditor((s) => s.fogNear)
  const fogFar = useEditor((s) => s.fogFar)
  const gridColor = useEditor((s) => s.gridColor)
  const gridSectionColor = useEditor((s) => s.gridSectionColor)
  const gridSize = useEditor((s) => s.gridSize)
  const worldAxesEnabled = useEditor((s) => s.worldAxesEnabled)
  const worldAxesSize = useEditor((s) => s.worldAxesSize)
  const worldAxesPosition = useEditor((s) => s.worldAxesPosition)
  const worldAxesOpacity = useEditor((s) => s.worldAxesOpacity)
  const worldAxesDepthTest = useEditor((s) => s.worldAxesDepthTest)
  const sceneSize = useEditor((s) => s.sceneSize)
  const cameraFov = useEditor((s) => s.cameraFov)
  const cameraNear = useEditor((s) => s.cameraNear)
  const cameraFar = useEditor((s) => s.cameraFar)
  const shadowOpacity = useEditor((s) => s.shadowOpacity)
  const shadowBlur = useEditor((s) => s.shadowBlur)
  const projection = useEditor((s) => s.projection)
  const setSelected = useEditor((s) => s.setSelected)
  const contactShadowKey = objects.map((object) => `${object.id}:${object.visible}:${object.position.join(',')}:${object.rotation.join(',')}:${object.scale.join(',')}`).join('|')
  const sunPosition = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - sunElevation)
    const theta = THREE.MathUtils.degToRad(sunAzimuth)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [sunElevation, sunAzimuth])
  const keyLightDirection = useMemo(() => backgroundMode === 'sky' ? sunPosition.clone().multiplyScalar(10) : keyLightPosition, [backgroundMode, sunPosition, keyLightPosition])
  return (
    <>
      {backgroundMode === 'color' ? <color attach="background" args={[background]} /> : backgroundMode === 'sky' ? <Sky distance={450000} sunPosition={sunPosition} turbidity={skyTurbidity} rayleigh={skyRayleigh} mieCoefficient={skyMieCoefficient} mieDirectionalG={skyMieDirectionalG} /> : null}
      <SceneEnvironment backgroundMode={backgroundMode} sunPosition={sunPosition} skyTurbidity={skyTurbidity} skyRayleigh={skyRayleigh} skyMieCoefficient={skyMieCoefficient} skyMieDirectionalG={skyMieDirectionalG} />
      <CustomSkybox mode={backgroundMode} hdrSource={skyboxHdr} cubeSources={skyboxCube} fallbackColor={background} />
      {fogEnabled && <fog attach="fog" args={[fogColor, fogNear, fogFar]} />}
      <ambientLight intensity={ambient} />
      <directionalLight position={keyLightDirection} color={keyLightColor} intensity={keyLightIntensity} castShadow={shadows} shadow-mapSize={[2048, 2048]} />
      <pointLight position={fillLightPosition} intensity={fillLightIntensity} color={fillLightColor} distance={fillLightDistance} />
      {rimLightEnabled && <spotLight position={rimLightPosition} color={rimLightColor} intensity={rimLightIntensity} angle={THREE.MathUtils.degToRad(rimLightAngle)} penumbra={0.7} distance={20} />}
      {hemisphereEnabled && <hemisphereLight args={[hemisphereSkyColor, hemisphereGroundColor, hemisphereIntensity]} />}
      {customLights.map((light) => <CustomLight key={light.id} light={light} />)}
      <group onPointerMissed={() => setSelected(null)}>
        {objects.map((object) => <Suspense key={object.id} fallback={<mesh position={object.position}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshBasicMaterial color="#687076" wireframe /></mesh>}><EditableObject object={object} /></Suspense>)}
      </group>
      {grid && <Grid position={[0, 0, 0]} args={[sceneSize, sceneSize]} cellSize={gridSize} cellThickness={0.55} cellColor={gridColor} sectionSize={gridSize * 5} sectionThickness={1} sectionColor={gridSectionColor} fadeDistance={Math.max(8, sceneSize * 0.6)} infiniteGrid />}
      {worldAxesEnabled && <WorldAxes size={worldAxesSize} position={worldAxesPosition} opacity={worldAxesOpacity} depthTest={worldAxesDepthTest} />}
      <ContactShadows key={contactShadowKey} frames={1} position={[0, 0.01, 0]} opacity={shadows ? shadowOpacity : 0} scale={Math.min(sceneSize, 30) * 0.5} blur={shadowBlur} far={Math.max(6, sceneSize * 0.2)} />
      {projection === 'perspective' ? <PerspectiveCamera makeDefault position={[6.5, 4.8, 7.5]} fov={cameraFov} near={cameraNear} far={cameraFar} /> : <OrthographicCamera makeDefault position={[6.5, 4.8, 7.5]} zoom={72} near={cameraNear} far={cameraFar} />}
      <OrbitControls makeDefault target={[0, 0.7, 0]} minDistance={Math.max(cameraNear * 2, 0.2)} maxDistance={Math.min(cameraFar * 0.8, Math.max(22, sceneSize * 1.5))} />
      <GizmoHelper alignment="bottom-right" margin={[76, 58]}><GizmoViewport axisColors={['#e35d35', '#6cac68', '#5c85c7']} labelColor="white" /></GizmoHelper>
    </>
  )
}

function PostProcessing() {
  const settings = useEditor(useShallow((s) => ({
    enabled: s.postProcessingEnabled, quality: s.postProcessingQuality,
    selectedId: s.selectedId, outlineEnabled: s.outlineEnabled, outlineEdgeStrength: s.outlineEdgeStrength, outlinePulseSpeed: s.outlinePulseSpeed, outlineVisibleEdgeColor: s.outlineVisibleEdgeColor, outlineHiddenEdgeColor: s.outlineHiddenEdgeColor, outlineBlur: s.outlineBlur, outlineXRay: s.outlineXRay,
    colorAdjustEnabled: s.colorAdjustEnabled, brightness: s.brightness, contrast: s.contrast, hue: s.hue, saturation: s.saturation,
    bloomEnabled: s.bloomEnabled, bloomIntensity: s.bloomIntensity, bloomThreshold: s.bloomThreshold, bloomSmoothing: s.bloomSmoothing,
    depthOfFieldEnabled: s.depthOfFieldEnabled, focusDistance: s.depthOfFieldFocusDistance, focalLength: s.depthOfFieldFocalLength, bokehScale: s.depthOfFieldBokehScale,
    vignetteEnabled: s.vignetteEnabled, vignetteOffset: s.vignetteOffset, vignetteDarkness: s.vignetteDarkness,
    chromaticAberrationEnabled: s.chromaticAberrationEnabled, chromaticAberrationOffset: s.chromaticAberrationOffset,
    noiseEnabled: s.noiseEnabled, noiseOpacity: s.noiseOpacity,
  })))
  const chromaticOffset = useMemo(() => new THREE.Vector2(settings.chromaticAberrationOffset, settings.chromaticAberrationOffset), [settings.chromaticAberrationOffset])
  const outlineSelection = settings.selectedId && SCENE_OBJECT_REFS.get(settings.selectedId) ? [SCENE_OBJECT_REFS.get(settings.selectedId)] : []
  if (!settings.enabled) return null
  const multisampling = settings.quality === 'high' ? 8 : settings.quality === 'balanced' ? 4 : 0
  return <EffectComposer multisampling={multisampling} enableNormalPass={settings.depthOfFieldEnabled}>
    {settings.outlineEnabled && outlineSelection.length > 0 && <Outline selection={outlineSelection} edgeStrength={settings.outlineEdgeStrength} pulseSpeed={settings.outlinePulseSpeed} visibleEdgeColor={settings.outlineVisibleEdgeColor} hiddenEdgeColor={settings.outlineHiddenEdgeColor} blur={settings.outlineBlur} xRay={settings.outlineXRay} />}
    {settings.colorAdjustEnabled && <BrightnessContrast brightness={settings.brightness} contrast={settings.contrast} />}
    {settings.colorAdjustEnabled && <HueSaturation hue={settings.hue} saturation={settings.saturation} />}
    {settings.bloomEnabled && <Bloom intensity={settings.bloomIntensity} luminanceThreshold={settings.bloomThreshold} luminanceSmoothing={settings.bloomSmoothing} mipmapBlur kernelSize={KernelSize.LARGE} />}
    {settings.depthOfFieldEnabled && <DepthOfField focusDistance={settings.focusDistance} focalLength={settings.focalLength} bokehScale={settings.bokehScale} />}
    {settings.chromaticAberrationEnabled && <ChromaticAberration offset={chromaticOffset} radialModulation modulationOffset={0.5} />}
    {settings.noiseEnabled && <Noise opacity={settings.noiseOpacity} blendFunction={BlendFunction.SOFT_LIGHT} />}
    {settings.vignetteEnabled && <Vignette eskil={false} offset={settings.vignetteOffset} darkness={settings.vignetteDarkness} />}
  </EffectComposer>
}

function IconButton({ icon: Icon, label, active, disabled, onClick }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} disabled={disabled} onClick={onClick}><Icon size={16} strokeWidth={1.8} /></button>
}

function Toolbar() {
  const { mode, setMode, space, setSpace, snap, toggleSnap, snapSize, setSnapSize, history, future, undo, redo, duplicateSelected, deleteSelected, selectedId } = useEditor()
  return (
    <div className="toolbar">
      <div className="tool-group"><IconButton icon={MousePointer2} label="选择" active={mode === 'select'} onClick={() => setMode('translate')} /></div>
      <div className="tool-group">
        <IconButton icon={Move3D} label="移动 (W)" active={mode === 'translate'} onClick={() => setMode('translate')} />
        <IconButton icon={Rotate3D} label="旋转 (E)" active={mode === 'rotate'} onClick={() => setMode('rotate')} />
        <IconButton icon={Scaling} label="缩放 (R)" active={mode === 'scale'} onClick={() => setMode('scale')} />
      </div>
      <button className="space-switch" onClick={() => setSpace(space === 'world' ? 'local' : 'world')}>{space === 'world' ? '世界' : '局部'} <ChevronDown size={13} /></button>
      <div className="snap-control"><IconButton icon={Magnet} label="吸附" active={snap} onClick={toggleSnap} />{snap && <select value={snapSize} onChange={(e) => setSnapSize(Number(e.target.value))}><option value="0.1">0.1</option><option value="0.25">0.25</option><option value="0.5">0.5</option><option value="1">1.0</option></select>}</div>
      <div className="tool-spacer" />
      <div className="tool-group">
        <IconButton icon={Undo2} label="撤销" disabled={!history.length} onClick={undo} />
        <IconButton icon={Redo2} label="重做" disabled={!future.length} onClick={redo} />
      </div>
      <div className="tool-group">
        <IconButton icon={Copy} label="复制对象" disabled={!selectedId} onClick={duplicateSelected} />
        <IconButton icon={Trash2} label="删除对象" disabled={!selectedId} onClick={deleteSelected} />
      </div>
    </div>
  )
}

function AddMenu({ close }) {
  const addObject = useEditor((s) => s.addObject)
  const addModel = useEditor((s) => s.addModel)
  const groups = [
    ['基本体', [['box', Box, '立方体'], ['sphere', Circle, '球体'], ['cylinder', Shapes, '圆柱体'], ['cone', Lightbulb, '圆锥体'], ['plane', BoxSelect, '平面'], ['capsule', Shapes, '胶囊']]],
    ['曲面与管道', [['torus', Circle, '圆环'], ['ring', Circle, '圆环面'], ['pipe', Shapes, '基础管道'], ['flowPipe', Shapes, '流动管道'], ['torusKnot', Circle, '环面结']]],
    ['多面体', [['tetrahedron', Shapes, '四面体'], ['octahedron', Shapes, '八面体'], ['dodecahedron', Shapes, '十二面体'], ['icosahedron', Shapes, '二十面体']]],
    ['参数化', [['lathe', Shapes, '车削体']]],
  ]
  return <div className="add-menu">{groups.map(([group, items]) => <React.Fragment key={group}><div className="add-menu-label">{group}</div>{items.map(([type, Icon, label]) => <button key={type} onClick={() => { addObject(type); close() }}><Icon size={15} />{label}</button>)}</React.Fragment>)}<i /><div className="add-menu-label">外部模型</div><button className="model-import-action" onClick={() => { window.dispatchEvent(new Event('frame-import-model')); close() }}><Upload size={15} /><span><strong>按格式导入</strong><small>选择 Loader 与模型文件</small></span></button><div className="model-format-list"><b>GLB</b><span>glTF</span><span>FBX</span><span>OBJ</span><span>STL</span><span>PLY</span><span>DAE</span><span>3MF</span></div><button onClick={() => { addModel(MODEL_ASSETS[3]); close() }}><BoxSelect size={15} />加载示例模型</button></div>
}

function Header({ notify, showHelp, showExport }) {
  const [open, setOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [modelImportOpen, setModelImportOpen] = useState(false)
  const fileRef = useRef()
  const modelRef = useRef()
  const { objects, loadScene, resetScene, addModel } = useEditor()
  const exportScene = () => {
    const blob = new Blob([JSON.stringify({ version: 3, objects, settings: readSceneSettings(), interaction: { roaming: readRoamingSettings() } }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'frame-scene.json'; a.click(); URL.revokeObjectURL(url); notify('场景 JSON 已导出')
  }
  const importScene = async (file) => { try { const data = JSON.parse(await file.text()); if (!loadScene(data)) { notify('文件中没有有效场景'); return }; if (data.interaction?.roaming) useRoaming.getState().setSetting(data.interaction.roaming); notify('场景导入成功') } catch { notify('无法读取这个 JSON 文件') } }
  const importModel = (file, requestedFormat) => {
    const format = modelFormatFrom(file.name)
    if (!MODEL_FORMATS[format]) { notify(`不支持 .${format}，请使用 GLB、glTF、FBX、OBJ、STL、PLY、DAE 或 3MF`); return }
    if (requestedFormat && requestedFormat !== format) { notify(`已选择 ${MODEL_FORMATS[requestedFormat].label} Loader，请选择 .${requestedFormat} 文件`); return }
    if (file.size > 80 * 1024 * 1024) { notify('模型文件不能超过 80 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { addModel({ name: file.name.replace(/\.[^.]+$/i, ''), source: reader.result, format }); notify(`${MODEL_FORMATS[format].label} 模型导入成功`) }
    reader.onerror = () => notify('模型文件读取失败')
    reader.readAsDataURL(file)
  }
  const chooseModelFormat = (format) => {
    if (!modelRef.current) return
    modelRef.current.accept = `.${format}`
    modelRef.current.dataset.format = format
    setModelImportOpen(false)
    modelRef.current.click()
  }
  useEffect(() => { const openImporter = () => setModelImportOpen(true); window.addEventListener('frame-import-model', openImporter); return () => window.removeEventListener('frame-import-model', openImporter) }, [])
  const capture = () => { const canvas = document.querySelector('.viewport canvas'); if (!canvas) return; const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'frame-viewport.png'; a.click(); notify('视口截图已保存') }
  return <header className="header">
    <div className="brand-mark"><span>F</span></div><div className="brand"><strong>FRAME</strong><small>THREE EDITOR</small></div>
    <div className="main-menu">
      <div className="menu-wrap"><button onClick={() => setFileOpen(!fileOpen)}>文件</button>{fileOpen && <div className="file-menu">
        <button onClick={() => fileRef.current?.click()}><Upload size={14} />导入场景 <kbd>JSON</kbd></button>
        <button onClick={() => { setModelImportOpen(true); setFileOpen(false) }}><BoxSelect size={14} />导入模型 <kbd>选择格式</kbd></button>
        <button onClick={exportScene}><FileJson size={14} />导出场景 JSON <kbd>JSON</kbd></button>
        <button onClick={capture}><ImageDown size={14} />视口截图 <kbd>PNG</kbd></button>
        <i />
        <button className="danger" onClick={() => { resetScene(); setFileOpen(false); notify('已恢复示例场景') }}><Trash2 size={14} />重置场景</button>
      </div>}</div>
    </div>
    <input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={(e) => e.target.files[0] && importScene(e.target.files[0])} />
    <input ref={modelRef} data-model-import className="file-input" type="file" onChange={(e) => { if (e.target.files[0]) importModel(e.target.files[0], e.target.dataset.format); e.target.value = '' }} />
    {modelImportOpen && <div className="model-import-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModelImportOpen(false) }}><div className="model-import-dialog" role="dialog" aria-modal="true" aria-label="选择模型格式"><div className="model-import-head"><div><strong>导入模型</strong><small>选择格式后使用对应的 Three.js Loader</small></div><button title="关闭" onClick={() => setModelImportOpen(false)}><X size={16} /></button></div><div className="model-import-grid">{Object.entries(MODEL_FORMATS).map(([format, definition]) => <button key={format} className={definition.recommended ? 'recommended' : ''} onClick={() => chooseModelFormat(format)}><span className="model-format-icon">{definition.label.slice(0, 3).toUpperCase()}</span><span><strong>{definition.label}{definition.recommended && <em>推荐</em>}</strong><small>{definition.description}</small><code>.{format}</code></span><ChevronDown size={14} /></button>)}</div><div className="model-import-note"><Check size={14} /><span>GLB 可完整封装贴图与动画；其他格式若引用外部资源，需要确保文件内已嵌入。</span></div></div></div>}
    <div className="project-title"><span className="status-dot" /> 未命名场景 <span className="save-state">已保存</span></div>
    <div className="header-actions">
      <div className="add-wrap"><button className="add-button" onClick={() => setOpen(!open)}><Plus size={15} /> 添加对象 <ChevronDown size={13} /></button>{open && <AddMenu close={() => setOpen(false)} />}</div>
      <button className="export-button" onClick={showExport}><Download size={15} /> 导出项目</button>
      <IconButton icon={HelpCircle} label="快捷键帮助" onClick={showHelp} />
    </div>
  </header>
}

function SceneTree({ onCollapse }) {
  const [query, setQuery] = useState('')
  const [assetTab, setAssetTab] = useState('全部')
  const { objects, selectedId, setSelected, updateObject, addObject, addModel } = useEditor()
  const filtered = objects.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
  return <aside className="left-panel panel">
    <div className="panel-heading"><span>场景</span><div className="panel-heading-actions"><IconButton icon={Plus} label="添加立方体" onClick={() => addObject('box')} /><IconButton icon={PanelLeftClose} label="收起左侧栏" onClick={onCollapse} /></div></div>
    <div className="tree-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对象" />{query && <X size={12} onClick={() => setQuery('')} />}</div>
    <div className="tree-root"><ChevronDown size={13} /><BoxSelect size={14} /><span>场景集合</span><small>{objects.length}</small></div>
    <div className="tree-list">{filtered.map((o) => <button key={o.id} className={`tree-item ${selectedId === o.id ? 'selected' : ''}`} onClick={() => setSelected(o.id)}>
      <span className="tree-indent" />{o.type === 'sphere' || o.type === 'torus' ? <Circle size={13} /> : <Box size={13} />}<span>{o.name}</span>
      <span className="tree-actions"><i onClick={(e) => { e.stopPropagation(); updateObject(o.id, { locked: !o.locked }) }}>{o.locked ? <Lock size={12} /> : <Unlock size={12} />}</i><i onClick={(e) => { e.stopPropagation(); updateObject(o.id, { visible: !o.visible }) }}>{o.visible ? <Eye size={13} /> : <EyeOff size={13} />}</i></span>
    </button>)}</div>
    <div className="assets-heading"><span>资源</span><span>{assetTab}</span></div>
    <div className="asset-tabs">{['全部','模型','材质'].map((tab) => <button key={tab} className={assetTab === tab ? 'active' : ''} onClick={() => setAssetTab(tab)}>{tab}</button>)}</div>
    {assetTab !== '材质' ? <div className="asset-library">{MODEL_ASSETS.map((asset, index) => <button key={asset.source} className="asset-item" onClick={() => addModel(asset)} title={`添加 ${asset.name}`}><span className={`asset-glyph asset-glyph-${index}`}><BoxSelect size={15} /></span><span><strong>{asset.name}</strong><small>{asset.category}{asset.animated ? ' · 自动播放' : ''}</small></span><Plus size={12} /></button>)}</div> : <div className="asset-empty"><Shapes size={22} /><span>暂无材质资源</span><small>可在检查器中导入图片贴图</small></div>}
  </aside>
}

function VectorInput({ label, value, onChange }) {
  const axes = ['X', 'Y', 'Z']
  return <div className="property-row vector-row"><label>{label}</label><div className="vector-inputs">{axes.map((axis, i) => <div key={axis}><span className={`axis axis-${axis.toLowerCase()}`}>{axis}</span><input type="number" step="0.1" value={Number(value[i]).toFixed(2)} onChange={(e) => { const next = [...value]; next[i] = Number(e.target.value); onChange(next) }} /></div>)}</div></div>
}

function CollapsibleSection({ children, className = '', defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const nodes = React.Children.toArray(children)
  const header = nodes[0]
  useEffect(() => {
    const setAll = (event) => setOpen(Boolean(event.detail))
    window.addEventListener('frame-inspector-sections', setAll)
    return () => window.removeEventListener('frame-inspector-sections', setAll)
  }, [])
  const toggle = (event) => {
    if (event.target.closest('button, input, select, a')) return
    setOpen((value) => !value)
  }
  const handleKey = (event) => {
    if (event.target.closest('button, input, select, a')) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((value) => !value) }
  }
  const sectionHeader = React.isValidElement(header) ? React.cloneElement(header, {
    role: 'button', tabIndex: 0, 'aria-expanded': open, onClick: toggle, onKeyDown: handleKey,
  }) : header
  return <section className={`collapsible-section ${open ? 'expanded' : 'collapsed'} ${className}`}>{sectionHeader}{open && nodes.slice(1)}</section>
}

function Inspector({ onCollapse }) {
  const [tab, setTab] = useState(() => { const panel = new URLSearchParams(window.location.search).get('panel'); return ['scene', 'post', 'interaction'].includes(panel) ? panel : 'object' })
  const [sectionsExpanded, setSectionsExpanded] = useState(true)
  const { objects, selectedId, updateObject } = useEditor()
  const object = objects.find((o) => o.id === selectedId)
  const toggleSections = () => {
    const next = !sectionsExpanded
    setSectionsExpanded(next)
    window.dispatchEvent(new CustomEvent('frame-inspector-sections', { detail: next }))
  }
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('frame-inspector-sections', { detail: sectionsExpanded }))
  }, [tab])
  return <aside className="right-panel panel">
    <div className="panel-heading"><span>检查器</span><div className="panel-heading-actions"><IconButton icon={sectionsExpanded ? ChevronsUp : ChevronsDown} label={sectionsExpanded ? '全部收起' : '全部展开'} onClick={toggleSections} /><IconButton icon={PanelRightClose} label="收起右侧栏" onClick={onCollapse} /></div></div>
    <div className="inspector-tabs"><button className={tab === 'object' ? 'active' : ''} onClick={() => setTab('object')}>对象</button><button className={tab === 'scene' ? 'active' : ''} onClick={() => setTab('scene')}>场景</button><button className={tab === 'post' ? 'active' : ''} onClick={() => setTab('post')}>后期</button><button className={tab === 'interaction' ? 'active' : ''} onClick={() => setTab('interaction')}>交互</button></div>
    {tab === 'scene' ? <SceneInspector /> : tab === 'post' ? <PostProcessingPanel /> : tab === 'interaction' ? <RoamingPanel /> : !object ? <div className="no-selection"><MousePointer2 size={24} /><span>选择一个对象</span></div> : <>
    <div className="object-title"><div className="object-icon"><Box size={16} /></div><div><input value={object.name} onChange={(e) => updateObject(object.id, { name: e.target.value }, false)} /><small>{object.type.toUpperCase()} / {object.id.slice(-6)}</small></div></div>
    <CollapsibleSection><h3><ChevronDown size={13} /> 变换</h3>
      <VectorInput label="位置" value={object.position} onChange={(position) => updateObject(object.id, { position })} />
      <VectorInput label="旋转" value={object.rotation} onChange={(rotation) => updateObject(object.id, { rotation })} />
      <VectorInput label="缩放" value={object.scale} onChange={(scale) => updateObject(object.id, { scale })} />
    </CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 几何体</h3><div className="property-row"><label>类型</label><div className="readout">{object.type}</div></div></CollapsibleSection>
    {object.type === 'flowPipe' && <FlowPipeInspector object={object} updateObject={updateObject} />}
    {object.type !== 'model' ? <CollapsibleSection><h3><ChevronDown size={13} /> 材质</h3>
      <div className="property-row"><label>颜色</label><div className="color-control"><input type="color" value={object.color} onChange={(e) => updateObject(object.id, { color: e.target.value })} /><input value={object.color.toUpperCase()} readOnly /></div></div>
      <Slider label="粗糙度" value={object.roughness} onChange={(roughness) => updateObject(object.id, { roughness })} />
      <Slider label="金属度" value={object.metalness} onChange={(metalness) => updateObject(object.id, { metalness })} />
      <RangeSetting label="环境反射" value={object.envMapIntensity ?? 1} min={0} max={3} step={0.05} onChange={(envMapIntensity) => updateObject(object.id, { envMapIntensity })} />
      <MaterialTransparencyControls object={object} updateObject={updateObject} />
      <TextureControl object={object} updateObject={updateObject} />
    </CollapsibleSection> : <CollapsibleSection><h3><ChevronDown size={13} /> 导入模型 <span className="format-badge">{(object.modelFormat || 'glb').toUpperCase()}</span></h3><div className="model-source"><BoxSelect size={16} /><div><strong>{object.name}</strong><small>{object.animated ? '包含动画 · 自动播放第一段' : '静态模型 · 使用原始材质'}</small>{object.attribution && <small>{object.attribution}</small>}</div></div><MaterialTransparencyControls object={object} updateObject={updateObject} /></CollapsibleSection>}
    <SmoothingControls object={object} updateObject={updateObject} />
    <CollapsibleSection><h3><ChevronDown size={13} /> 显示</h3><ToggleRow label="投射阴影" value={object.castShadow !== false} onChange={(castShadow) => updateObject(object.id, { castShadow })} /><ToggleRow label="接收阴影" value={object.receiveShadow !== false} onChange={(receiveShadow) => updateObject(object.id, { receiveShadow })} /></CollapsibleSection>
    </>}
  </aside>
}

function MaterialTransparencyControls({ object, updateObject }) {
  const patch = (values) => updateObject(object.id, values)
  return <div className="material-transparency"><div className="texture-section-head"><span>透明与表面</span><span className="material-hint">Alpha / Depth</span></div><ToggleRow label="启用透明" value={Boolean(object.transparent)} onChange={(transparent) => patch({ transparent })} /><RangeSetting label="不透明度" value={object.opacity ?? 1} min={0} max={1} step={0.01} onChange={(opacity) => patch({ opacity, transparent: opacity < 1 ? true : object.transparent })} /><RangeSetting label="Alpha 裁切" value={object.alphaTest ?? 0} min={0} max={1} step={0.01} onChange={(alphaTest) => patch({ alphaTest })} /><ToggleRow label="深度写入" value={object.depthWrite !== false} onChange={(depthWrite) => patch({ depthWrite })} /><ToggleRow label="双面渲染" value={Boolean(object.doubleSided)} onChange={(doubleSided) => patch({ doubleSided })} /></div>
}

function SmoothingControls({ object, updateObject }) {
  const smooth = object.smoothShading ?? object.pipeSmooth ?? true
  const creaseAngle = object.creaseAngle ?? object.pipeCreaseAngle ?? 60
  const patch = (values) => updateObject(object.id, { ...values, ...(object.type === 'flowPipe' ? { pipeSmooth: values.smoothShading ?? object.pipeSmooth, pipeCreaseAngle: values.creaseAngle ?? object.pipeCreaseAngle } : {}) })
  return <CollapsibleSection className="smoothing-section"><h3><ChevronDown size={13} /> 法线与光滑</h3><ToggleRow label="smoothShading · 光滑组" value={smooth} onChange={(smoothShading) => patch({ smoothShading })} />{smooth && <RangeSetting label="creaseAngle · 平滑夹角" value={creaseAngle} min={0} max={180} step={1} digits={0} suffix="°" hardMax onChange={(creaseAngle) => patch({ creaseAngle })} />}</CollapsibleSection>
}

function Slider({ label, value, onChange }) { return <RangeSetting label={label} value={value} min={0} max={1} step={0.01} hardMax onChange={onChange} /> }

const TEXTURE_CHANNELS = [
  { id: 'baseColor', label: '基础色', hint: 'sRGB' },
  { id: 'normal', label: '法线', hint: 'Linear' },
  { id: 'roughness', label: '粗糙度', hint: 'G 通道' },
  { id: 'metalness', label: '金属度', hint: 'B 通道' },
  { id: 'ao', label: '环境遮蔽', hint: 'R 通道' },
  { id: 'emissive', label: '发光', hint: 'sRGB' },
  { id: 'alpha', label: '透明度', hint: '灰度' },
  { id: 'displacement', label: '位移', hint: '灰度' },
]

function TextureControl({ object, updateObject }) {
  const inputRef = useRef()
  const [pendingChannel, setPendingChannel] = useState('baseColor')
  const [advanced, setAdvanced] = useState(false)
  const [error, setError] = useState('')
  const textures = object.textures || {}
  const getTexture = (channel) => channel === 'baseColor' && object.map ? { data: object.map, name: object.mapName || '基础色贴图' } : textures[channel]
  const choose = (channel) => { setPendingChannel(channel); setError(''); inputRef.current?.click() }
  const upload = (channel, file) => {
    if (!file.type.startsWith('image/')) { setError('请选择 PNG、JPG、WEBP 或 AVIF 图片'); return }
    if (file.size > 3 * 1024 * 1024) { setError('单张贴图不能超过 3 MB'); return }
    const bitmap = typeof createImageBitmap === 'function' ? createImageBitmap(file).catch(() => null) : Promise.resolve(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const decodedImage = await bitmap
      if (decodedImage) MATERIAL_IMAGE_CACHE.set(reader.result, decodedImage)
      const next = { ...textures, [channel]: { data: reader.result, name: file.name } }
      updateObject(object.id, { textures: next, ...(channel === 'baseColor' ? { map: null, mapName: null, color: '#ffffff' } : {}) })
      setError('')
    }
    reader.onerror = () => setError('贴图读取失败')
    reader.readAsDataURL(file)
  }
  const remove = (channel) => {
    const next = { ...textures }; delete next[channel]
    updateObject(object.id, { textures: next, ...(channel === 'baseColor' ? { map: null, mapName: null } : {}) })
  }
  const hasTextures = TEXTURE_CHANNELS.some((channel) => getTexture(channel.id))
  const visibleChannels = advanced ? TEXTURE_CHANNELS : TEXTURE_CHANNELS.slice(0, 4)
  return <div className="texture-editor pbr-textures">
    <div className="texture-section-head"><span>PBR 贴图</span><button onClick={() => setAdvanced(!advanced)}>{advanced ? '收起高级' : '全部通道'}</button></div>
    <div className="texture-channels">{visibleChannels.map((channel) => {
      const texture = getTexture(channel.id)
      return <div className={`texture-channel ${texture ? 'loaded' : ''}`} key={channel.id}>
        <button className="texture-channel-main" onClick={() => choose(channel.id)}>{texture ? <img src={texture.data} alt={`${channel.label}预览`} /> : <span className="texture-placeholder"><ImagePlus size={14} /></span>}<span className="texture-channel-copy"><strong>{channel.label}</strong><small>{texture?.name || channel.hint}</small></span></button>
        {texture && <button className="texture-channel-remove" title={`移除${channel.label}`} onClick={() => remove(channel.id)}><X size={11} /></button>}
      </div>
    })}</div>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => { const file = e.target.files[0]; if (file) upload(pendingChannel, file); e.target.value = '' }} />
    {error && <div className="texture-error">{error}</div>}
    {hasTextures && <div className="pbr-settings">
      <h4>UV 变换</h4>
      <TexturePair label="重复 X / Y" value={object.textureRepeat || [object.mapRepeat ?? 1, object.mapRepeat ?? 1]} min={0.01} step={0.1} onChange={(textureRepeat) => updateObject(object.id, { textureRepeat })} />
      <TexturePair label="偏移 X / Y" value={object.textureOffset || [0, 0]} step={0.05} onChange={(textureOffset) => updateObject(object.id, { textureOffset })} />
      <div className="texture-option-row"><label>旋转</label><input type="number" step="1" value={object.textureRotation ?? object.mapRotation ?? 0} onChange={(e) => updateObject(object.id, { textureRotation: Number(e.target.value) })} /><span>°</span></div>
      <div className="texture-option-row"><label>包裹</label><select value={object.textureWrap || 'repeat'} onChange={(e) => updateObject(object.id, { textureWrap: e.target.value })}><option value="repeat">重复</option><option value="clamp">边缘拉伸</option><option value="mirror">镜像重复</option></select></div>
      <ToggleRow label="垂直翻转" value={object.textureFlipY ?? true} onChange={(textureFlipY) => updateObject(object.id, { textureFlipY })} />
      <h4>通道参数</h4>
      {getTexture('normal') && <RangeSetting label="法线强度" value={object.normalScale ?? 1} min={-2} max={2} step={0.05} onChange={(normalScale) => updateObject(object.id, { normalScale })} />}
      {getTexture('ao') && <RangeSetting label="AO 强度" value={object.aoIntensity ?? 1} min={0} max={3} step={0.05} onChange={(aoIntensity) => updateObject(object.id, { aoIntensity })} />}
      {getTexture('emissive') && <><ColorSetting label="发光颜色" value={object.emissiveColor || '#ffffff'} onChange={(emissiveColor) => updateObject(object.id, { emissiveColor })} /><RangeSetting label="发光强度" value={object.emissiveIntensity ?? 1} min={0} max={8} step={0.1} onChange={(emissiveIntensity) => updateObject(object.id, { emissiveIntensity })} /></>}
      {getTexture('alpha') && <RangeSetting label="透明裁切" value={object.alphaTest ?? 0} min={0} max={1} step={0.01} onChange={(alphaTest) => updateObject(object.id, { alphaTest })} />}
      {getTexture('displacement') && <RangeSetting label="位移强度" value={object.displacementScale ?? 0.1} min={-1} max={1} step={0.01} onChange={(displacementScale) => updateObject(object.id, { displacementScale })} />}
    </div>}
  </div>
}

function TexturePair({ label, value, min, step, onChange }) { return <div className="texture-pair"><label>{label}</label><div>{value.map((number, index) => <input key={index} type="number" min={min} step={step} value={number} onChange={(e) => { const next = [...value]; next[index] = Number(e.target.value); onChange(next) }} />)}</div></div> }

function ToggleRow({ label, value, onChange }) { return <div className="toggle-row"><span>{label}</span><button className={value ? 'on' : ''} onClick={() => onChange(!value)}><i /></button></div> }

const readFileDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })

function SkyboxUpload({ mode, settings }) {
  const hdrRef = useRef()
  const cubeRef = useRef()
  const [error, setError] = useState('')
  const uploadHdr = async (file) => {
    if (!file?.name.toLowerCase().endsWith('.hdr')) { setError('请选择 Radiance .hdr 文件'); return }
    if (file.size > 40 * 1024 * 1024) { setError('HDR 文件不能超过 40 MB'); return }
    try { settings.updateScene({ skyboxHdr: await readFileDataUrl(file), skyboxHdrName: file.name, backgroundMode: 'hdr', environmentPreset: 'custom' }); setError('') } catch { setError('HDR 文件读取失败') }
  }
  const uploadCube = async (fileList) => {
    const files = [...fileList]
    if (files.length !== 6) { setError('天空盒必须一次选择 6 张图片'); return }
    if (files.some((file) => !file.type.startsWith('image/'))) { setError('六面天空盒只支持图片文件'); return }
    if (files.some((file) => file.size > 12 * 1024 * 1024)) { setError('每张图片不能超过 12 MB'); return }
    try { settings.updateScene({ skyboxCube: await Promise.all(files.map(readFileDataUrl)), skyboxCubeNames: files.map((file) => file.name), backgroundMode: 'cube', environmentPreset: 'custom' }); setError('') } catch { setError('天空盒图片读取失败') }
  }
  const faceLabels = ['+X 右', '-X 左', '+Y 上', '-Y 下', '+Z 前', '-Z 后']
  return <div className="skybox-upload">
    {mode === 'hdr' ? <><button className="skybox-upload-button" onClick={() => hdrRef.current?.click()}><Upload size={15} /><span><strong>{settings.skyboxHdrName || '上传 HDR 全景图'}</strong><small>RGBELoader · EquirectangularReflectionMapping</small></span></button><input ref={hdrRef} className="file-input" type="file" accept=".hdr,image/vnd.radiance" onChange={(e) => { if (e.target.files[0]) uploadHdr(e.target.files[0]); e.target.value = '' }} /></> : <><button className="skybox-upload-button" onClick={() => cubeRef.current?.click()}><ImagePlus size={15} /><span><strong>{settings.skyboxCube?.length === 6 ? '重新选择六面图片' : '选择 6 张天空盒图片'}</strong><small>CubeTextureLoader · 固定面顺序</small></span></button><input ref={cubeRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { if (e.target.files.length) uploadCube(e.target.files); e.target.value = '' }} /><div className="cube-face-grid">{faceLabels.map((label, index) => <div key={label} className={settings.skyboxCube?.[index] ? 'loaded' : ''}><span>{label}</span><small>{settings.skyboxCubeNames?.[index] || '未选择'}</small></div>)}</div></>}
    {error && <div className="skybox-error">{error}</div>}
  </div>
}

function SceneInspector() {
  const settings = useEditor()
  const { backgroundMode, background, environmentIntensity, environmentRotation, skyTurbidity, skyRayleigh, skyMieCoefficient, skyMieDirectionalG, sunElevation, sunAzimuth, ambient, keyLightColor, keyLightIntensity, keyLightPosition, fillLightColor, fillLightIntensity, fillLightPosition, fillLightDistance, rimLightEnabled, rimLightColor, rimLightIntensity, rimLightPosition, rimLightAngle, hemisphereEnabled, hemisphereSkyColor, hemisphereGroundColor, hemisphereIntensity, exposure, fogEnabled, fogColor, fogNear, fogFar, grid, gridColor, gridSectionColor, gridSize, worldAxesEnabled, worldAxesSize, worldAxesPosition, worldAxesOpacity, worldAxesDepthTest, sceneSize, cameraFov, cameraNear, cameraFar, shadows, shadowOpacity, shadowBlur, environmentPreset, updateScene, toggleGrid, toggleShadows } = settings
  const applyPreset = (preset) => updateScene({ environmentPreset: preset.id, ...preset.values })
  return <div className="scene-inspector">
    <div className="scene-summary"><div className="scene-orb"><Lightbulb size={18} /></div><div><strong>场景环境</strong><small>天空、大气、灯光与渲染</small></div></div>
    <CollapsibleSection><h3><ChevronDown size={13} /> 环境预设</h3><div className="environment-presets">{ENVIRONMENT_PRESETS.map((preset) => <button key={preset.id} className={environmentPreset === preset.id ? 'active' : ''} onClick={() => applyPreset(preset)}><span><i style={{ background: preset.colors[0] }} /><i style={{ background: preset.colors[1] }} /></span><small>{preset.label}</small></button>)}</div></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 天空与世界</h3>
      <div className="sky-source-tabs"><button className={backgroundMode === 'color' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'color', environmentPreset: 'custom' })}>颜色</button><button className={backgroundMode === 'sky' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'sky', environmentPreset: 'custom' })}>程序天空</button><button className={backgroundMode === 'hdr' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'hdr', environmentPreset: 'custom' })}>HDR</button><button className={backgroundMode === 'cube' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'cube', environmentPreset: 'custom' })}>六面盒</button></div>
      {backgroundMode === 'color' && <ColorSetting label="background · 背景" value={background} onChange={(background) => updateScene({ background, environmentPreset: 'custom' })} />}
      {backgroundMode === 'sky' && <><RangeSetting label="elevation · 太阳高度" value={sunElevation} min={-5} max={90} step={1} digits={0} suffix="°" onChange={(sunElevation) => updateScene({ sunElevation, environmentPreset: 'custom' })} /><RangeSetting label="azimuth · 太阳方位" value={sunAzimuth} min={0} max={360} step={1} digits={0} suffix="°" onChange={(sunAzimuth) => updateScene({ sunAzimuth, environmentPreset: 'custom' })} /><RangeSetting label="turbidity · 浑浊度" value={skyTurbidity} min={0} max={20} step={0.1} onChange={(skyTurbidity) => updateScene({ skyTurbidity })} /><RangeSetting label="rayleigh · 瑞利散射" value={skyRayleigh} min={0} max={4} step={0.05} onChange={(skyRayleigh) => updateScene({ skyRayleigh })} /><RangeSetting label="mieCoefficient · 米氏系数" value={skyMieCoefficient} min={0} max={0.02} step={0.001} digits={3} onChange={(skyMieCoefficient) => updateScene({ skyMieCoefficient })} /><RangeSetting label="mieDirectionalG · 米氏方向" value={skyMieDirectionalG} min={0} max={1} step={0.01} onChange={(skyMieDirectionalG) => updateScene({ skyMieDirectionalG })} /></>}
      {(backgroundMode === 'hdr' || backgroundMode === 'cube') && <SkyboxUpload mode={backgroundMode} settings={settings} />}
      <RangeSetting label="environmentIntensity · 反射" value={environmentIntensity} min={0} max={3} step={0.05} onChange={(environmentIntensity) => updateScene({ environmentIntensity, environmentPreset: 'custom' })} /><RangeSetting label="environmentRotation · 旋转" value={environmentRotation} min={0} max={360} step={1} digits={0} suffix="°" onChange={(environmentRotation) => updateScene({ environmentRotation, environmentPreset: 'custom' })} /><RangeSetting label="toneMappingExposure · 曝光" value={exposure} min={0.2} max={2} step={0.05} onChange={(exposure) => updateScene({ exposure, environmentPreset: 'custom' })} />
    </CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 主光 · 方向光</h3><ColorSetting label="颜色" value={keyLightColor} onChange={(keyLightColor) => updateScene({ keyLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={keyLightIntensity} min={0} max={5} step={0.1} onChange={(keyLightIntensity) => updateScene({ keyLightIntensity, environmentPreset: 'custom' })} /><SceneVectorSetting label="位置" value={keyLightPosition} onChange={(keyLightPosition) => updateScene({ keyLightPosition })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 补光 · 点光</h3><ColorSetting label="颜色" value={fillLightColor} onChange={(fillLightColor) => updateScene({ fillLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={fillLightIntensity} min={0} max={20} step={0.5} onChange={(fillLightIntensity) => updateScene({ fillLightIntensity, environmentPreset: 'custom' })} /><RangeSetting label="距离" value={fillLightDistance} min={1} max={30} step={1} digits={0} onChange={(fillLightDistance) => updateScene({ fillLightDistance })} /><SceneVectorSetting label="位置" value={fillLightPosition} onChange={(fillLightPosition) => updateScene({ fillLightPosition })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 轮廓光 · 聚光</h3><ToggleRow label="启用轮廓光" value={rimLightEnabled} onChange={(rimLightEnabled) => updateScene({ rimLightEnabled })} />{rimLightEnabled && <><ColorSetting label="颜色" value={rimLightColor} onChange={(rimLightColor) => updateScene({ rimLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={rimLightIntensity} min={0} max={8} step={0.1} onChange={(rimLightIntensity) => updateScene({ rimLightIntensity })} /><RangeSetting label="锥角" value={rimLightAngle} min={5} max={75} step={1} digits={0} suffix="°" onChange={(rimLightAngle) => updateScene({ rimLightAngle })} /><SceneVectorSetting label="位置" value={rimLightPosition} onChange={(rimLightPosition) => updateScene({ rimLightPosition })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 天空光 · 半球光</h3><ToggleRow label="启用天空光" value={hemisphereEnabled} onChange={(hemisphereEnabled) => updateScene({ hemisphereEnabled })} />{hemisphereEnabled && <><ColorSetting label="天空颜色" value={hemisphereSkyColor} onChange={(hemisphereSkyColor) => updateScene({ hemisphereSkyColor })} /><ColorSetting label="地面颜色" value={hemisphereGroundColor} onChange={(hemisphereGroundColor) => updateScene({ hemisphereGroundColor })} /><RangeSetting label="强度" value={hemisphereIntensity} min={0} max={3} step={0.05} onChange={(hemisphereIntensity) => updateScene({ hemisphereIntensity })} /></>}<RangeSetting label="环境光" value={ambient} min={0} max={2} step={0.05} onChange={(ambient) => updateScene({ ambient, environmentPreset: 'custom' })} /></CollapsibleSection>
    <CustomLightsEditor />
    <CollapsibleSection><h3><ChevronDown size={13} /> 雾效</h3><ToggleRow label="启用雾效" value={fogEnabled} onChange={(fogEnabled) => updateScene({ fogEnabled, environmentPreset: 'custom' })} />{fogEnabled && <><ColorSetting label="雾颜色" value={fogColor} onChange={(fogColor) => updateScene({ fogColor, environmentPreset: 'custom' })} /><NumberSetting label="起始 / 结束" values={[fogNear, fogFar]} onChange={([fogNear, fogFar]) => updateScene({ fogNear, fogFar })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 阴影</h3><ToggleRow label="实时阴影" value={shadows} onChange={toggleShadows} />{shadows && <><RangeSetting label="接触阴影" value={shadowOpacity} min={0} max={1} step={0.05} onChange={(shadowOpacity) => updateScene({ shadowOpacity })} /><RangeSetting label="柔化" value={shadowBlur} min={0.5} max={6} step={0.1} onChange={(shadowBlur) => updateScene({ shadowBlur })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 场景与相机</h3><RangeSetting label="场景范围" value={sceneSize} min={5} max={120} step={1} digits={0} suffix=" u" onChange={(sceneSize) => updateScene({ sceneSize })} /><RangeSetting label="相机视角" value={cameraFov} min={20} max={120} step={1} digits={0} suffix="°" onChange={(cameraFov) => updateScene({ cameraFov })} /><RangeSetting label="近裁面" value={cameraNear} min={0.01} max={5} step={0.01} digits={2} onChange={(cameraNear) => updateScene({ cameraNear: Math.min(cameraNear, cameraFar - 0.01) })} /><RangeSetting label="远裁面" value={cameraFar} min={10} max={5000} step={10} digits={0} onChange={(cameraFar) => updateScene({ cameraFar: Math.max(cameraFar, cameraNear + 0.01) })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 世界坐标轴</h3><ToggleRow label="visible · 显示坐标轴" value={worldAxesEnabled} onChange={(worldAxesEnabled) => updateScene({ worldAxesEnabled })} />{worldAxesEnabled && <><RangeSetting label="size · 轴线长度" value={worldAxesSize} min={0.25} max={20} step={0.25} onChange={(worldAxesSize) => updateScene({ worldAxesSize })} /><SceneVectorSetting label="position · 世界位置" value={worldAxesPosition} onChange={(worldAxesPosition) => updateScene({ worldAxesPosition })} /><RangeSetting label="opacity · 不透明度" value={worldAxesOpacity} min={0.05} max={1} step={0.05} onChange={(worldAxesOpacity) => updateScene({ worldAxesOpacity })} /><ToggleRow label="depthTest · 深度遮挡" value={worldAxesDepthTest} onChange={(worldAxesDepthTest) => updateScene({ worldAxesDepthTest })} /><div className="axis-legend"><span><i className="axis-x-swatch" />X · 红色</span><span><i className="axis-y-swatch" />Y · 绿色</span><span><i className="axis-z-swatch" />Z · 蓝色</span></div></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 视口辅助</h3><ToggleRow label="显示网格" value={grid} onChange={toggleGrid} />{grid && <><ColorSetting label="细网格" value={gridColor} onChange={(gridColor) => updateScene({ gridColor })} /><ColorSetting label="主网格" value={gridSectionColor} onChange={(gridSectionColor) => updateScene({ gridSectionColor })} /><RangeSetting label="网格间距" value={gridSize} min={0.1} max={2} step={0.1} onChange={(gridSize) => updateScene({ gridSize })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 渲染信息</h3><div className="metric-grid"><div><span>{useEditor.getState().objects.length}</span><small>对象</small></div><div><span>WebGL 2</span><small>渲染器</small></div></div></CollapsibleSection>
  </div>
}

function PostProcessingPanel() {
  const settings = useEditor()
  const selected = settings.objects.find((object) => object.id === settings.selectedId)
  return <div className="post-inspector"><div className="scene-summary post-summary"><div className="scene-orb"><Settings2 size={18} /></div><div><strong>后期处理栈</strong><small>屏幕空间效果 · {selected ? `轮廓目标 ${selected.name}` : '未选择轮廓目标'}</small></div></div><PostProcessingInspector settings={settings} /></div>
}

function PostProcessingInspector({ settings }) {
  const { updateScene } = settings
  const activeCount = ['outlineEnabled', 'colorAdjustEnabled', 'bloomEnabled', 'depthOfFieldEnabled', 'vignetteEnabled', 'chromaticAberrationEnabled', 'noiseEnabled'].filter((key) => settings[key]).length
  const applyPreset = (preset) => updateScene({ postProcessingEnabled: true, ...preset.values })
  return <CollapsibleSection className="post-processing-section">
    <h3><ChevronDown size={13} /> 后期处理 <span>{activeCount}</span></h3>
    <ToggleRow label="启用效果栈" value={settings.postProcessingEnabled} onChange={(postProcessingEnabled) => updateScene({ postProcessingEnabled })} />
    {settings.postProcessingEnabled && <>
      <div className="post-presets">{POST_PROCESSING_PRESETS.map((preset) => <button key={preset.id} onClick={() => applyPreset(preset)}>{preset.label}</button>)}</div>
      <div className="mode-segments quality-segments"><button className={settings.postProcessingQuality === 'performance' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'performance' })}>性能</button><button className={settings.postProcessingQuality === 'balanced' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'balanced' })}>均衡</button><button className={settings.postProcessingQuality === 'high' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'high' })}>高质量</button></div>
      <EffectControls label="轮廓光 Outline" enabled={settings.outlineEnabled} onToggle={(outlineEnabled) => updateScene({ outlineEnabled })}>
        <RangeSetting label="edgeStrength · 边缘强度" value={settings.outlineEdgeStrength} min={0} max={10} step={0.1} onChange={(outlineEdgeStrength) => updateScene({ outlineEdgeStrength })} />
        <RangeSetting label="pulseSpeed · 脉冲速度" value={settings.outlinePulseSpeed} min={0} max={5} step={0.1} onChange={(outlinePulseSpeed) => updateScene({ outlinePulseSpeed })} />
        <ColorSetting label="visibleEdgeColor · 可见边" value={settings.outlineVisibleEdgeColor} onChange={(outlineVisibleEdgeColor) => updateScene({ outlineVisibleEdgeColor })} />
        <ColorSetting label="hiddenEdgeColor · 遮挡边" value={settings.outlineHiddenEdgeColor} onChange={(outlineHiddenEdgeColor) => updateScene({ outlineHiddenEdgeColor })} />
        <ToggleRow label="blur · 边缘柔化" value={settings.outlineBlur} onChange={(outlineBlur) => updateScene({ outlineBlur })} />
        <ToggleRow label="xRay · 显示遮挡边" value={settings.outlineXRay} onChange={(outlineXRay) => updateScene({ outlineXRay })} />
      </EffectControls>
      <EffectControls label="颜色调整 Color" enabled={settings.colorAdjustEnabled} onToggle={(colorAdjustEnabled) => updateScene({ colorAdjustEnabled })}>
        <RangeSetting label="brightness · 亮度" value={settings.brightness} min={-1} max={1} step={0.01} onChange={(brightness) => updateScene({ brightness })} />
        <RangeSetting label="contrast · 对比度" value={settings.contrast} min={-1} max={1} step={0.01} onChange={(contrast) => updateScene({ contrast })} />
        <RangeSetting label="hue · 色相" value={settings.hue} min={-Math.PI} max={Math.PI} step={0.01} onChange={(hue) => updateScene({ hue })} />
        <RangeSetting label="saturation · 饱和度" value={settings.saturation} min={-1} max={1} step={0.01} onChange={(saturation) => updateScene({ saturation })} />
      </EffectControls>
      <EffectControls label="泛光 Bloom" enabled={settings.bloomEnabled} onToggle={(bloomEnabled) => updateScene({ bloomEnabled })}>
        <RangeSetting label="intensity · 强度" value={settings.bloomIntensity} min={0} max={3} step={0.05} onChange={(bloomIntensity) => updateScene({ bloomIntensity })} />
        <RangeSetting label="luminanceThreshold · 阈值" value={settings.bloomThreshold} min={0} max={1} step={0.01} onChange={(bloomThreshold) => updateScene({ bloomThreshold })} />
        <RangeSetting label="luminanceSmoothing · 柔和" value={settings.bloomSmoothing} min={0} max={1} step={0.01} onChange={(bloomSmoothing) => updateScene({ bloomSmoothing })} />
      </EffectControls>
      <EffectControls label="景深 DOF" enabled={settings.depthOfFieldEnabled} onToggle={(depthOfFieldEnabled) => updateScene({ depthOfFieldEnabled })}>
        <RangeSetting label="focusDistance · 焦点距离" value={settings.depthOfFieldFocusDistance} min={0} max={0.15} step={0.001} digits={3} onChange={(depthOfFieldFocusDistance) => updateScene({ depthOfFieldFocusDistance })} />
        <RangeSetting label="focalLength · 焦距" value={settings.depthOfFieldFocalLength} min={0.005} max={0.12} step={0.001} digits={3} onChange={(depthOfFieldFocalLength) => updateScene({ depthOfFieldFocalLength })} />
        <RangeSetting label="bokehScale · 散景" value={settings.depthOfFieldBokehScale} min={0} max={8} step={0.1} onChange={(depthOfFieldBokehScale) => updateScene({ depthOfFieldBokehScale })} />
      </EffectControls>
      <EffectControls label="暗角 Vignette" enabled={settings.vignetteEnabled} onToggle={(vignetteEnabled) => updateScene({ vignetteEnabled })}>
        <RangeSetting label="offset · 范围" value={settings.vignetteOffset} min={0} max={1} step={0.01} onChange={(vignetteOffset) => updateScene({ vignetteOffset })} />
        <RangeSetting label="darkness · 深度" value={settings.vignetteDarkness} min={0} max={1} step={0.01} onChange={(vignetteDarkness) => updateScene({ vignetteDarkness })} />
      </EffectControls>
      <EffectControls label="色差 Chromatic" enabled={settings.chromaticAberrationEnabled} onToggle={(chromaticAberrationEnabled) => updateScene({ chromaticAberrationEnabled })}>
        <RangeSetting label="offset · RGB 偏移" value={settings.chromaticAberrationOffset} min={0} max={0.01} step={0.0001} digits={4} onChange={(chromaticAberrationOffset) => updateScene({ chromaticAberrationOffset })} />
      </EffectControls>
      <EffectControls label="胶片颗粒 Noise" enabled={settings.noiseEnabled} onToggle={(noiseEnabled) => updateScene({ noiseEnabled })}>
        <RangeSetting label="opacity · 不透明度" value={settings.noiseOpacity} min={0} max={0.25} step={0.005} digits={3} onChange={(noiseOpacity) => updateScene({ noiseOpacity })} />
      </EffectControls>
    </>}
  </CollapsibleSection>
}

function EffectControls({ label, enabled, onToggle, children }) {
  return <div className={`effect-control ${enabled ? 'enabled' : ''}`}><ToggleRow label={label} value={enabled} onChange={onToggle} />{enabled && <div className="effect-settings">{children}</div>}</div>
}

const CUSTOM_LIGHT_TYPES = [
  { type: 'ambient', label: '环境光' },
  { type: 'directional', label: '方向光' },
  { type: 'point', label: '点光' },
  { type: 'spot', label: '聚光' },
  { type: 'hemisphere', label: '半球光' },
]

function CustomLightsEditor() {
  const { customLights, addLight, updateLight, removeLight } = useEditor()
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const selected = customLights.find((light) => light.id === selectedId)
  const add = (type) => { const id = addLight(type); setSelectedId(id); setAdding(false) }
  const remove = (id) => { removeLight(id); if (selectedId === id) setSelectedId(null) }
  return <CollapsibleSection className="custom-lights-section">
    <h3><ChevronDown size={13} /> 自定义灯光 <span>{customLights.length}</span><button title="添加灯光" onClick={() => setAdding(!adding)}><Plus size={13} /></button></h3>
    {adding && <div className="light-type-menu">{CUSTOM_LIGHT_TYPES.map((item) => <button key={item.type} onClick={() => add(item.type)}><Lightbulb size={12} />{item.label}</button>)}</div>}
    {!customLights.length ? <div className="lights-empty"><Lightbulb size={17} /><span>可添加多个独立灯光</span></div> : <div className="lights-list">{customLights.map((light) => <div key={light.id} className={`light-list-item ${selectedId === light.id ? 'selected' : ''}`}><button onClick={() => setSelectedId(light.id)}><i style={{ background: light.color || light.skyColor }} /><span><strong>{light.name}</strong><small>{CUSTOM_LIGHT_TYPES.find((item) => item.type === light.type)?.label}</small></span></button><IconButton icon={light.enabled ? Eye : EyeOff} label={light.enabled ? '关闭灯光' : '开启灯光'} onClick={() => updateLight(light.id, { enabled: !light.enabled })} /><IconButton icon={Trash2} label="删除灯光" onClick={() => remove(light.id)} /></div>)}</div>}
    {selected && <CustomLightInspector light={selected} update={(patch) => updateLight(selected.id, patch)} />}
  </CollapsibleSection>
}

function CustomLightInspector({ light, update }) {
  const commonColor = light.type === 'hemisphere' ? null : <ColorSetting label="颜色" value={light.color} onChange={(color) => update({ color })} />
  const commonIntensity = <RangeSetting label="强度" value={light.intensity} min={0} max={light.type === 'point' || light.type === 'spot' ? 20 : 5} step={0.1} onChange={(intensity) => update({ intensity })} />
  return <div className="custom-light-inspector">
    <input className="light-name-input" value={light.name} onChange={(e) => update({ name: e.target.value })} />
    <ToggleRow label="启用" value={light.enabled} onChange={(enabled) => update({ enabled })} />
    {light.type === 'hemisphere' ? <><ColorSetting label="天空颜色" value={light.skyColor} onChange={(skyColor) => update({ skyColor })} /><ColorSetting label="地面颜色" value={light.groundColor} onChange={(groundColor) => update({ groundColor })} />{commonIntensity}</> : <>{commonColor}{commonIntensity}</>}
    {['directional', 'point', 'spot'].includes(light.type) && <SceneVectorSetting label="位置" value={light.position} onChange={(position) => update({ position })} />}
    {['point', 'spot'].includes(light.type) && <><RangeSetting label="距离" value={light.distance} min={1} max={40} step={1} digits={0} onChange={(distance) => update({ distance })} />{light.type === 'point' && <RangeSetting label="衰减" value={light.decay} min={0} max={4} step={0.1} onChange={(decay) => update({ decay })} />}</>}
    {light.type === 'spot' && <><RangeSetting label="锥角" value={light.angle} min={5} max={80} step={1} digits={0} suffix="°" onChange={(angle) => update({ angle })} /><RangeSetting label="边缘柔化" value={light.penumbra} min={0} max={1} step={0.05} onChange={(penumbra) => update({ penumbra })} /></>}
    {['directional', 'spot'].includes(light.type) && <ToggleRow label="投射阴影" value={light.castShadow} onChange={(castShadow) => update({ castShadow })} />}
  </div>
}

function ColorSetting({ label, value, onChange }) { return <div className="property-row"><label>{label}</label><div className="color-control"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /><input value={value.toUpperCase()} readOnly /></div></div> }

function RangeSetting({ label, value, min, max, step, digits = 2, suffix = '', hardMax, onChange }) {
  const fixed = hardMax ?? !/(intensity|Intensity|Exposure|edgeStrength|pulseSpeed|bokehScale|size ·|场景范围|远裁面|轴线长度|环境反射|强度|距离|柔化)/.test(label)
  const normalized = fixed && min === 0 && max === 1
  const [softMax, setSoftMax] = useState(Math.max(max, Number(value) || max))
  const [draft, setDraft] = useState(Number(value).toFixed(digits))
  const sliderMax = fixed ? max : Math.max(softMax, Number(value) || min)
  const commit = (raw) => {
    const number = Number(raw)
    if (!Number.isFinite(number)) return
    const next = Math.max(min, fixed ? Math.min(max, number) : number)
    onChange(next)
    if (!fixed && next > softMax) setSoftMax(next)
  }
  useEffect(() => setDraft(Number(value).toFixed(digits)), [value, digits])
  useEffect(() => { if (!fixed && Number(value) > softMax) setSoftMax(Number(value)) }, [fixed, value, softMax])
  const updateSoftMax = (raw) => { const number = Number(raw); if (Number.isFinite(number) && number > min) setSoftMax(Math.max(number, Number(value))) }
  return <div className="property-row slider-row range-setting">
    <div className="range-setting-head"><label>{label}</label><span className="range-value range-current"><input aria-label={`${label} 当前值`} type="number" min={min} max={fixed ? max : undefined} step={step} value={draft} onChange={(e) => { setDraft(e.target.value); if (e.target.value !== '' && e.target.value !== '-' && Number.isFinite(Number(e.target.value))) commit(e.target.value) }} onBlur={() => { if (draft === '' || draft === '-' || !Number.isFinite(Number(draft))) setDraft(Number(value).toFixed(digits)); else commit(draft) }} />{suffix && <b>{suffix}</b>}</span></div>
    <div className={`range-setting-track ${normalized ? 'normalized' : ''}`}>
      {!normalized && <span className="range-bound range-min" title="最小值">{Number(min).toFixed(digits)}</span>}
      <input type="range" min={min} max={sliderMax} step={step} value={Math.max(min, Number(value) || 0)} onChange={(e) => commit(e.target.value)} />
      {!normalized && <span className={`range-bound range-max ${fixed ? 'fixed' : 'editable'}`} title={fixed ? '固定最大值' : '可编辑建议最大值'}>{fixed ? Number(max).toFixed(digits) : <input aria-label={`${label} 最大值`} type="number" min={min + step} step={step} value={softMax} onChange={(e) => updateSoftMax(e.target.value)} />}</span>}
    </div>
  </div>
}

function SceneVectorSetting({ label, value, onChange }) { return <VectorInput label={label} value={value} onChange={onChange} /> }

function NumberSetting({ label, values, onChange }) { return <div className="property-row dual-number"><label>{label}</label><div>{values.map((value, index) => <input key={index} type="number" step="1" value={value} onChange={(e) => { const next = [...values]; next[index] = Number(e.target.value); onChange(next) }} />)}</div></div> }

function FocusController() {
  const { camera, controls } = useThree()
  useEffect(() => {
    const focus = () => {
      const { objects, selectedId } = useEditor.getState(); const object = objects.find((o) => o.id === selectedId)
      if (!object || !controls) return
      const target = new THREE.Vector3(...object.position); const direction = camera.position.clone().sub(controls.target).normalize()
      controls.target.copy(target); camera.position.copy(target.clone().add(direction.multiplyScalar(5))); camera.updateProjectionMatrix(); controls.update()
    }
    window.addEventListener('frame-focus', focus); return () => window.removeEventListener('frame-focus', focus)
  }, [camera, controls])
  return null
}

function RendererSettings() {
  const { gl } = useThree()
  const exposure = useEditor((s) => s.exposure)
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = exposure
    gl.shadowMap.type = THREE.PCFSoftShadowMap
  }, [gl, exposure])
  return null
}

function Viewport({ leftPanelOpen, rightPanelOpen, openLeftPanel, openRightPanel }) {
  const { grid, shadows, toggleGrid, toggleShadows, projection, setProjection, shading, setShading, objects, selectedId } = useEditor()
  const selected = objects.find((o) => o.id === selectedId)
  return <main className="viewport">
    {!leftPanelOpen && <button className="side-panel-reveal side-panel-reveal-left" title="展开左侧栏" aria-label="展开左侧栏" onClick={openLeftPanel}><PanelLeftOpen size={17} /></button>}
    {!rightPanelOpen && <button className="side-panel-reveal side-panel-reveal-right" title="展开右侧栏" aria-label="展开右侧栏" onClick={openRightPanel}><PanelRightOpen size={17} /></button>}
    <Toolbar />
    <div className="viewport-label"><button onClick={() => setProjection(projection === 'perspective' ? 'orthographic' : 'perspective')}><Camera size={12} />{projection === 'perspective' ? '透视' : '正交'}</button><select value={shading} onChange={(e) => setShading(e.target.value)}><option value="solid">实体</option><option value="wireframe">线框</option></select></div>
    <div className="viewport-options"><IconButton icon={Grid3X3} label="网格" active={grid} onClick={toggleGrid} /><IconButton icon={Lightbulb} label="阴影" active={shadows} onClick={toggleShadows} /><IconButton icon={Focus} label="聚焦对象 (F)" onClick={() => window.dispatchEvent(new Event('frame-focus'))} /></div>
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <Scene /><RoamingRuntime objectRefs={SCENE_OBJECT_REFS} /><FocusController /><RendererSettings /><PostProcessing />
    </Canvas>
    <div className="viewport-hint">左键选择 · 右键旋转 · 滚轮缩放</div>
    <div className="viewport-info">{selected ? `${selected.name} · ${selected.type}` : '未选择对象'}</div>
  </main>
}

function App() {
  const [toast, setToast] = useState('')
  const [help, setHelp] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(() => localStorage.getItem('frame-left-panel') !== 'closed')
  const [rightPanelOpen, setRightPanelOpen] = useState(() => localStorage.getItem('frame-right-panel') !== 'closed')
  const { setMode, deleteSelected, duplicateSelected, undo, redo } = useEditor()
  const notify = (message) => { setToast(message); window.clearTimeout(window.__frameToast); window.__frameToast = window.setTimeout(() => setToast(''), 2200) }
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      const commandKey = e.ctrlKey || e.metaKey
      const hasModifier = commandKey || e.altKey
      if (!hasModifier && !e.repeat) {
        if (e.code === 'KeyW') setMode('translate')
        if (e.code === 'KeyE') setMode('rotate')
        if (e.code === 'KeyR') setMode('scale')
        if (e.code === 'KeyF') window.dispatchEvent(new Event('frame-focus'))
        if (e.code === 'Delete' || e.code === 'Backspace') deleteSelected()
      }
      if (commandKey && e.code === 'KeyD') { e.preventDefault(); duplicateSelected() }
      if (commandKey && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      if (commandKey && e.code === 'KeyS') { e.preventDefault(); document.querySelector('.export-button')?.click() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [setMode, deleteSelected, duplicateSelected, undo, redo])
  const objects = useEditor((s) => s.objects)
  const sceneSettingsJson = useEditor((s) => JSON.stringify(Object.fromEntries(SCENE_SETTING_KEYS.map((key) => [key, s[key]]))))
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('frame-scene')); if (saved?.objects?.length) useEditor.getState().loadScene(saved); if (saved?.interaction?.roaming) useRoaming.getState().setSetting(saved.interaction.roaming) } catch { /* Ignore invalid local drafts. */ } }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedAsset = params.get('asset')
    const asset = MODEL_ASSETS.find((item) => item.name.toLowerCase().replaceAll(' ', '') === requestedAsset?.toLowerCase().replaceAll(' ', ''))
    if (asset && !useEditor.getState().objects.some((item) => item.modelSource === asset.source)) useEditor.getState().addModel(asset)
    const requestedEnvironment = params.get('environment')
    const environment = ENVIRONMENT_PRESETS.find((item) => item.id === requestedEnvironment)
    if (environment) useEditor.getState().updateScene({ environmentPreset: environment.id, ...environment.values })
    if (params.get('lights') === 'demo' && !useEditor.getState().customLights.length) {
      const types = ['ambient', 'directional', 'point', 'point', 'spot', 'hemisphere']
      types.forEach((type, index) => {
        const id = useEditor.getState().addLight(type)
        useEditor.getState().updateLight(id, { name: `Demo ${type} ${index + 1}` })
      })
    }
    if (params.get('section') === 'lights') window.setTimeout(() => document.querySelector('.custom-lights-section')?.scrollIntoView({ block: 'start' }), 300)
  }, [])
  const roamingSettingsJson = useRoaming((state) => JSON.stringify(Object.fromEntries(['pathPoints', 'speed', 'loop', 'curveType', 'tension', 'bendFactor', 'lookAhead', 'eyeHeight', 'colliderRadius', 'gravity', 'sprintMultiplier'].map((key) => [key, state[key]]))))
  useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem('frame-scene', JSON.stringify({ version: 3, objects, settings: JSON.parse(sceneSettingsJson), interaction: { roaming: JSON.parse(roamingSettingsJson) } })) } catch { /* Large textures can exceed the browser storage quota. */ } }, 400); return () => clearTimeout(timer) }, [objects, sceneSettingsJson, roamingSettingsJson])
  useEffect(() => { localStorage.setItem('frame-left-panel', leftPanelOpen ? 'open' : 'closed') }, [leftPanelOpen])
  useEffect(() => { localStorage.setItem('frame-right-panel', rightPanelOpen ? 'open' : 'closed') }, [rightPanelOpen])
  const workspaceClass = `workspace ${leftPanelOpen ? '' : 'left-panel-collapsed'} ${rightPanelOpen ? '' : 'right-panel-collapsed'}`
  return <div className="app-shell"><Header notify={notify} showHelp={() => setHelp(true)} showExport={() => setExportOpen(true)} /><div className={workspaceClass}>{leftPanelOpen && <SceneTree onCollapse={() => setLeftPanelOpen(false)} />}<Viewport leftPanelOpen={leftPanelOpen} rightPanelOpen={rightPanelOpen} openLeftPanel={() => setLeftPanelOpen(true)} openRightPanel={() => setRightPanelOpen(true)} />{rightPanelOpen && <Inspector onCollapse={() => setRightPanelOpen(false)} />}</div><footer><span><i /> WebGL 2.0</span><span>对象 {objects.length}</span><span>自动保存</span><span className="footer-right">FRAME 0.2.0</span></footer>{toast && <div className="toast"><Check size={15} />{toast}</div>}{exportOpen && <ExportDialog objects={objects} settings={{ ...readSceneSettings(), interaction: { roaming: readRoamingSettings() } }} editor={{ grid: useEditor.getState().grid, shadows: useEditor.getState().shadows }} notify={notify} onClose={() => setExportOpen(false)} />}{help && <div className="modal-backdrop" onMouseDown={() => setHelp(false)}><div className="shortcut-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><strong>快捷键</strong><small>在视口中快速工作</small></div><IconButton icon={X} label="关闭" onClick={() => setHelp(false)} /></div><div className="shortcut-grid"><span>移动对象</span><kbd>W</kbd><span>旋转对象</span><kbd>E</kbd><span>缩放对象</span><kbd>R</kbd><span>聚焦选择</span><kbd>F</kbd><span>复制对象</span><kbd>Ctrl D</kbd><span>删除对象</span><kbd>Delete</kbd><span>撤销 / 重做</span><kbd>Ctrl Z / Shift Z</kbd><span>导出项目</span><kbd>Ctrl S</kbd></div></div></div>}</div>
}

export default App
