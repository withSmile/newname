import { PerformanceOverlay, PerformanceSampler } from './features/performance/PerformanceMonitor.jsx'
import React, { forwardRef, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, GizmoHelper, GizmoViewport, Grid, Html, OrbitControls, OrthographicCamera, PerspectiveCamera, Sky, TransformControls, useAnimations } from '@react-three/drei'
import { Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, N8AO, Noise, Outline, FXAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Sky as ThreeSky } from 'three/addons/objects/Sky.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import {
  Box, BoxSelect, Camera, Check, ChevronDown, ChevronsDown, ChevronsUp, Circle, Copy, Download, Eye, EyeOff, FileJson, Focus, ImagePlus,
  Grid3X3, HelpCircle, ImageDown, Lightbulb, Lock, Magnet, Menu, MousePointer2, Move3D, Layers, Monitor, Smartphone, Type, LayoutTemplate, MapPin,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil,
  Plus, Redo2, Rotate3D, Scaling, Search, Settings2, Shapes, Trash2, Undo2, Unlock, Upload, X,
} from 'lucide-react'
import { useEditor, DEFAULT_SCENE_SETTINGS } from './store'
import { NOVA_MODEL_ASSETS } from './features/scene/presets/novaScene'
import { loadNovaScene, restoreSceneBeforeNova, serializeFeatureSettings, getSceneBackupAssetIds } from './features/scene/presets/scenePresetController'
import { useParticles } from './features/particles/particleStore'
import { useSceneEffects } from './features/scene-effects/sceneEffectStore'
import { useAnimationRuntime } from './features/animation/animationStore'
import { SceneObjectMenu } from './features/scene/SceneObjectMenu'
import { CAMERA_VIEWS, fitBounds } from './features/scene/viewportMath'
import { SCENE_OBJECT_REFS, MODEL_NODE_REFS, indexModelNodes } from './features/scene/sceneRegistry'
import { ModelHierarchyPanel } from './features/scene/model/ModelHierarchyPanel'
import { ModelSelectionRuntime } from './features/scene/model/ModelSelectionRuntime'
import { useModelSelection } from './features/scene/model/modelSelectionStore'
import { MeasurePanel, MeasureOverlay } from './features/measure/MeasurePanel'
import { MeasureRuntime } from './features/measure/MeasureRuntime'
import { useMeasure } from './features/measure/measureStore'
import { HistoryPanel } from './features/history/HistoryPanel'
import { UiWorkspace } from './features/ui-editor/UiWorkspace'
import { readUiProject } from './features/ui-editor/uiProject'
import { useShallow } from 'zustand/react/shallow'
import { ExportDialog } from './ExportDialog'
import { RoamingPanel } from './features/interaction/roaming/RoamingPanel'
import { RoamingRuntime } from './features/interaction/roaming/RoamingRuntime'
import { FlowPipeObject } from './features/scene/flow-pipe/FlowPipeObject'
import { FlowPipeInspector } from './features/scene/flow-pipe/FlowPipeInspector'
import { useRoaming } from './features/interaction/roaming/roamingStore'
import { AnimationPanel } from './features/animation/AnimationPanel'
import { AnimationRuntime } from './features/animation/AnimationRuntime'
import { PhysicsPanel } from './features/physics/PhysicsPanel'
import { PhysicsRuntime } from './features/physics/PhysicsRuntime'
import { ParticleRuntime } from './features/particles/ParticleRuntime'
import { ParticlePanel } from './features/particles/ParticlePanel'
import { SceneEffectPanel } from './features/scene-effects/SceneEffectPanel'
import { SceneEffectRuntime } from './features/scene-effects/SceneEffectRuntime'
import { DEFAULT_REFLECTOR, DEFAULT_THREE_WATER, ReflectorObject, ThreeWaterObject } from './features/scene/GpuRippleWaterObject'
import { ImportedModelMaterialEffect, MODEL_EFFECT_TYPES, injectModelEffectShader, updateModelEffectShader } from './features/scene/ImportedModelMaterialEffect'
import { NumberInput } from './components/NumberInput'
import { loadImportedModel } from './features/scene/model/modelLoader'
import { DEFAULT_MODEL_IMPORT_SETTINGS, applyModelNodeSettings, disposeObject3D, getModelLayout, inspectModel, normalizeModelFormat } from './features/scene/model/modelUtils'
import { pruneModelAssets, restoreModelAsset, saveModelAsset, serializeModelAsset } from './features/scene/model/modelAssetStore'

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

const GPU_WATER_OBJECT_TYPES = new Set(['box', 'sphere', 'torus', 'cylinder', 'cone', 'plane', 'capsule', 'ring', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron', 'pipe', 'torusKnot', 'lathe'])

const MODEL_ASSETS = [
  ...NOVA_MODEL_ASSETS,
  { name: 'Damaged Helmet', source: '/models/DamagedHelmet.glb', category: 'PBR', attribution: 'Khronos glTF Sample Assets · CC BY 4.0' },
  { name: 'Fox', source: '/models/Fox.glb', category: '动画', animated: true, attribution: 'PixelMannen / Autodesk · CC0 + CC BY 4.0' },
  { name: 'Cesium Man', source: '/models/CesiumMan.glb', category: '蒙皮', animated: true, attribution: 'Cesium · CC BY 4.0' },
  { name: 'Khronos Box', source: '/models/Box.glb', category: '基础', attribution: 'Khronos glTF Sample Assets' },
]

const MODEL_FORMATS = {
  glb: { label: 'GLB', description: '材质、贴图、骨骼与动画', recommended: true }, gltf: { label: 'glTF', description: '开放标准场景格式' },
  fbx: { label: 'FBX', description: 'DCC 与动画交换' }, obj: { label: 'OBJ', description: '通用静态网格，可附带 MTL' },
  stl: { label: 'STL', description: '打印与工程网格' }, ply: { label: 'PLY', description: '扫描与点面数据' },
  dae: { label: 'Collada', description: 'DAE 场景交换' }, '3mf': { label: '3MF', description: '3D 制造格式' },
}

function applyMeshSmoothing(root, object) {
  const normalMode = object.modelNormalMode || 'source'
  const smooth = normalMode === 'smooth'
  const creaseAngle = THREE.MathUtils.degToRad(object.creaseAngle ?? object.pipeCreaseAngle ?? 60)
  root?.traverse((child) => {
    if (!child.isMesh) return
    if (child.geometry?.attributes?.position) {
      const sourceGeometry = child.geometry.clone()
      if (normalMode === 'source') child.geometry = sourceGeometry
      else if (smooth) {
        const nextGeometry = toCreasedNormals(sourceGeometry, creaseAngle)
        if (nextGeometry !== sourceGeometry) sourceGeometry.dispose()
        child.geometry = nextGeometry
      } else child.geometry = sourceGeometry
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((material) => { material.flatShading = normalMode === 'flat'; material.needsUpdate = true })
  })
  return root
}

const ENVIRONMENT_PRESETS = [
  { id: 'studio', label: '影棚', colors: ['#25292d', '#fff2df'], values: { backgroundMode: 'color', background: '#25292d', environmentIntensity: 1.25, environmentRotation: 0, ambient: 0.45, keyLightColor: '#fff2df', keyLightIntensity: 2.1, fillLightColor: '#79a7c7', fillLightIntensity: 12, rimLightColor: '#f08a62', rimLightIntensity: 2.2, exposure: 1, fogEnabled: false } },
  { id: 'product', label: '产品', colors: ['#d6dadd', '#ffffff'], values: { backgroundMode: 'color', background: '#d6dadd', environmentIntensity: 1.65, environmentRotation: 35, ambient: 0.55, keyLightColor: '#ffffff', keyLightIntensity: 2.8, fillLightColor: '#b6d5df', fillLightIntensity: 8, rimLightColor: '#ffffff', rimLightIntensity: 1.5, exposure: 1.05, fogEnabled: false } },
  { id: 'sunset', label: '夕照', colors: ['#3a2927', '#ffb06b'], values: { backgroundMode: 'sky', background: '#3a2927', environmentIntensity: 1.1, environmentRotation: 0, sunElevation: 4, sunAzimuth: 235, skyTurbidity: 12, skyRayleigh: 3.5, ambient: 0.2, keyLightColor: '#ffb06b', keyLightIntensity: 3.1, fillLightColor: '#6c80bb', fillLightIntensity: 9, rimLightColor: '#ff8059', rimLightIntensity: 2.8, exposure: 1.1, fogEnabled: true, fogColor: '#3a2927', fogNear: 10, fogFar: 30 } },
  { id: 'night', label: '夜景', colors: ['#11161d', '#7fa6ff'], values: { backgroundMode: 'color', background: '#11161d', environmentIntensity: 0.75, environmentRotation: 210, ambient: 0.12, keyLightColor: '#7fa6ff', keyLightIntensity: 2.4, fillLightColor: '#d45b86', fillLightIntensity: 7, rimLightColor: '#8c6cff', rimLightIntensity: 3.2, exposure: 0.9, fogEnabled: true, fogColor: '#11161d', fogNear: 8, fogFar: 26 } },
]

const POST_PROCESSING_PRESETS = [
  { id: 'clean', label: '清晰', values: { aoEnabled: false, bloomEnabled: false, depthOfFieldEnabled: false, vignetteEnabled: false, chromaticAberrationEnabled: false, noiseEnabled: false } },
  { id: 'cinematic', label: '电影', values: { aoEnabled: true, aoRadius: 1.5, aoIntensity: 1.8, aoDistanceFalloff: 0.8, bloomEnabled: true, bloomIntensity: 0.5, bloomThreshold: 0.78, depthOfFieldEnabled: true, depthOfFieldFocusDistance: 0.02, depthOfFieldFocalLength: 0.035, depthOfFieldBokehScale: 1.8, vignetteEnabled: true, vignetteOffset: 0.2, vignetteDarkness: 0.62, chromaticAberrationEnabled: false, noiseEnabled: true, noiseOpacity: 0.025 } },
  { id: 'dream', label: '柔光', values: { aoEnabled: false, bloomEnabled: true, bloomIntensity: 1.05, bloomThreshold: 0.58, bloomSmoothing: 0.3, depthOfFieldEnabled: false, vignetteEnabled: true, vignetteOffset: 0.3, vignetteDarkness: 0.42, chromaticAberrationEnabled: true, chromaticAberrationOffset: 0.0008, noiseEnabled: false } },
]

const SCENE_SETTING_KEYS = Object.keys(DEFAULT_SCENE_SETTINGS)
const readEditorSettings = () => { const s = useEditor.getState(); return { grid: s.grid, shadows: s.shadows, mode: s.mode, projection: s.projection, sceneLocked: s.sceneLocked } }
const applyEditorSettings = (s) => { if (s) useEditor.setState(Object.fromEntries(['grid', 'shadows', 'mode', 'projection', 'sceneLocked'].filter(key => key in s).map(key => [key, s[key]]))); if (s?.sceneLocked) useEditor.setState({ selectedId: null, mode: 'select' }) }
const readSceneSettings = () => { const state = useEditor.getState(); return Object.fromEntries(SCENE_SETTING_KEYS.map((key) => [key, state[key]])) }
const readRoamingSettings = () => { const state = useRoaming.getState(); return Object.fromEntries(['showPath', 'pathPoints', 'speed', 'loop', 'curveType', 'tension', 'bendFactor', 'lookAhead', 'walkSpeed', 'acceleration', 'lookSensitivity', 'eyeHeight', 'colliderRadius', 'gravity', 'sprintMultiplier'].map((key) => [key, state[key]])) }


const WRAP_MODES = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping, mirror: THREE.MirroredRepeatWrapping }
const MATERIAL_IMAGE_CACHE = new Map()

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
  const effectShaderRef = useRef()
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
  const effect = object.effects?.model || object.effects?.material
  const effectEnabled = Boolean(effect?.enabled && MODEL_EFFECT_TYPES.has(effect?.type))
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
  useFrame(({ clock }) => {
    if (effectEnabled) updateModelEffectShader(effectShaderRef.current || materialRef.current?.userData.modelEffectShader, effect, clock.elapsedTime)
  })
  return <meshStandardMaterial key={materialKey} ref={materialRef}
    color={object.color} roughness={object.roughness} metalness={object.metalness}
    envMapIntensity={object.envMapIntensity ?? 1}
    map={baseMap} normalMap={normalMap} normalScale={normalScale}
    roughnessMap={roughnessMap} metalnessMap={metalnessMap}
    aoMap={aoMap} aoMapIntensity={object.aoIntensity ?? 1}
    emissiveMap={emissiveMap} emissive={object.emissiveColor || (emissiveMap ? '#ffffff' : '#000000')} emissiveIntensity={object.emissiveIntensity ?? 1}
    alphaMap={alphaMap} transparent={Boolean(alphaMap) || Boolean(object.transparent) || (object.opacity ?? 1) < 1} opacity={object.opacity ?? 1} alphaTest={object.alphaTest ?? 0} depthWrite={object.depthWrite !== false}
    displacementMap={displacementMap} displacementScale={object.displacementScale ?? 0.1}
    side={object.doubleSided || effect?.type === 'xray' || ['plane', 'ring'].includes(object.type) ? THREE.DoubleSide : THREE.FrontSide}
    flatShading={object.smoothShading === false} wireframe={shading === 'wireframe'}
    onBeforeCompile={(shader) => { if (effectEnabled) { effectShaderRef.current = injectModelEffectShader(shader, effect); if (materialRef.current) materialRef.current.userData.modelEffectShader = effectShaderRef.current } }}
    customProgramCacheKey={() => `frame-object-effect-${effectEnabled ? effect.type : 'none'}-v3`}
  />
}

const ImportedModel = forwardRef(function ImportedModel({ object }, ref) {
  const selectedId = useEditor((s) => s.selectedId)
  const setSelected = useEditor((s) => s.setSelected)
  const updateObject = useEditor((s) => s.updateObject)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const [asset, setAsset] = useState(null)
  const [loadState, setLoadState] = useState({ status: 'loading', progress: null, error: '' })
  useEffect(() => {
    let active = true
    let loadedAsset = null
    setAsset(null)
    setLoadState({ status: 'loading', progress: null, error: '' })
    loadImportedModel(object, gl, (progress) => active && setLoadState({ status: 'loading', progress, error: '' }))
      .then((result) => {
        loadedAsset = result
        if (!active) { result.cleanup(); return }
        setAsset(result)
        setLoadState({ status: 'ready', progress: 1, error: '' })
        invalidate()
      })
      .catch((error) => active && setLoadState({ status: 'error', progress: null, error: error?.message || '模型读取失败' }))
    return () => { active = false; loadedAsset?.cleanup() }
  }, [object.modelAssetId, object.modelSource, object.modelFormat, gl, invalidate])
  const model = useMemo(() => {
    if (!asset?.source) return null
    const cloned = cloneSkeleton(asset.source)
    cloned.traverse((child) => { if (child.isMesh && child.material) child.material = Array.isArray(child.material) ? child.material.map((material) => material.clone()) : child.material.clone() })
    return applyMeshSmoothing(cloned, object)
  }, [asset, object.modelNormalMode, object.creaseAngle])
  useEffect(() => () => { if (model) disposeObject3D(model) }, [model])
  useEffect(() => {
    if (!model) return
    const nodes = indexModelNodes(model)
    MODEL_NODE_REFS.set(object.id, nodes)
    return () => { if (MODEL_NODE_REFS.get(object.id) === nodes) MODEL_NODE_REFS.delete(object.id) }
  }, [model, object.id])
  const metrics = useMemo(() => model ? inspectModel(model) : null, [model])
  const layout = useMemo(() => metrics ? getModelLayout(object, metrics) : { scale: 1, offset: [0, 0, 0] }, [metrics, object.modelFitMode, object.sceneScale, object.modelTargetSize, object.modelPivotMode])
  useEffect(() => {
    if (!model || !metrics) return
    const largeModel = applyModelNodeSettings(model, object, metrics)
    if (object.modelBvhEnabled !== false) model.traverse((child) => {
      if (!child.isMesh || !child.geometry || child.geometry.boundsTree || (largeModel && child.geometry.attributes?.position?.count > 1000000)) return
      child.geometry.computeBoundsTree?.({ targetLeafSize: largeModel ? 30 : 10 })
    })
    invalidate()
  }, [model, metrics, object.modelHiddenNodes, object.modelShadowMode, object.modelMaterialOverride, object.roughness, object.metalness, object.transparent, object.opacity, object.alphaTest, object.depthWrite, object.doubleSided, object.castShadow, object.receiveShadow, object.modelNormalMode, object.modelBvhEnabled, invalidate])
  const animationRoot = useRef()
  const clips = asset?.animations || []
  const { actions, names } = useAnimations(clips, animationRoot)
  useEffect(() => { if (names.length && JSON.stringify(object.modelClips || []) !== JSON.stringify(names)) updateObject(object.id, { modelClips: names }, false) }, [names, object.id, object.modelClips, updateObject])
  useEffect(() => {
    if (!metrics) return
    const next = { ...metrics, hierarchy: undefined }
    const changed = JSON.stringify(object.modelMetrics || null) !== JSON.stringify(next) || JSON.stringify(object.modelHierarchy || []) !== JSON.stringify(metrics.hierarchy) || object.modelLoadState !== 'ready'
    if (changed) updateObject(object.id, { modelMetrics: next, modelHierarchy: metrics.hierarchy, modelHierarchyTruncated: metrics.hierarchyTruncated, modelFiles: asset?.files || object.modelFiles || [], modelLoadState: 'ready' }, false)
  }, [metrics, asset?.files, object.id, object.modelMetrics, object.modelHierarchy, object.modelFiles, object.modelLoadState, updateObject])
  useEffect(() => {
    if (object.modelLoadState === loadState.status && object.modelLoadError === loadState.error) return
    updateObject(object.id, { modelLoadState: loadState.status, modelLoadError: loadState.error }, false)
  }, [loadState.status, loadState.error, object.id, object.modelLoadState, object.modelLoadError, updateObject])
  useEffect(() => { const action = names.length ? actions[object.animationClipName || names[0]] : null; if (!action || object.animationClipEnabled === false) return; action.reset(); action.timeScale = object.animationClipSpeed ?? 1; action.setEffectiveWeight(object.animationClipWeight ?? 1); action.setLoop(object.animationClipLoop === 'once' ? THREE.LoopOnce : object.animationClipLoop === 'pingpong' ? THREE.LoopPingPong : THREE.LoopRepeat, object.animationClipLoop === 'once' ? 1 : Infinity); action.clampWhenFinished = object.animationClipLoop === 'once'; action.fadeIn(object.animationClipFade ?? 0.2).play(); return () => action.fadeOut(object.animationClipFade ?? 0.15) }, [actions, names, object.animationClipName, object.animationClipEnabled, object.animationClipSpeed, object.animationClipWeight, object.animationClipLoop, object.animationClipFade])
  return <group ref={ref} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onClick={(e) => {
    e.stopPropagation(); if (object.locked || useEditor.getState().sceneLocked) return; setSelected(object.id)
    const nodes = MODEL_NODE_REFS.get(object.id)
    const entry = nodes && [...nodes.entries()].find(([, node]) => node === e.object)
    if (entry) useModelSelection.getState().select(object.id, entry[0])
  }}>
    {model && <group ref={animationRoot} scale={layout.scale}><group position={layout.offset}><primitive object={model} /></group></group>}
    {!model && <Html center className={`model-load-label ${loadState.status}`}><span>{loadState.status === 'error' ? '模型加载失败' : `模型加载中${loadState.progress == null ? '' : ` ${Math.round(loadState.progress * 100)}%`}`}</span>{loadState.error && <small>{loadState.error}</small>}</Html>}
    <ImportedModelMaterialEffect root={model} effect={object.effects?.model || object.effects?.material} />
    {selectedId === object.id && <pointLight intensity={0.01} />}
  </group>
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
  const measuring = useMeasure((state) => state.mode !== 'off')
  const updateObject = useEditor((s) => s.updateObject)
  if (object.type === 'model') return <ImportedModel ref={ref} object={object} />
  if (object.type === 'flowPipe') return <FlowPipeObject ref={ref} object={measuring ? { ...object, pipeEditPoints: false } : object} selected={selectedId === object.id} shading={shading} onSelect={() => { if (useMeasure.getState().mode === 'off') setSelected(object.id) }} onUpdatePoints={(pipePoints) => updateObject(object.id, { pipePoints })} />
  if (object.type === 'reflector') return <ReflectorObject ref={ref} object={object} selected={selectedId === object.id} shading={shading} onSelect={() => { if (useMeasure.getState().mode === 'off') setSelected(object.id) }} />
  if (GPU_WATER_OBJECT_TYPES.has(object.type) && ['threeWater', 'gpuRippleWater'].includes(object.effects?.material?.type)) return <ThreeWaterObject ref={ref} object={object} selected={selectedId === object.id} shading={shading} onSelect={() => { if (useMeasure.getState().mode === 'off') setSelected(object.id) }} />
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

function ObjectAnnotation({ object }) {
  const type = object.annotationType || 'label'
  const text = object.annotationText || object.name
  const color = object.annotationColor || '#e17653'
  const background = object.annotationBackground || '#15191c'
  const backgroundOpacity = object.annotationBackgroundOpacity ?? 0.9
  const backgroundImage = object.annotationBackgroundImage || ''
  const backgroundSize = object.annotationBackgroundSize || 'cover'
  const textColor = object.annotationTextColor || '#f2f4f5'
  const fontSize = object.annotationFontSize ?? 10
  const fontWeight = object.annotationFontWeight ?? 600
  const radius = object.annotationRadius ?? 3
  const padding = object.annotationPadding ?? 8
  const size = object.annotationSize ?? 1
  const position = object.annotationOffset || [0, 1.2, 0]
  const [backgroundImageElement, setBackgroundImageElement] = useState(null)
  useEffect(() => {
    if (!backgroundImage) { setBackgroundImageElement(null); return undefined }
    let active = true
    const image = new Image()
    image.onload = () => active && setBackgroundImageElement(image)
    image.onerror = () => active && setBackgroundImageElement(null)
    image.src = backgroundImage
    return () => { active = false }
  }, [backgroundImage])
  const spriteTexture = useMemo(() => {
    if (type !== 'sprite') return null
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128
    const context = canvas.getContext('2d'); context.clearRect(0, 0, 512, 128); context.save(); context.globalAlpha = backgroundOpacity; context.beginPath(); context.roundRect(4, 4, 504, 120, Math.max(0, radius * 2)); context.clip(); context.fillStyle = background; context.fillRect(4, 4, 504, 120)
    if (backgroundImageElement) {
      const target = { x: 4, y: 4, width: 504, height: 120 }
      if (backgroundSize === 'stretch') context.drawImage(backgroundImageElement, target.x, target.y, target.width, target.height)
      else {
        const scale = backgroundSize === 'contain' ? Math.min(target.width / backgroundImageElement.width, target.height / backgroundImageElement.height) : Math.max(target.width / backgroundImageElement.width, target.height / backgroundImageElement.height)
        const width = backgroundImageElement.width * scale; const height = backgroundImageElement.height * scale
        context.drawImage(backgroundImageElement, target.x + (target.width - width) / 2, target.y + (target.height - height) / 2, width, height)
      }
    }
    context.restore(); context.fillStyle = color; context.fillRect(4, 4, 10, 120); context.fillStyle = textColor; context.font = `${fontWeight} ${Math.max(12, fontSize * 3.4)}px Arial`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text.slice(0, 24), 268, 64)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true
    return texture
  }, [type, text, color, background, backgroundOpacity, backgroundImageElement, backgroundSize, textColor, fontSize, fontWeight, radius])
  useEffect(() => () => spriteTexture?.dispose(), [spriteTexture])
  if (!object.annotationEnabled) return null
  if (type === 'sprite') return <sprite position={position} scale={[2.4 * size, 0.6 * size, 1]} raycast={() => null}><spriteMaterial map={spriteTexture} transparent depthTest={object.annotationOcclude !== false} /></sprite>
  const transform = type === 'css3d'
  const annotationScale = transform ? 1 : size
  const icon = type === 'icon'
  return <Html position={position} center transform={transform} sprite={transform} distanceFactor={transform ? 7 * size : undefined} occlude={object.annotationOcclude ? 'blending' : false} style={{ pointerEvents: 'none' }}>
    <div className={`object-annotation annotation-${type}`} style={{ '--annotation-color': color, '--annotation-scale': annotationScale, '--annotation-bg': background, '--annotation-bg-opacity': backgroundOpacity, '--annotation-bg-image': backgroundImage ? `url(${JSON.stringify(backgroundImage)})` : 'none', '--annotation-bg-size': backgroundSize === 'stretch' ? '100% 100%' : backgroundSize, '--annotation-text': textColor, '--annotation-font-size': `${fontSize}px`, '--annotation-font-weight': fontWeight, '--annotation-radius': `${radius}px`, '--annotation-padding': `${padding}px` }}><b className="annotation-background" aria-hidden="true" />{icon ? <MapPin size={15} /> : <><i /> <span>{text}</span></>}</div>
  </Html>
}

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
  const content = <><SceneObject ref={bindMesh} object={object} />{target && createPortal(<ObjectAnnotation object={object} />, target)}</>
  const measureMode = useMeasure((state) => state.mode)
  const sceneLocked = useEditor(s => s.sceneLocked)
  const transformEnabled = !sceneLocked && measureMode === 'off' && mode !== 'select' && selectedId === object.id && !object.locked && !(object.type === 'flowPipe' && object.pipeEditPoints)
  return <>{content}{target && transformEnabled && <TransformControls object={target} mode={mode} space={space} size={0.78} translationSnap={snap ? snapSize : null} rotationSnap={snap ? THREE.MathUtils.degToRad(15) : null} scaleSnap={snap ? 0.1 : null} onMouseUp={() => {
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
  const quality = useEditor((s) => s.postProcessingQuality)
  const shadowResolution = quality === 'high' ? 2048 : quality === 'performance' ? 512 : 1024
  const sceneSize = useEditor((s) => s.sceneSize)
  const cameraPosition = useEditor((s) => s.cameraPosition)
  const cameraTarget = useEditor((s) => s.cameraTarget)
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
      <directionalLight key={`main-shadow-${shadowResolution}`} position={keyLightDirection} color={keyLightColor} intensity={keyLightIntensity} castShadow={shadows} shadow-mapSize={[shadowResolution, shadowResolution]} />
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
      {projection === 'perspective' ? <PerspectiveCamera makeDefault position={cameraPosition} fov={cameraFov} near={cameraNear} far={cameraFar} /> : <OrthographicCamera makeDefault position={cameraPosition} zoom={72} near={cameraNear} far={cameraFar} />}
      <OrbitControls makeDefault target={cameraTarget} mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }} minDistance={Math.max(cameraNear * 2, 0.2)} maxDistance={Math.min(cameraFar * 0.8, Math.max(22, sceneSize * 1.5))} />
      <GizmoHelper alignment="bottom-right" margin={[76, 58]}><GizmoViewport axisColors={['#e35d35', '#6cac68', '#5c85c7']} labelColor="white" /></GizmoHelper>
    </>
  )
}

function PostProcessing() {
  const [, refreshOutlineRefs] = useState(0)
  const settings = useEditor(useShallow((s) => ({
    enabled: s.postProcessingEnabled, quality: s.postProcessingQuality,
    aoEnabled: s.aoEnabled, aoRadius: s.aoRadius, aoIntensity: s.aoIntensity, aoDistanceFalloff: s.aoDistanceFalloff, aoColor: s.aoColor,
    objects: s.objects, outlineEnabled: s.outlineEnabled, outlineEdgeStrength: s.outlineEdgeStrength, outlinePulseSpeed: s.outlinePulseSpeed, outlineVisibleEdgeColor: s.outlineVisibleEdgeColor, outlineHiddenEdgeColor: s.outlineHiddenEdgeColor, outlineBlur: s.outlineBlur, outlineXRay: s.outlineXRay,
    colorAdjustEnabled: s.colorAdjustEnabled, brightness: s.brightness, contrast: s.contrast, hue: s.hue, saturation: s.saturation,
    bloomEnabled: s.bloomEnabled, bloomIntensity: s.bloomIntensity, bloomThreshold: s.bloomThreshold, bloomSmoothing: s.bloomSmoothing,
    depthOfFieldEnabled: s.depthOfFieldEnabled, focusDistance: s.depthOfFieldFocusDistance, focalLength: s.depthOfFieldFocalLength, bokehScale: s.depthOfFieldBokehScale,
    vignetteEnabled: s.vignetteEnabled, vignetteOffset: s.vignetteOffset, vignetteDarkness: s.vignetteDarkness,
    chromaticAberrationEnabled: s.chromaticAberrationEnabled, chromaticAberrationOffset: s.chromaticAberrationOffset,
    noiseEnabled: s.noiseEnabled, noiseOpacity: s.noiseOpacity,
  })))
  const chromaticOffset = useMemo(() => new THREE.Vector2(settings.chromaticAberrationOffset, settings.chromaticAberrationOffset), [settings.chromaticAberrationOffset])
  const outlineBindingKey = settings.objects.map((object) => `${object.id}:${object.effects?.outline?.enabled ? 1 : 0}`).join('|')
  useEffect(() => {
    // Re-evaluate after object refs commit when a saved project opens with bindings already enabled.
    const frame = requestAnimationFrame(() => refreshOutlineRefs((version) => version + 1))
    return () => cancelAnimationFrame(frame)
  }, [outlineBindingKey])
  const outlineSelection = settings.objects
    .filter((object) => object.effects?.outline?.enabled)
    .map((object) => SCENE_OBJECT_REFS.get(object.id))
    .filter(Boolean)
  if (!settings.enabled) return null
  const multisampling = settings.quality === 'high' ? 8 : settings.quality === 'balanced' ? 2 : 0
  return <EffectComposer multisampling={multisampling} enableNormalPass={settings.depthOfFieldEnabled}>
    {settings.aoEnabled && <N8AO aoRadius={settings.aoRadius} intensity={settings.aoIntensity} distanceFalloff={settings.aoDistanceFalloff} color={settings.aoColor} quality={settings.quality === 'high' ? 'high' : settings.quality === 'performance' ? 'performance' : 'medium'} halfRes={settings.quality === 'performance'} />}
    {settings.outlineEnabled && outlineSelection.length > 0 && <Outline selection={outlineSelection} edgeStrength={settings.outlineEdgeStrength} pulseSpeed={settings.outlinePulseSpeed} visibleEdgeColor={settings.outlineVisibleEdgeColor} hiddenEdgeColor={settings.outlineHiddenEdgeColor} blur={settings.outlineBlur} xRay={settings.outlineXRay} />}
    {settings.colorAdjustEnabled && <BrightnessContrast brightness={settings.brightness} contrast={settings.contrast} />}
    {settings.colorAdjustEnabled && <HueSaturation hue={settings.hue} saturation={settings.saturation} />}
    {settings.bloomEnabled && <Bloom intensity={settings.bloomIntensity} luminanceThreshold={settings.bloomThreshold} luminanceSmoothing={settings.bloomSmoothing} mipmapBlur kernelSize={KernelSize.LARGE} />}
    {settings.depthOfFieldEnabled && <DepthOfField focusDistance={settings.focusDistance} focalLength={settings.focalLength} bokehScale={settings.bokehScale} />}
    {settings.chromaticAberrationEnabled && <ChromaticAberration offset={chromaticOffset} radialModulation modulationOffset={0.5} />}
    {settings.noiseEnabled && <Noise opacity={settings.noiseOpacity} blendFunction={BlendFunction.SOFT_LIGHT} />}
    {settings.vignetteEnabled && <Vignette eskil={false} offset={settings.vignetteOffset} darkness={settings.vignetteDarkness} />}
    {settings.quality === 'performance' && <FXAA />}
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>
}

function IconButton({ icon: Icon, label, active, disabled, onClick }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}><Icon size={16} strokeWidth={1.8} /></button>
}

function Toolbar() {
  const { sceneLocked, toggleSceneLock, mode, setMode, space, setSpace, snap, toggleSnap, snapSize, setSnapSize, history, future, undo, redo, duplicateSelected, deleteSelected, selectedId } = useEditor()
  return (
    <div className={`toolbar ${sceneLocked ? 'scene-locked' : ''}`}>
      <button className="scene-lock-toggle" title={sceneLocked ? '解锁整个场景' : '锁定整个场景'} aria-label={sceneLocked ? '解锁整个场景' : '锁定整个场景'} aria-pressed={sceneLocked} onClick={() => { toggleSceneLock(); useMeasure.getState().setMode('off'); useModelSelection.getState().clear() }}>{sceneLocked ? <Lock size={16} /> : <Unlock size={16} />}</button>
      <div className="tool-group"><IconButton icon={MousePointer2} label="选择" active={mode === 'select'} onClick={() => setMode('select')} /></div>
      <div className="tool-group">
        <IconButton icon={Move3D} label="移动 (W)" active={mode === 'translate'} onClick={() => setMode('translate')} />
        <IconButton icon={Rotate3D} label="旋转 (E)" active={mode === 'rotate'} onClick={() => setMode('rotate')} />
        <IconButton icon={Scaling} label="缩放 (R)" active={mode === 'scale'} onClick={() => setMode('scale')} />
      </div>
      <button className="space-switch" onClick={() => setSpace(space === 'world' ? 'local' : 'world')}>{space === 'world' ? '世界' : '局部'} <ChevronDown size={13} /></button>
      <div className="snap-control"><IconButton icon={Magnet} label="吸附" active={snap} onClick={toggleSnap} />{snap && <select value={snapSize} onChange={(e) => setSnapSize(Number(e.target.value))}><option value="0.1">0.1</option><option value="0.25">0.25</option><option value="0.5">0.5</option><option value="1">1.0</option></select>}</div>
      <div className="tool-spacer" />
      <div className="tool-group">
        <IconButton icon={Undo2} label="撤销" disabled={sceneLocked || !history.length} onClick={undo} />
        <IconButton icon={Redo2} label="重做" disabled={sceneLocked || !future.length} onClick={redo} />
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
    ['反射对象', [['reflector', BoxSelect, '镜面平面']]],
    ['曲面与管道', [['torus', Circle, '圆环'], ['ring', Circle, '圆环面'], ['pipe', Shapes, '基础管道'], ['flowPipe', Shapes, '流动管道'], ['torusKnot', Circle, '环面结']]],
    ['多面体', [['tetrahedron', Shapes, '四面体'], ['octahedron', Shapes, '八面体'], ['dodecahedron', Shapes, '十二面体'], ['icosahedron', Shapes, '二十面体']]],
    ['参数化', [['lathe', Shapes, '车削体']]],
  ]
  return <div className="add-menu">{groups.map(([group, items]) => <React.Fragment key={group}><div className="add-menu-label">{group}</div>{items.map(([type, Icon, label]) => <button key={type} onClick={() => { addObject(type); close() }}><Icon size={15} />{label}</button>)}</React.Fragment>)}<i /><div className="add-menu-label">外部模型</div><button className="model-import-action" onClick={() => { window.dispatchEvent(new Event('frame-import-model')); close() }}><Upload size={15} /><span><strong>按格式导入</strong><small>选择 Loader 与模型文件</small></span></button><div className="model-format-list"><b>GLB</b><span>glTF</span><span>FBX</span><span>OBJ</span><span>STL</span><span>PLY</span><span>DAE</span><span>3MF</span></div><button onClick={() => { addModel(MODEL_ASSETS[3]); close() }}><BoxSelect size={15} />加载示例模型</button></div>
}

function Header({ notify, showHelp, showExport, workspaceMode, onWorkspaceModeChange }) {
  const [open, setOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [modelImportOpen, setModelImportOpen] = useState(false)
  const [modelImportSettings, setModelImportSettings] = useState(DEFAULT_MODEL_IMPORT_SETTINGS)
  const fileRef = useRef()
  const modelRef = useRef()
  const { objects, loadScene, resetScene, addModel, sceneName } = useEditor()
  const exportScene = async () => {
    const exportedObjects = await Promise.all(objects.map(async (object) => object.modelAssetId ? { ...object, embeddedModelAsset: await serializeModelAsset(object.modelAssetId) } : object))
    const blob = new Blob([JSON.stringify({ version: 4, objects: exportedObjects, editor: readEditorSettings(), particles: serializeFeatureSettings(useParticles.getState()), sceneEffects: serializeFeatureSettings(useSceneEffects.getState()), settings: readSceneSettings(), interaction: { roaming: readRoamingSettings() } }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'frame-scene.json'; a.click(); URL.revokeObjectURL(url); notify('场景 JSON 已导出')
  }
  const importScene = async (file) => { try { const data = JSON.parse(await file.text()); await Promise.all((data.objects || []).map((object) => object.embeddedModelAsset ? restoreModelAsset(object.embeddedModelAsset) : null)); if (!loadScene(data)) { notify('文件中没有有效场景'); return }; if (data.interaction?.roaming) useRoaming.getState().setSetting(data.interaction.roaming); applyEditorSettings(data.editor); if (data.particles) useParticles.getState().patch(data.particles); if (data.sceneEffects) useSceneEffects.getState().patch(data.sceneEffects); notify('场景导入成功') } catch { notify('无法读取这个 JSON 文件') } }
  const importModel = async (files, requestedFormat) => {
    const selectedFiles = [...files]
    const file = selectedFiles.find((entry) => normalizeModelFormat(entry.name) === requestedFormat)
    if (!file) { notify(`请选择一个 .${requestedFormat} 主模型文件`); return }
    const format = normalizeModelFormat(file.name)
    if (!MODEL_FORMATS[format]) { notify(`不支持 .${format}，请使用 GLB、glTF、FBX、OBJ、STL、PLY、DAE 或 3MF`); return }
    if (requestedFormat && requestedFormat !== format) { notify(`已选择 ${MODEL_FORMATS[requestedFormat].label} Loader，请选择 .${requestedFormat} 文件`); return }
    const totalSize = selectedFiles.reduce((sum, entry) => sum + entry.size, 0)
    if (totalSize > 512 * 1024 * 1024) { notify('模型资源包不能超过 512 MB'); return }
    try {
      const asset = await saveModelAsset(selectedFiles, file.name)
      addModel({ name: file.name.replace(/\.[^.]+$/i, ''), source: `asset://${asset.id}/${asset.mainFile}`, assetId: asset.id, files: asset.files.map(({ name, size, type }) => ({ name, size, type })), format, ...modelImportSettings })
      notify(`${MODEL_FORMATS[format].label} 模型已加入场景`)
    } catch (error) { notify(error?.message || '模型文件读取失败') }
  }
  const chooseModelFormat = (format) => {
    if (!modelRef.current) return
    modelRef.current.accept = `.${format},.bin,.mtl,.png,.jpg,.jpeg,.webp,.ktx2,.basis,.tga,.bmp`
    modelRef.current.dataset.format = format
    setModelImportOpen(false)
    modelRef.current.click()
  }
  useEffect(() => { const openImporter = () => setModelImportOpen(true); window.addEventListener('frame-import-model', openImporter); return () => window.removeEventListener('frame-import-model', openImporter) }, [])
  const capture = () => { const canvas = document.querySelector('.viewport canvas'); if (!canvas) return; const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'frame-viewport.png'; a.click(); notify('视口截图已保存') }
  return <header className="header">
    <div className="brand-mark"><span>F</span></div><div className="brand"><strong>FRAME</strong><small>THREE EDITOR</small></div>
    <div className="workspace-switch" aria-label="编辑工作区">
      <button className={workspaceMode === 'scene' ? 'active' : ''} onClick={() => onWorkspaceModeChange('scene')}><BoxSelect size={13} /><span>3D 场景</span></button>
      <button className={workspaceMode === 'ui' ? 'active' : ''} onClick={() => onWorkspaceModeChange('ui')}><LayoutTemplate size={13} /><span>UI 画布</span></button>
    </div>
    <div className="main-menu">
      <div className="menu-wrap"><button onClick={() => setFileOpen(!fileOpen)}>文件</button>{fileOpen && <div className="file-menu">
        <button onClick={() => fileRef.current?.click()}><Upload size={14} />导入场景 <kbd>JSON</kbd></button>
        <button onClick={() => { setModelImportOpen(true); setFileOpen(false) }}><BoxSelect size={14} />导入模型 <kbd>选择格式</kbd></button>
        <button onClick={exportScene}><FileJson size={14} />导出场景 JSON <kbd>JSON</kbd></button>
        <button onClick={() => { try { const restored = restoreSceneBeforeNova(); notify(restored ? '已恢复加载示例前的场景' : '暂无场景备份'); setFileOpen(false) } catch { notify('无法读取场景备份') } }}><Undo2 size={14} />恢复示例前的场景</button>
        <button onClick={capture}><ImageDown size={14} />视口截图 <kbd>PNG</kbd></button>
        <i />
        <button className="danger" onClick={() => { resetScene(); setFileOpen(false); notify('已恢复示例场景') }}><Trash2 size={14} />重置场景</button>
      </div>}</div>
    </div>
    <input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={(e) => e.target.files[0] && importScene(e.target.files[0])} />
    <input ref={modelRef} data-model-import className="file-input" type="file" multiple onChange={(e) => { if (e.target.files.length) importModel(e.target.files, e.target.dataset.format); e.target.value = '' }} />
    {modelImportOpen && <div className="model-import-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModelImportOpen(false) }}><div className="model-import-dialog model-import-dialog-wide" role="dialog" aria-modal="true" aria-label="选择模型格式"><div className="model-import-head"><div><strong>导入模型资源包</strong><small>可同时选择主模型、BIN、MTL 与纹理文件</small></div><button title="关闭" onClick={() => setModelImportOpen(false)}><X size={16} /></button></div><div className="model-import-options"><div><label>尺寸模式</label><div className="model-segment"><button className={modelImportSettings.modelFitMode === 'auto' ? 'active' : ''} onClick={() => setModelImportSettings((value) => ({ ...value, modelFitMode: 'auto' }))}>自动适配</button><button className={modelImportSettings.modelFitMode === 'source' ? 'active' : ''} onClick={() => setModelImportSettings((value) => ({ ...value, modelFitMode: 'source' }))}>保留原单位</button></div></div><div><label>SceneScale</label><NumberInput min="0.000001" step="0.01" precision={6} value={modelImportSettings.sceneScale} onValueChange={(sceneScale) => setModelImportSettings((value) => ({ ...value, sceneScale: Math.max(0.000001, sceneScale) }))} /></div>{modelImportSettings.modelFitMode === 'auto' && <div><label>目标尺寸</label><NumberInput min="0.01" step="0.1" precision={2} value={modelImportSettings.modelTargetSize} onValueChange={(modelTargetSize) => setModelImportSettings((value) => ({ ...value, modelTargetSize: Math.max(0.01, modelTargetSize) }))} /></div>}<div><label>轴心处理</label><select value={modelImportSettings.modelPivotMode} onChange={(e) => setModelImportSettings((value) => ({ ...value, modelPivotMode: e.target.value }))}><option value="center">中心</option><option value="ground">底部落地</option><option value="origin">保留原点</option></select></div></div><div className="model-import-grid">{Object.entries(MODEL_FORMATS).map(([format, definition]) => <button key={format} className={definition.recommended ? 'recommended' : ''} onClick={() => chooseModelFormat(format)}><span className="model-format-icon">{definition.label.slice(0, 3).toUpperCase()}</span><span><strong>{definition.label}{definition.recommended && <em>推荐</em>}</strong><small>{definition.description}</small><code>.{format}</code></span><ChevronDown size={14} /></button>)}</div><div className="model-import-note"><Check size={14} /><span>GLB 可单文件导入；glTF、OBJ 建议在文件选择器中一起选择依赖文件。</span></div></div></div>}
    <div className="project-title"><span className="status-dot" /> {sceneName} <span className="save-state">已保存</span></div>
    <div className="header-actions">
      {workspaceMode === 'scene' && <button className="nova-scene-button" disabled={useEditor.getState().sceneLocked} onClick={() => { try { loadNovaScene(); notify('NOVA 机械试验场已加载，原场景已备份') } catch (error) { notify(`示例加载失败：${error.message}`) } }}><Shapes size={15} /><span>NOVA 示例</span></button>}
      {workspaceMode === 'scene' && <div className="add-wrap"><button className="add-button" onClick={() => setOpen(!open)}><Plus size={15} /> 添加对象 <ChevronDown size={13} /></button>{open && <AddMenu close={() => setOpen(false)} />}</div>}
      <button className="export-button" onClick={showExport}><Download size={15} /> 导出项目</button>
      <IconButton icon={HelpCircle} label="快捷键帮助" onClick={showHelp} />
    </div>
  </header>
}

function SceneTree({ onCollapse }) {
  const [query, setQuery] = useState('')
  const [assetTab, setAssetTab] = useState('全部')
  const [contextMenu, setContextMenu] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  const startRename = (id) => {
    const object = useEditor.getState().objects.find((item) => item.id === id)
    if (object && !object.locked && !useEditor.getState().sceneLocked) { setDraftName(object.name); setRenamingId(id) }
  }
  const finishRename = () => {
    if (renamingId && draftName.trim()) useEditor.getState().updateObject(renamingId, { name: draftName.trim() })
    setRenamingId(null)
  }
  const openContextMenu = (event, id) => {
    event.preventDefault()
    if (useEditor.getState().sceneLocked) return
    useEditor.getState().setSelected(id)
    const rect = event.currentTarget.getBoundingClientRect()
    setContextMenu({ id, x: event.clientX || rect.left + 20, y: event.clientY || rect.bottom })
  }
  const { objects, selectedId, setSelected, updateObject, addObject, addModel } = useEditor()
  const filtered = objects.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
  return <aside className="left-panel panel">
    <div className="panel-heading"><span>场景</span><div className="panel-heading-actions"><IconButton icon={Plus} label="添加立方体" onClick={() => addObject('box')} /><IconButton icon={PanelLeftClose} label="收起左侧栏" onClick={onCollapse} /></div></div>
    <div className="tree-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对象" />{query && <X size={12} onClick={() => setQuery('')} />}</div>
    <div className="tree-root"><ChevronDown size={13} /><BoxSelect size={14} /><span>场景集合</span><small>{objects.length}</small></div>
    <div className="tree-list">{!filtered.length && <div className="tree-empty">{query ? '没有匹配的对象' : '场景为空，点击 + 添加对象'}</div>}{filtered.map((o) => renamingId === o.id ? <div key={o.id} className="tree-rename"><Pencil size={13} /><input autoFocus aria-label="对象名称" value={draftName} onFocus={(event) => event.target.select()} onChange={(event) => setDraftName(event.target.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }; if (event.key === 'Escape') { event.preventDefault(); setRenamingId(null) } }} /></div> : <button key={o.id} aria-label={o.name} className={`tree-item ${selectedId === o.id ? 'selected' : ''} ${o.locked ? 'locked' : ''}`} onClick={() => setSelected(o.id)} onDoubleClick={() => startRename(o.id)} onContextMenu={(event) => openContextMenu(event, o.id)} onKeyDown={(event) => { if (event.key === 'F2') { event.preventDefault(); startRename(o.id) }; if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openContextMenu(event, o.id) }}>
      <span className="tree-indent" />{o.type === 'sphere' || o.type === 'torus' ? <Circle size={13} /> : <Box size={13} />}<span>{o.name}</span>
      <span className="tree-actions"><i onClick={(e) => { e.stopPropagation(); updateObject(o.id, { visible: !o.visible }) }}>{o.visible ? <Eye size={13} /> : <EyeOff size={13} />}</i></span>
    </button>)}</div>
    {contextMenu && <SceneObjectMenu objectId={contextMenu.id} anchor={contextMenu} onClose={closeContextMenu} onRename={startRename} />}
    <div className="assets-heading"><span>资源</span><span>{assetTab}</span></div>
    <div className="asset-tabs">{['全部','模型','材质'].map((tab) => <button key={tab} className={assetTab === tab ? 'active' : ''} onClick={() => setAssetTab(tab)}>{tab}</button>)}</div>
    {assetTab !== '材质' ? <div className="asset-library">{MODEL_ASSETS.map((asset, index) => <button key={asset.source} className="asset-item" onClick={() => addModel(asset)} title={`添加 ${asset.name}`}><span className={`asset-glyph asset-glyph-${index}`}><BoxSelect size={15} /></span><span><strong>{asset.name}</strong><small>{asset.category}{asset.animated ? ' · 自动播放' : ''}</small></span><Plus size={12} /></button>)}</div> : <div className="asset-empty"><Shapes size={22} /><span>暂无材质资源</span><small>可在检查器中导入图片贴图</small></div>}
  </aside>
}

function VectorInput({ label, value, onChange }) {
  const axes = ['X', 'Y', 'Z']
  return <div className="property-row vector-row"><label>{label}</label><div className="vector-inputs">{axes.map((axis, i) => <div key={axis}><span className={`axis axis-${axis.toLowerCase()}`}>{axis}</span><NumberInput step="0.1" precision={2} value={value[i]} onValueChange={(number) => { const next = [...value]; next[i] = number; onChange(next) }} /></div>)}</div></div>
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
  const [activeInspector, setActiveInspector] = useState(() => { const panel = new URLSearchParams(window.location.search).get('panel'); return ['object', 'scene', 'post', 'interaction', 'animation', 'physics', 'particles', 'effects', 'measure', 'history'].includes(panel) ? panel : 'object' })
  const [sectionsExpanded, setSectionsExpanded] = useState(true)
  const { objects, selectedId, updateObject, sceneLocked } = useEditor()
  const object = objects.find((o) => o.id === selectedId)
  const objectMaterialEffect = object && GPU_WATER_OBJECT_TYPES.has(object.type) ? object.effects?.material?.type : null
  const usesGpuRippleWater = ['threeWater', 'gpuRippleWater'].includes(objectMaterialEffect)
  const changeInspector = (panel) => {
    setActiveInspector(panel)
    const params = new URLSearchParams(window.location.search)
    params.set('panel', panel)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }
  const toggleSections = () => {
    const next = !sectionsExpanded
    setSectionsExpanded(next)
    window.dispatchEvent(new CustomEvent('frame-inspector-sections', { detail: next }))
  }
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('frame-inspector-sections', { detail: sectionsExpanded }))
  }, [activeInspector])
  if (sceneLocked) return <aside className="right-panel panel"><div className="panel-heading"><span>检查器</span><IconButton icon={PanelRightClose} label="收起右侧栏" onClick={onCollapse} /></div><div className="scene-lock-notice"><Lock size={28} /><strong>整个场景已锁定</strong><p>所有对象均不可选中或编辑，仍可旋转、平移和缩放视角。</p><button onClick={() => useEditor.getState().toggleSceneLock()}>解锁场景</button></div></aside>
  return <aside className="right-panel panel">
    <div className="panel-heading"><span>检查器</span><div className="panel-heading-actions"><IconButton icon={sectionsExpanded ? ChevronsUp : ChevronsDown} label={sectionsExpanded ? '全部收起' : '全部展开'} onClick={toggleSections} /><IconButton icon={PanelRightClose} label="收起右侧栏" onClick={onCollapse} /></div></div>
    <div className="inspector-navigation" role="group" aria-label="检查面板">{[['object', '对象'], ['scene', '场景'], ['post', '后期'], ['animation', '动画'], ['physics', '物理'], ['particles', '粒子'], ['effects', '特效'], ['interaction', '交互'], ['measure', '测量'], ['history', '历史']].map(([id, label]) => <button key={id} type="button" aria-pressed={activeInspector === id} className={activeInspector === id ? 'active' : ''} onClick={() => changeInspector(id)}>{label}</button>)}</div>
    {activeInspector === 'measure' ? <MeasurePanel /> : activeInspector === 'history' ? <HistoryPanel /> : activeInspector === 'scene' ? <SceneInspector /> : activeInspector === 'post' ? <PostProcessingPanel /> : activeInspector === 'animation' ? <AnimationPanel /> : activeInspector === 'physics' ? <PhysicsPanel /> : activeInspector === 'particles' ? <ParticlePanel /> : activeInspector === 'effects' ? <SceneEffectPanel /> : activeInspector === 'interaction' ? <RoamingPanel /> : !object ? <div className="no-selection"><MousePointer2 size={24} /><span>选择一个对象</span></div> : <>
    <div className="object-title"><div className="object-icon"><Box size={16} /></div><div><input value={object.name} onChange={(e) => updateObject(object.id, { name: e.target.value }, false)} /><small>{object.type.toUpperCase()} / {object.id.slice(-6)}</small></div></div>
    <CollapsibleSection><h3><ChevronDown size={13} /> 变换</h3>
      <VectorInput label="位置" value={object.position} onChange={(position) => updateObject(object.id, { position })} />
      <VectorInput label="旋转" value={object.rotation} onChange={(rotation) => updateObject(object.id, { rotation })} />
      <VectorInput label="缩放" value={object.scale} onChange={(scale) => updateObject(object.id, { scale })} />
    </CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 几何体</h3><div className="property-row"><label>类型</label><div className="readout">{object.type}</div></div></CollapsibleSection>
    {object.type === 'flowPipe' && <FlowPipeInspector object={object} updateObject={updateObject} />}
    {object.type === 'model' ? <ImportedModelControls object={object} updateObject={updateObject} /> : object.type === 'reflector' ? <ReflectorControls object={object} updateObject={updateObject} /> : <CollapsibleSection><h3><ChevronDown size={13} /> 材质 {usesGpuRippleWater && <span className="object-effect-badge">THREE WATER</span>}</h3>
      {usesGpuRippleWater ? <div className="material-effect-status"><span>Three.js Water 水体</span><small>WATER / OBJECT GEOMETRY</small></div> : <>
        <div className="property-row"><label>颜色</label><div className="color-control"><input type="color" value={object.color} onChange={(e) => updateObject(object.id, { color: e.target.value })} /><input value={object.color.toUpperCase()} readOnly /></div></div>
        <Slider label="粗糙度" value={object.roughness} onChange={(roughness) => updateObject(object.id, { roughness })} />
        <Slider label="金属度" value={object.metalness} onChange={(metalness) => updateObject(object.id, { metalness })} />
        <RangeSetting label="环境反射" value={object.envMapIntensity ?? 1} min={0} max={3} step={0.05} onChange={(envMapIntensity) => updateObject(object.id, { envMapIntensity })} />
        <MaterialTransparencyControls object={object} updateObject={updateObject} />
        <TextureControl object={object} updateObject={updateObject} />
      </>}
    </CollapsibleSection>}
    <ObjectEffectsInspector object={object} updateObject={updateObject} />
    {!['model', 'reflector'].includes(object.type) && <SmoothingControls object={object} updateObject={updateObject} />}
    <AnnotationControls object={object} updateObject={updateObject} />
    <CollapsibleSection><h3><ChevronDown size={13} /> 显示</h3><ToggleRow label="投射阴影" value={object.castShadow !== false} onChange={(castShadow) => updateObject(object.id, { castShadow })} /><ToggleRow label="接收阴影" value={object.receiveShadow !== false} onChange={(receiveShadow) => updateObject(object.id, { receiveShadow })} /></CollapsibleSection>
    </>}
  </aside>
}

function ReflectorControls({ object, updateObject }) {
  const mirror = { ...DEFAULT_REFLECTOR, ...(object.mirror || {}) }
  const patch = (values) => updateObject(object.id, { mirror: { ...mirror, ...values } })
  return <CollapsibleSection className="object-mirror-section"><h3><ChevronDown size={13} /> Reflector 镜面 <span className="object-effect-badge">独立平面</span></h3>
    <div className="material-effect-status mirror-status"><span>Three.js Reflector</span><small>PLANE / RENDER TARGET</small></div>
    <div className="object-water-settings object-mirror-settings">
      <RangeSetting label="不透明度" value={mirror.opacity} min={0} max={1} step={0.01} digits={2} hardMax onChange={(opacity) => patch({ opacity })} />
      <ColorSetting label="反射着色" value={mirror.color} onChange={(color) => patch({ color })} />
      <RangeSetting label="裁剪偏移" value={mirror.clipBias} min={0} max={0.05} step={0.001} digits={3} hardMax onChange={(clipBias) => patch({ clipBias })} />
      <div className="object-effect-resolution"><span>反射分辨率</span><div>{[256, 512, 1024].map((value) => <button key={value} className={mirror.resolution === value ? 'active' : ''} onClick={() => patch({ resolution: value })}>{value}</button>)}</div></div>
      <div className="object-effect-resolution"><span>MSAA</span><div>{[0, 2, 4, 8].map((value) => <button key={value} className={mirror.multisample === value ? 'active' : ''} onClick={() => patch({ multisample: value })}>{value}</button>)}</div></div>
    </div>
  </CollapsibleSection>
}

function ImportedModelControls({ object, updateObject }) {
  const metrics = object.modelMetrics
  const patch = (values) => updateObject(object.id, values)
  return <CollapsibleSection className="model-inspector"><h3><ChevronDown size={13} /> 导入模型 <span className="format-badge">{(object.modelFormat || 'glb').toUpperCase()}</span></h3>
    <div className="model-source"><BoxSelect size={16} /><div><strong>{object.name}</strong><small>{object.modelLoadState === 'error' ? object.modelLoadError || '模型加载失败' : object.modelLoadState === 'loading' ? '正在解析模型资源' : `${object.modelFiles?.length || 1} 个文件 · ${object.modelClips?.length || 0} 段动画`}</small>{object.attribution && <small>{object.attribution}</small>}</div></div>
    <div className="texture-section-head"><span>尺寸与轴心</span><span className="material-hint">MODEL SPACE</span></div>
    <div className="property-row"><label>尺寸模式</label><div className="model-segment compact"><button className={(object.modelFitMode || 'auto') === 'auto' ? 'active' : ''} onClick={() => patch({ modelFitMode: 'auto' })}>自动适配</button><button className={object.modelFitMode === 'source' ? 'active' : ''} onClick={() => patch({ modelFitMode: 'source' })}>原单位</button></div></div>
    <div className="property-row"><label>SceneScale</label><NumberInput min="0.000001" step="0.01" precision={6} value={object.sceneScale ?? 1} onValueChange={(sceneScale) => patch({ sceneScale: Math.max(0.000001, sceneScale) })} /></div>
    {(object.modelFitMode || 'auto') === 'auto' && <RangeSetting label="目标尺寸" value={object.modelTargetSize ?? 1.8} min={0.1} max={20} hardMax={10000} step={0.1} onChange={(modelTargetSize) => patch({ modelTargetSize })} />}
    <div className="property-row"><label>轴心</label><select value={object.modelPivotMode || 'center'} onChange={(e) => patch({ modelPivotMode: e.target.value })}><option value="center">包围盒中心</option><option value="ground">底部落地</option><option value="origin">模型原点</option></select></div>
    <div className="texture-section-head"><span>几何与性能</span><span className="material-hint">RUNTIME</span></div>
    <div className="property-row"><label>法线</label><select value={object.modelNormalMode || 'source'} onChange={(e) => patch({ modelNormalMode: e.target.value })}><option value="source">保留源法线</option><option value="smooth">重算平滑</option><option value="flat">平面着色</option></select></div>
    <div className="property-row"><label>阴影策略</label><select value={object.modelShadowMode || 'auto'} onChange={(e) => patch({ modelShadowMode: e.target.value })}><option value="auto">大型模型自动降级</option><option value="all">投射并接收</option><option value="receive">仅接收</option><option value="none">关闭</option></select></div>
    <ToggleRow label="BVH 加速拾取" value={object.modelBvhEnabled !== false} onChange={(modelBvhEnabled) => patch({ modelBvhEnabled })} />
    <ToggleRow label="覆盖源材质参数" value={Boolean(object.modelMaterialOverride)} onChange={(modelMaterialOverride) => patch({ modelMaterialOverride })} />
    {object.modelMaterialOverride && <><Slider label="粗糙度" value={object.roughness ?? 0.5} onChange={(roughness) => patch({ roughness })} /><Slider label="金属度" value={object.metalness ?? 0} onChange={(metalness) => patch({ metalness })} /></>}
    <MaterialTransparencyControls object={object} updateObject={updateObject} />
    {metrics && <><div className="texture-section-head"><span>模型信息</span><span className="material-hint">INSPECT</span></div><div className="model-metrics"><span><b>{metrics.meshCount}</b>网格</span><span><b>{Number(metrics.triangleCount || 0).toLocaleString()}</b>三角面</span><span><b>{metrics.maxDimension?.toFixed(3)}</b>源尺寸</span></div></>}
    {object.modelHierarchy?.length > 0 && <ModelHierarchyPanel object={object} updateObject={updateObject} />}
  </CollapsibleSection>
}

function MaterialTransparencyControls({ object, updateObject }) {
  const patch = (values) => updateObject(object.id, values)
  return <div className="material-transparency"><div className="texture-section-head"><span>透明与表面</span><span className="material-hint">Alpha / Depth</span></div><ToggleRow label="启用透明" value={Boolean(object.transparent)} onChange={(transparent) => patch({ transparent })} /><RangeSetting label="不透明度" value={object.opacity ?? 1} min={0} max={1} step={0.01} onChange={(opacity) => patch({ opacity, transparent: opacity < 1 ? true : object.transparent })} /><RangeSetting label="Alpha 裁切" value={object.alphaTest ?? 0} min={0} max={1} step={0.01} onChange={(alphaTest) => patch({ alphaTest })} /><ToggleRow label="深度写入" value={object.depthWrite !== false} onChange={(depthWrite) => patch({ depthWrite })} /><ToggleRow label="双面渲染" value={Boolean(object.doubleSided)} onChange={(doubleSided) => patch({ doubleSided })} /></div>
}

function ObjectEffectsInspector({ object, updateObject }) {
  const updateScene = useEditor((state) => state.updateScene)
  const effects = object.effects || {}
  const material = effects.material || {}
  const water = { ...DEFAULT_THREE_WATER, ...material }
  const supportsMaterialEffects = GPU_WATER_OBJECT_TYPES.has(object.type)
  const waterEnabled = supportsMaterialEffects && ['threeWater', 'gpuRippleWater'].includes(material.type)
  const outlineEnabled = Boolean(effects.outline?.enabled)
  const activeCount = Number(waterEnabled) + Number(outlineEnabled)
  const patchEffect = (name, values) => updateObject(object.id, {
    effects: { ...effects, [name]: { ...(effects[name] || {}), ...values } },
  })
  const toggleOutline = (enabled) => {
    patchEffect('outline', { enabled })
    if (enabled) updateScene({ postProcessingEnabled: true, outlineEnabled: true })
  }
  const toggleMaterial = (type) => patchEffect('material', type === 'threeWater'
    ? { ...DEFAULT_THREE_WATER, type }
    : { ...material, type: 'standard' })
  const patchWater = (values) => patchEffect('material', { ...values, type: 'threeWater' })

  return <CollapsibleSection className="object-effects-section">
    <h3><ChevronDown size={13} /> 对象效果 <span>{activeCount}</span></h3>
    <EffectControls label="对象轮廓 · Outline" enabled={outlineEnabled} onToggle={toggleOutline}>
      <div className="object-effect-binding"><i />BOUND TO {object.name}</div>
    </EffectControls>
    {supportsMaterialEffects && <div className={`object-material-effect ${waterEnabled ? 'enabled' : ''}`}>
      <div className="object-effect-heading"><span>表面材质</span><small>OBJECT MATERIAL</small></div>
      <div className="mode-segments object-effect-mode">
        <button className={!waterEnabled ? 'active' : ''} onClick={() => toggleMaterial('standard')}>标准材质</button>
        <button className={waterEnabled ? 'active' : ''} onClick={() => toggleMaterial('threeWater')}>Three Water</button>
      </div>
      {waterEnabled && <div className="object-water-settings">
        <ColorSetting label="水体颜色" value={water.color} onChange={(color) => patchWater({ color })} />
        <RangeSetting label="不透明度" value={water.opacity} min={0} max={1} step={0.01} digits={2} hardMax onChange={(opacity) => patchWater({ opacity })} />
        <RangeSetting label="反射扰动" value={water.distortionScale} min={0} max={10} step={0.1} hardMax onChange={(distortionScale) => patchWater({ distortionScale })} />
        <RangeSetting label="波纹密度" value={water.waveScale} min={1} max={40} step={0.5} hardMax onChange={(waveScale) => patchWater({ waveScale })} />
        <RangeSetting label="流动速度" value={water.speed} min={0} max={3} step={0.05} hardMax onChange={(speed) => patchWater({ speed })} />
        <ColorSetting label="太阳颜色" value={water.sunColor} onChange={(sunColor) => patchWater({ sunColor })} />
        <RangeSetting label="太阳强度" value={water.sunIntensity} min={0} max={2} step={0.05} hardMax onChange={(sunIntensity) => patchWater({ sunIntensity })} />
        <RangeSetting label="裁剪偏移" value={water.clipBias} min={0} max={0.05} step={0.001} digits={3} hardMax onChange={(clipBias) => patchWater({ clipBias })} />
        <div className="object-effect-resolution"><span>反射分辨率</span><div>{[256, 512, 1024].map((value) => <button key={value} className={water.resolution === value ? 'active' : ''} onClick={() => patchWater({ resolution: value })}>{value}</button>)}</div></div>
      </div>}
    </div>}
  </CollapsibleSection>
}

function SmoothingControls({ object, updateObject }) {
  const smooth = object.smoothShading ?? object.pipeSmooth ?? true
  const creaseAngle = object.creaseAngle ?? object.pipeCreaseAngle ?? 60
  const patch = (values) => updateObject(object.id, { ...values, ...(object.type === 'flowPipe' ? { pipeSmooth: values.smoothShading ?? object.pipeSmooth, pipeCreaseAngle: values.creaseAngle ?? object.pipeCreaseAngle } : {}) })
  return <CollapsibleSection className="smoothing-section"><h3><ChevronDown size={13} /> 法线与光滑</h3><ToggleRow label="smoothShading · 光滑组" value={smooth} onChange={(smoothShading) => patch({ smoothShading })} />{smooth && <RangeSetting label="creaseAngle · 平滑夹角" value={creaseAngle} min={0} max={180} step={1} digits={0} suffix="°" hardMax onChange={(creaseAngle) => patch({ creaseAngle })} />}</CollapsibleSection>
}

function AnnotationControls({ object, updateObject }) {
  const backgroundInputRef = useRef()
  const [backgroundError, setBackgroundError] = useState('')
  const patch = (values) => updateObject(object.id, values)
  const type = object.annotationType || 'label'
  const uploadBackground = (file) => {
    if (!file?.type.startsWith('image/')) { setBackgroundError('请选择 PNG、JPG、WEBP 或 AVIF 图片'); return }
    if (file.size > 3 * 1024 * 1024) { setBackgroundError('背景图不能超过 3 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { patch({ annotationBackgroundImage: reader.result, annotationBackgroundImageName: file.name }); setBackgroundError('') }
    reader.onerror = () => setBackgroundError('背景图读取失败')
    reader.readAsDataURL(file)
  }
  return <CollapsibleSection className="annotation-section" defaultOpen={false}><h3><ChevronDown size={13} /> 标注 · Annotation</h3>
    <ToggleRow label="annotationEnabled · 启用" value={Boolean(object.annotationEnabled)} onChange={(annotationEnabled) => patch({ annotationEnabled })} />
    {object.annotationEnabled && <>
      <div className="property-row"><label>annotationType · 类型</label><select value={type} onChange={(e) => patch({ annotationType: e.target.value })}><option value="label">文字标签</option><option value="sprite">THREE.Sprite</option><option value="css2d">CSS2D 标签</option><option value="css3d">CSS3D 面板</option><option value="icon">图标标识</option></select></div>
      <div className="property-row"><label>annotationText · 内容</label><input className="annotation-text-input" value={object.annotationText ?? object.name} onChange={(e) => patch({ annotationText: e.target.value })} /></div>
      <VectorInput label="offset · 偏移" value={object.annotationOffset || [0, 1.2, 0]} onChange={(annotationOffset) => patch({ annotationOffset })} />
      <ColorSetting label="annotationColor · 颜色" value={object.annotationColor || '#e17653'} onChange={(annotationColor) => patch({ annotationColor })} />
      <ColorSetting label="background · 背景色" value={object.annotationBackground || '#15191c'} onChange={(annotationBackground) => patch({ annotationBackground })} />
      <div className={`annotation-background-image ${object.annotationBackgroundImage ? 'loaded' : ''}`}>
        <button className="annotation-background-upload" onClick={() => { setBackgroundError(''); backgroundInputRef.current?.click() }}>{object.annotationBackgroundImage ? <img src={object.annotationBackgroundImage} alt="标注背景预览" /> : <ImagePlus size={15} />}<span><strong>{object.annotationBackgroundImageName || '选择背景图'}</strong><small>PNG / JPG / WEBP / AVIF · 最大 3 MB</small></span></button>
        {object.annotationBackgroundImage && <button className="annotation-background-remove" title="移除背景图" onClick={() => patch({ annotationBackgroundImage: null, annotationBackgroundImageName: null })}><X size={12} /></button>}
        <input ref={backgroundInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => { uploadBackground(event.target.files[0]); event.target.value = '' }} />
      </div>
      {object.annotationBackgroundImage && <div className="property-row"><label>backgroundFit · 填充</label><select value={object.annotationBackgroundSize || 'cover'} onChange={(event) => patch({ annotationBackgroundSize: event.target.value })}><option value="cover">裁切铺满</option><option value="contain">完整显示</option><option value="stretch">拉伸填充</option></select></div>}
      {backgroundError && <div className="annotation-background-error">{backgroundError}</div>}
      <RangeSetting label="backgroundOpacity · 背景透明度" value={object.annotationBackgroundOpacity ?? 0.9} min={0} max={1} step={0.01} digits={2} onChange={(annotationBackgroundOpacity) => patch({ annotationBackgroundOpacity })} />
      <ColorSetting label="textColor · 文字色" value={object.annotationTextColor || '#f2f4f5'} onChange={(annotationTextColor) => patch({ annotationTextColor })} />
      <RangeSetting label="fontSize · 文字大小" value={object.annotationFontSize ?? 10} min={6} max={48} step={1} digits={0} onChange={(annotationFontSize) => patch({ annotationFontSize })} />
      <div className="property-row"><label>fontWeight · 字重</label><select value={object.annotationFontWeight ?? 600} onChange={(e) => patch({ annotationFontWeight: Number(e.target.value) })}><option value="400">常规 400</option><option value="500">中等 500</option><option value="600">半粗 600</option><option value="700">粗体 700</option></select></div>
      <RangeSetting label="radius · 圆角" value={object.annotationRadius ?? 3} min={0} max={24} step={1} digits={0} onChange={(annotationRadius) => patch({ annotationRadius })} />
      <RangeSetting label="padding · 内边距" value={object.annotationPadding ?? 8} min={0} max={24} step={1} digits={0} onChange={(annotationPadding) => patch({ annotationPadding })} />
      <RangeSetting label="annotationSize · 尺寸" value={object.annotationSize ?? 1} min={0.2} max={4} step={0.1} onChange={(annotationSize) => patch({ annotationSize })} />
      <ToggleRow label="occlude · 遮挡检测" value={object.annotationOcclude !== false} onChange={(annotationOcclude) => patch({ annotationOcclude })} />
    </>}
  </CollapsibleSection>
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
      <div className="texture-option-row"><label>旋转</label><NumberInput step="1" value={object.textureRotation ?? object.mapRotation ?? 0} onValueChange={(textureRotation) => updateObject(object.id, { textureRotation })} /><span>°</span></div>
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

function TexturePair({ label, value, min, step, onChange }) { return <div className="texture-pair"><label>{label}</label><div>{value.map((number, index) => <NumberInput key={index} min={min} step={step} value={number} onValueChange={(nextValue) => { const next = [...value]; next[index] = nextValue; onChange(next) }} />)}</div></div> }

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
  const outlineTargetCount = settings.objects.filter((object) => object.effects?.outline?.enabled).length
  return <div className="post-inspector"><div className="scene-summary post-summary"><div className="scene-orb"><Settings2 size={18} /></div><div><strong>后期处理栈</strong><small>屏幕空间效果 · 轮廓绑定 {outlineTargetCount} 个对象</small></div></div><PostProcessingInspector settings={settings} /></div>
}

function PostProcessingInspector({ settings }) {
  const { updateScene } = settings
  const activeCount = ['aoEnabled', 'outlineEnabled', 'colorAdjustEnabled', 'bloomEnabled', 'depthOfFieldEnabled', 'vignetteEnabled', 'chromaticAberrationEnabled', 'noiseEnabled'].filter((key) => settings[key]).length
  const applyPreset = (preset) => updateScene({ postProcessingEnabled: true, ...preset.values })
  return <CollapsibleSection className="post-processing-section">
    <h3><ChevronDown size={13} /> 后期处理 <span>{activeCount}</span></h3>
    <ToggleRow label="启用效果栈" value={settings.postProcessingEnabled} onChange={(postProcessingEnabled) => updateScene({ postProcessingEnabled })} />
    {settings.postProcessingEnabled && <>
      <div className="post-presets">{POST_PROCESSING_PRESETS.map((preset) => <button key={preset.id} onClick={() => applyPreset(preset)}>{preset.label}</button>)}</div>
      <div className="mode-segments quality-segments"><button aria-pressed={settings.postProcessingQuality === 'performance'} className={settings.postProcessingQuality === 'performance' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'performance' })}>性能</button><button aria-pressed={settings.postProcessingQuality === 'balanced'} className={settings.postProcessingQuality === 'balanced' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'balanced' })}>均衡</button><button aria-pressed={settings.postProcessingQuality === 'high'} className={settings.postProcessingQuality === 'high' ? 'active' : ''} onClick={() => updateScene({ postProcessingQuality: 'high' })}>高质量</button></div>
      <EffectControls label="环境光遮蔽 N8AO" enabled={settings.aoEnabled} onToggle={(aoEnabled) => updateScene({ aoEnabled })}>
        <RangeSetting label="radius · 作用范围" value={settings.aoRadius} min={0.05} max={10} step={0.05} onChange={(aoRadius) => updateScene({ aoRadius })} />
        <RangeSetting label="intensity · 遮蔽强度" value={settings.aoIntensity} min={0} max={8} step={0.05} onChange={(aoIntensity) => updateScene({ aoIntensity })} />
        <RangeSetting label="distanceFalloff · 距离衰减" value={settings.aoDistanceFalloff} min={0.01} max={5} step={0.01} onChange={(aoDistanceFalloff) => updateScene({ aoDistanceFalloff })} />
        <ColorSetting label="color · 遮蔽颜色" value={settings.aoColor} onChange={(aoColor) => updateScene({ aoColor })} />
      </EffectControls>
      <EffectControls label="轮廓样式 · Outline" enabled={settings.outlineEnabled} onToggle={(outlineEnabled) => updateScene({ outlineEnabled })}>
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
      {!normalized && <span className={`range-bound range-max ${fixed ? 'fixed' : 'editable'}`} title={fixed ? '固定最大值' : '可编辑建议最大值'}>{fixed ? Number(max).toFixed(digits) : <NumberInput aria-label={`${label} 最大值`} min={min + step} step={step} value={softMax} onValueChange={updateSoftMax} />}</span>}
    </div>
  </div>
}

function SceneVectorSetting({ label, value, onChange }) { return <VectorInput label={label} value={value} onChange={onChange} /> }

function NumberSetting({ label, values, onChange }) { return <div className="property-row dual-number"><label>{label}</label><div>{values.map((value, index) => <NumberInput key={index} step="1" value={value} onValueChange={(number) => { const next = [...values]; next[index] = number; onChange(next) }} />)}</div></div> }

function FocusController() {
  const { camera, controls } = useThree()
  const transition = useRef(null)
  useFrame(() => {
    if (!transition.current || !controls) return
    const current = transition.current
    const elapsed = Math.min(1, (performance.now() - current.startedAt) / 320)
    const eased = 1 - Math.pow(1 - elapsed, 3)
    controls.target.lerpVectors(current.fromTarget, current.toTarget, eased)
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased)
    if (camera.isOrthographicCamera) camera.zoom = THREE.MathUtils.lerp(current.fromZoom, current.toZoom, eased)
    camera.updateProjectionMatrix()
    controls.update()
    if (elapsed >= 1) transition.current = null
  })
  useEffect(() => {
    const frame = (event) => {
      if (!controls || useRoaming.getState().mode === 'manual') return
      const { objects, selectedId } = useEditor.getState()
      const all = event.type === 'frame-focus-all' || event.type === 'frame-camera-view'
      const candidates = objects.filter((object) => object.visible !== false && (all || object.id === (event.detail?.objectId || selectedId)))
      const bounds = new THREE.Box3()
      candidates.forEach((object) => {
        const root = event.detail?.nodePath ? MODEL_NODE_REFS.get(object.id)?.get(event.detail.nodePath) : SCENE_OBJECT_REFS.get(object.id)
        const box = root ? new THREE.Box3().setFromObject(root) : new THREE.Box3()
        if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(...object.position), new THREE.Vector3(...(object.scale || [1, 1, 1])).abs())
        bounds.union(box)
      })
      const preset = CAMERA_VIEWS[event.detail?.view]
      const direction = preset ? new THREE.Vector3(...preset.direction) : camera.position.clone().sub(controls.target)
      const result = fitBounds(camera, bounds, direction)
      if (!result) return
      transition.current = { startedAt: performance.now(), fromTarget: controls.target.clone(), toTarget: result.target, fromPosition: camera.position.clone(), toPosition: result.position, fromZoom: camera.zoom, toZoom: result.zoom }
    }
    const cancel = () => { transition.current = null }
    const events = ['frame-focus', 'frame-focus-all', 'frame-camera-view']
    events.forEach((name) => window.addEventListener(name, frame))
    const canvas = document.querySelector('.viewport canvas')
    canvas?.addEventListener('pointerdown', cancel)
    return () => { events.forEach((name) => window.removeEventListener(name, frame)); canvas?.removeEventListener('pointerdown', cancel); transition.current = null }
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
  const quality = useEditor((s) => s.postProcessingQuality)
  const maxDpr = quality === 'high' ? 2 : quality === 'performance' ? 1 : 1.5
  const selected = objects.find((o) => o.id === selectedId)
  return <main className="viewport">
    {!leftPanelOpen && <button className="side-panel-reveal side-panel-reveal-left" title="展开左侧栏" aria-label="展开左侧栏" onClick={openLeftPanel}><PanelLeftOpen size={17} /></button>}
    {!rightPanelOpen && <button className="side-panel-reveal side-panel-reveal-right" title="展开右侧栏" aria-label="展开右侧栏" onClick={openRightPanel}><PanelRightOpen size={17} /></button>}
    <Toolbar />
    <MeasureOverlay />
    <div className="viewport-label"><button onClick={() => setProjection(projection === 'perspective' ? 'orthographic' : 'perspective')}><Camera size={12} />{projection === 'perspective' ? '透视' : '正交'}</button><select value={shading} onChange={(e) => setShading(e.target.value)}><option value="solid">实体</option><option value="wireframe">线框</option></select><select aria-label="标准视图" value="" onChange={(event) => window.dispatchEvent(new CustomEvent('frame-camera-view', { detail: { view: event.target.value } }))}><option value="" disabled>标准视图</option>{Object.entries(CAMERA_VIEWS).map(([id, view]) => <option key={id} value={id}>{view.label}</option>)}</select></div>
    <div className="viewport-options"><IconButton icon={BoxSelect} label="查看全场景" onClick={() => window.dispatchEvent(new Event('frame-focus-all'))} /><IconButton icon={Grid3X3} label="网格" active={grid} onClick={toggleGrid} /><IconButton icon={Lightbulb} label="阴影" active={shadows} onClick={toggleShadows} /><IconButton icon={Focus} label="聚焦对象 (F)" onClick={() => window.dispatchEvent(new Event('frame-focus'))} /></div>
    <Canvas shadows dpr={[1, maxDpr]} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <PerformanceSampler /><Scene /><ModelSelectionRuntime /><MeasureRuntime objectRefs={SCENE_OBJECT_REFS} /><SceneEffectRuntime /><ParticleRuntime /><AnimationRuntime objectRefs={SCENE_OBJECT_REFS} /><PhysicsRuntime objectRefs={SCENE_OBJECT_REFS} /><RoamingRuntime objectRefs={SCENE_OBJECT_REFS} /><FocusController /><RendererSettings /><PostProcessing />
    </Canvas>
    <PerformanceOverlay />
    <div className="viewport-hint">左键旋转视角 · 右键平移视角 · 滚轮缩放</div>
    <div className="viewport-info">{selected ? `${selected.name} · ${selected.type}` : '未选择对象'}</div>
  </main>
}


function App() {
  const [toast, setToast] = useState('')
  const [help, setHelp] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(() => localStorage.getItem('frame-left-panel') !== 'closed')
  const [rightPanelOpen, setRightPanelOpen] = useState(() => localStorage.getItem('frame-right-panel') !== 'closed')
  const [workspaceMode, setWorkspaceMode] = useState(() => localStorage.getItem('frame-workspace-mode') || 'scene')
  const { setMode, deleteSelected, duplicateSelected, undo, redo } = useEditor()
  const notify = (message) => { setToast(message); window.clearTimeout(window.__frameToast); window.__frameToast = window.setTimeout(() => setToast(''), 2200) }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], .modal-backdrop')) return
      const commandKey = e.ctrlKey || e.metaKey
      const hasModifier = commandKey || e.altKey
      if (workspaceMode === 'scene' && useMeasure.getState().mode === 'off' && useRoaming.getState().mode !== 'manual' && !hasModifier && !e.repeat) {
        if (e.code === 'KeyQ') setMode('select')
        if (e.code === 'KeyW') setMode('translate')
        if (e.code === 'KeyE') setMode('rotate')
        if (e.code === 'KeyR') setMode('scale')
        if (e.code === 'KeyF') window.dispatchEvent(new Event('frame-focus'))
        if (workspaceMode === 'scene' && (e.code === 'Delete' || e.code === 'Backspace')) deleteSelected()
      }
      if (workspaceMode === 'scene' && commandKey && e.code === 'KeyD') { e.preventDefault(); duplicateSelected() }
      if (workspaceMode === 'scene' && commandKey && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      if (commandKey && e.code === 'KeyS') { e.preventDefault(); document.querySelector('.export-button')?.click() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [setMode, deleteSelected, duplicateSelected, undo, redo, workspaceMode])
  const objects = useEditor((s) => s.objects)
  const modelAssetIds = objects.filter((object) => object.modelAssetId).map((object) => object.modelAssetId).sort().join('|')
  const sceneSettingsJson = useEditor((s) => JSON.stringify(Object.fromEntries(SCENE_SETTING_KEYS.map((key) => [key, s[key]]))))
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('frame-scene')); if (Array.isArray(saved?.objects)) useEditor.getState().loadScene(saved, { historic: false }); if (saved?.interaction?.roaming) useRoaming.getState().setSetting(saved.interaction.roaming); applyEditorSettings(saved?.editor); if (saved?.particles) useParticles.getState().patch(saved.particles); if (saved?.sceneEffects) useSceneEffects.getState().patch(saved.sceneEffects) } catch { /* Ignore invalid local drafts. */ } }, [])
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
  const editorSettingsJson = useEditor((s) => JSON.stringify({ grid: s.grid, shadows: s.shadows, mode: s.mode, projection: s.projection, sceneLocked: s.sceneLocked }))
  const particleSettingsJson = useParticles((state) => JSON.stringify(serializeFeatureSettings(state)))
  const sceneEffectSettingsJson = useSceneEffects((state) => JSON.stringify(serializeFeatureSettings(state)))
  const autoPlayAnimations = useEditor((state) => state.autoPlayAnimations)
  useEffect(() => { if (autoPlayAnimations) useAnimationRuntime.getState().play(); else useAnimationRuntime.getState().stop() }, [autoPlayAnimations])
  const roamingSettingsJson = useRoaming((state) => JSON.stringify(Object.fromEntries(['showPath', 'pathPoints', 'speed', 'loop', 'curveType', 'tension', 'bendFactor', 'lookAhead', 'walkSpeed', 'acceleration', 'lookSensitivity', 'eyeHeight', 'colliderRadius', 'gravity', 'sprintMultiplier'].map((key) => [key, state[key]]))))
  useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem('frame-scene', JSON.stringify({ version: 4, objects, editor: JSON.parse(editorSettingsJson), particles: JSON.parse(particleSettingsJson), sceneEffects: JSON.parse(sceneEffectSettingsJson), settings: JSON.parse(sceneSettingsJson), interaction: { roaming: JSON.parse(roamingSettingsJson) } })) } catch { /* Large textures can exceed the browser storage quota. */ } }, 400); return () => clearTimeout(timer) }, [objects, sceneSettingsJson, roamingSettingsJson, particleSettingsJson, sceneEffectSettingsJson, editorSettingsJson])
  useEffect(() => { const timer = setTimeout(() => pruneModelAssets([...modelAssetIds.split('|').filter(Boolean), ...getSceneBackupAssetIds()]).catch(() => {}), 30000); return () => clearTimeout(timer) }, [modelAssetIds])
  useEffect(() => { localStorage.setItem('frame-left-panel', leftPanelOpen ? 'open' : 'closed') }, [leftPanelOpen])
  useEffect(() => { localStorage.setItem('frame-right-panel', rightPanelOpen ? 'open' : 'closed') }, [rightPanelOpen])
  useEffect(() => { localStorage.setItem('frame-workspace-mode', workspaceMode) }, [workspaceMode])
  const workspaceClass = `workspace ${leftPanelOpen ? '' : 'left-panel-collapsed'} ${rightPanelOpen ? '' : 'right-panel-collapsed'}`
  return <div className="app-shell"><Header notify={notify} showHelp={() => setHelp(true)} showExport={() => setExportOpen(true)} workspaceMode={workspaceMode} onWorkspaceModeChange={setWorkspaceMode} />{workspaceMode === 'scene' ? <div className={workspaceClass}>{leftPanelOpen && <SceneTree onCollapse={() => setLeftPanelOpen(false)} />}<Viewport leftPanelOpen={leftPanelOpen} rightPanelOpen={rightPanelOpen} openLeftPanel={() => setLeftPanelOpen(true)} openRightPanel={() => setRightPanelOpen(true)} />{rightPanelOpen && <Inspector onCollapse={() => setRightPanelOpen(false)} />}</div> : <UiWorkspace />}<footer><span><i /> {workspaceMode === 'scene' ? 'WebGL 2.0' : 'UI Canvas'}</span><span>{workspaceMode === 'scene' ? `对象 ${objects.length}` : '页面 1'}</span><span>自动保存</span><span className="footer-right">FRAME 0.3.0</span></footer>{toast && <div className="toast"><Check size={15} />{toast}</div>}{exportOpen && <ExportDialog objects={objects} settings={{ ...readSceneSettings(), interaction: { roaming: readRoamingSettings() } }} editor={readEditorSettings()} ui={readUiProject()} notify={notify} onClose={() => setExportOpen(false)} />}{help && <div className="modal-backdrop" onMouseDown={() => setHelp(false)}><div className="shortcut-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><strong>快捷键</strong><small>在视口中快速工作</small></div><IconButton icon={X} label="关闭" onClick={() => setHelp(false)} /></div><div className="shortcut-grid"><span>选择对象</span><kbd>Q</kbd><span>移动对象</span><kbd>W</kbd><span>旋转对象</span><kbd>E</kbd><span>缩放对象</span><kbd>R</kbd><span>聚焦选择</span><kbd>F</kbd><span>复制对象</span><kbd>Ctrl D</kbd><span>删除对象</span><kbd>Delete</kbd><span>撤销 / 重做</span><kbd>Ctrl Z / Shift Z</kbd><span>导出项目</span><kbd>Ctrl S</kbd></div></div></div>}</div>
}

export default App
