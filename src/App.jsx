import React, { forwardRef, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Center, ContactShadows, Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls, OrthographicCamera, PerspectiveCamera, Sky, TransformControls, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Sky as ThreeSky } from 'three/addons/objects/Sky.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import {
  Box, BoxSelect, Camera, Check, ChevronDown, ChevronsDown, ChevronsUp, Circle, Copy, Download, Eye, EyeOff, FileJson, Focus, ImagePlus,
  Grid3X3, HelpCircle, ImageDown, Lightbulb, Lock, Magnet, Menu, MousePointer2, Move3D,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Plus, Redo2, Rotate3D, Scaling, Search, Settings2, Shapes, Trash2, Undo2, Unlock, Upload, X,
} from 'lucide-react'
import { useEditor } from './store'

const geometryFor = (type) => {
  const center = (geometry) => { geometry.computeBoundingBox(); geometry.center(); geometry.computeBoundingSphere(); if (geometry.attributes.uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv.clone()) }
  if (type === 'sphere') return <sphereGeometry args={[0.7, 48, 32]} onUpdate={center} />
  if (type === 'torus') return <torusGeometry args={[0.65, 0.22, 24, 64]} onUpdate={center} />
  if (type === 'cylinder') return <cylinderGeometry args={[0.62, 0.62, 1.25, 40, 12]} onUpdate={center} />
  if (type === 'cone') return <coneGeometry args={[0.68, 1.35, 40, 12]} onUpdate={center} />
  return <boxGeometry args={[1, 1, 1, 16, 16, 16]} onUpdate={center} />
}

const MODEL_ASSETS = [
  { name: 'Damaged Helmet', source: '/models/DamagedHelmet.glb', category: 'PBR', attribution: 'Khronos glTF Sample Assets · CC BY 4.0' },
  { name: 'Fox', source: '/models/Fox.glb', category: '动画', animated: true, attribution: 'PixelMannen / Autodesk · CC0 + CC BY 4.0' },
  { name: 'Cesium Man', source: '/models/CesiumMan.glb', category: '蒙皮', animated: true, attribution: 'Cesium · CC BY 4.0' },
  { name: 'Khronos Box', source: '/models/Box.glb', category: '基础', attribution: 'Khronos glTF Sample Assets' },
]

const ENVIRONMENT_PRESETS = [
  { id: 'studio', label: '影棚', colors: ['#25292d', '#fff2df'], values: { backgroundMode: 'color', background: '#25292d', environmentIntensity: 1.25, environmentRotation: 0, ambient: 0.45, keyLightColor: '#fff2df', keyLightIntensity: 2.1, fillLightColor: '#79a7c7', fillLightIntensity: 12, rimLightColor: '#f08a62', rimLightIntensity: 2.2, exposure: 1, fogEnabled: false } },
  { id: 'product', label: '产品', colors: ['#d6dadd', '#ffffff'], values: { backgroundMode: 'color', background: '#d6dadd', environmentIntensity: 1.65, environmentRotation: 35, ambient: 0.55, keyLightColor: '#ffffff', keyLightIntensity: 2.8, fillLightColor: '#b6d5df', fillLightIntensity: 8, rimLightColor: '#ffffff', rimLightIntensity: 1.5, exposure: 1.05, fogEnabled: false } },
  { id: 'sunset', label: '夕照', colors: ['#3a2927', '#ffb06b'], values: { backgroundMode: 'sky', background: '#3a2927', environmentIntensity: 1.1, environmentRotation: 0, sunElevation: 4, sunAzimuth: 235, skyTurbidity: 12, skyRayleigh: 3.5, ambient: 0.2, keyLightColor: '#ffb06b', keyLightIntensity: 3.1, fillLightColor: '#6c80bb', fillLightIntensity: 9, rimLightColor: '#ff8059', rimLightIntensity: 2.8, exposure: 1.1, fogEnabled: true, fogColor: '#3a2927', fogNear: 10, fogFar: 30 } },
  { id: 'night', label: '夜景', colors: ['#11161d', '#7fa6ff'], values: { backgroundMode: 'color', background: '#11161d', environmentIntensity: 0.75, environmentRotation: 210, ambient: 0.12, keyLightColor: '#7fa6ff', keyLightIntensity: 2.4, fillLightColor: '#d45b86', fillLightIntensity: 7, rimLightColor: '#8c6cff', rimLightIntensity: 3.2, exposure: 0.9, fogEnabled: true, fogColor: '#11161d', fogNear: 8, fogFar: 26 } },
]

const SCENE_SETTING_KEYS = ['environmentPreset', 'backgroundMode', 'background', 'environmentIntensity', 'environmentRotation', 'skyTurbidity', 'skyRayleigh', 'skyMieCoefficient', 'skyMieDirectionalG', 'sunElevation', 'sunAzimuth', 'ambient', 'keyLightColor', 'keyLightIntensity', 'keyLightPosition', 'fillLightColor', 'fillLightIntensity', 'fillLightPosition', 'fillLightDistance', 'rimLightEnabled', 'rimLightColor', 'rimLightIntensity', 'rimLightPosition', 'rimLightAngle', 'hemisphereEnabled', 'hemisphereSkyColor', 'hemisphereGroundColor', 'hemisphereIntensity', 'exposure', 'fogEnabled', 'fogColor', 'fogNear', 'fogFar', 'gridColor', 'gridSectionColor', 'gridSize', 'cameraFov', 'shadowOpacity', 'shadowBlur', 'customLights']
const readSceneSettings = () => { const state = useEditor.getState(); return Object.fromEntries(SCENE_SETTING_KEYS.map((key) => [key, state[key]])) }

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
    alphaMap={alphaMap} transparent={Boolean(alphaMap)} alphaTest={object.alphaTest ?? 0}
    displacementMap={displacementMap} displacementScale={object.displacementScale ?? 0.1}
    wireframe={shading === 'wireframe'}
  />
}

const ImportedModel = forwardRef(function ImportedModel({ object }, ref) {
  const selectedId = useEditor((s) => s.selectedId)
  const setSelected = useEditor((s) => s.setSelected)
  const gltf = useGLTF(object.modelSource)
  const model = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene])
  const animationRoot = useRef()
  const { actions, names } = useAnimations(gltf.animations, animationRoot)
  const normalizedScale = useMemo(() => {
    model.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    return 1.8 / Math.max(size.x, size.y, size.z, 0.001)
  }, [model])
  useEffect(() => { model.traverse((child) => { if (child.isMesh) { child.castShadow = object.castShadow !== false; child.receiveShadow = object.receiveShadow !== false } }) }, [model, object.castShadow, object.receiveShadow])
  useEffect(() => { const action = names.length ? actions[names[0]] : null; action?.reset().fadeIn(0.2).play(); return () => action?.fadeOut(0.15) }, [actions, names])
  return <group ref={ref} name={object.name} position={object.position} rotation={object.rotation} scale={object.scale} visible={object.visible} onClick={(e) => { e.stopPropagation(); setSelected(object.id) }}>
    <group ref={animationRoot} scale={normalizedScale}><Center><primitive object={model} /></Center></group>
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
  if (object.type === 'model') return <ImportedModel ref={ref} object={object} />
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
  const bindMesh = useCallback((mesh) => { ref.current = mesh; setTarget(mesh) }, [])
  const selectedId = useEditor((s) => s.selectedId)
  const mode = useEditor((s) => s.mode)
  const space = useEditor((s) => s.space)
  const updateObject = useEditor((s) => s.updateObject)
  const snap = useEditor((s) => s.snap)
  const snapSize = useEditor((s) => s.snapSize)
  const content = <SceneObject ref={bindMesh} object={object} />
  if (selectedId !== object.id || object.locked) return content
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
    invalidate()
  }, [scene, environmentIntensity, environmentRotation, invalidate])
  useEffect(() => () => {
    if (scene.environment === textureRef.current) scene.environment = null
    textureRef.current?.dispose()
    pmrem.dispose()
  }, [scene, pmrem])
  return null
}

function Scene() {
  const objects = useEditor((s) => s.objects)
  const grid = useEditor((s) => s.grid)
  const shadows = useEditor((s) => s.shadows)
  const background = useEditor((s) => s.background)
  const backgroundMode = useEditor((s) => s.backgroundMode)
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
  const cameraFov = useEditor((s) => s.cameraFov)
  const shadowOpacity = useEditor((s) => s.shadowOpacity)
  const shadowBlur = useEditor((s) => s.shadowBlur)
  const projection = useEditor((s) => s.projection)
  const setSelected = useEditor((s) => s.setSelected)
  const sunPosition = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - sunElevation)
    const theta = THREE.MathUtils.degToRad(sunAzimuth)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [sunElevation, sunAzimuth])
  const keyLightDirection = useMemo(() => backgroundMode === 'sky' ? sunPosition.clone().multiplyScalar(10) : keyLightPosition, [backgroundMode, sunPosition, keyLightPosition])
  return (
    <>
      {backgroundMode === 'color' ? <color attach="background" args={[background]} /> : <Sky distance={450000} sunPosition={sunPosition} turbidity={skyTurbidity} rayleigh={skyRayleigh} mieCoefficient={skyMieCoefficient} mieDirectionalG={skyMieDirectionalG} />}
      <SceneEnvironment backgroundMode={backgroundMode} sunPosition={sunPosition} skyTurbidity={skyTurbidity} skyRayleigh={skyRayleigh} skyMieCoefficient={skyMieCoefficient} skyMieDirectionalG={skyMieDirectionalG} />
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
      {grid && <Grid position={[0, 0, 0]} args={[30, 30]} cellSize={gridSize} cellThickness={0.55} cellColor={gridColor} sectionSize={gridSize * 5} sectionThickness={1} sectionColor={gridSectionColor} fadeDistance={18} infiniteGrid />}
      <ContactShadows position={[0, 0.01, 0]} opacity={shadows ? shadowOpacity : 0} scale={15} blur={shadowBlur} far={6} />
      {projection === 'perspective' ? <PerspectiveCamera makeDefault position={[6.5, 4.8, 7.5]} fov={cameraFov} /> : <OrthographicCamera makeDefault position={[6.5, 4.8, 7.5]} zoom={72} />}
      <OrbitControls makeDefault target={[0, 0.7, 0]} minDistance={2} maxDistance={22} />
      <GizmoHelper alignment="bottom-right" margin={[76, 58]}><GizmoViewport axisColors={['#e35d35', '#6cac68', '#5c85c7']} labelColor="white" /></GizmoHelper>
    </>
  )
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
  const items = [['box', Box, '立方体'], ['sphere', Circle, '球体'], ['cylinder', Shapes, '圆柱体'], ['cone', Lightbulb, '圆锥体'], ['torus', Circle, '圆环']]
  return <div className="add-menu">{items.map(([type, Icon, label]) => <button key={type} onClick={() => { addObject(type); close() }}><Icon size={15} />{label}</button>)}<i /><button onClick={() => { addModel(MODEL_ASSETS[3]); close() }}><BoxSelect size={15} />测试 GLB 模型</button></div>
}

function Header({ notify, showHelp }) {
  const [open, setOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const fileRef = useRef()
  const modelRef = useRef()
  const { objects, loadScene, resetScene, addModel } = useEditor()
  const exportScene = () => {
    const blob = new Blob([JSON.stringify({ version: 2, objects, settings: readSceneSettings() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'frame-scene.json'; a.click(); URL.revokeObjectURL(url); notify('场景 JSON 已导出')
  }
  const importScene = async (file) => { try { const data = JSON.parse(await file.text()); loadScene(data) ? notify('场景导入成功') : notify('文件中没有有效场景') } catch { notify('无法读取这个 JSON 文件') } }
  const importModel = (file) => {
    if (!file.name.toLowerCase().endsWith('.glb')) { notify('目前仅支持单文件 GLB 模型'); return }
    if (file.size > 20 * 1024 * 1024) { notify('GLB 文件不能超过 20 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { addModel({ name: file.name.replace(/\.glb$/i, ''), source: reader.result }); notify('GLB 模型导入成功') }
    reader.onerror = () => notify('GLB 模型读取失败')
    reader.readAsDataURL(file)
  }
  const capture = () => { const canvas = document.querySelector('.viewport canvas'); if (!canvas) return; const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'frame-viewport.png'; a.click(); notify('视口截图已保存') }
  return <header className="header">
    <div className="brand-mark"><span>F</span></div><div className="brand"><strong>FRAME</strong><small>THREE EDITOR</small></div>
    <div className="main-menu">
      <div className="menu-wrap"><button onClick={() => setFileOpen(!fileOpen)}>文件</button>{fileOpen && <div className="file-menu">
        <button onClick={() => fileRef.current?.click()}><Upload size={14} />导入场景 <kbd>JSON</kbd></button>
        <button onClick={() => modelRef.current?.click()}><BoxSelect size={14} />导入模型 <kbd>GLB</kbd></button>
        <button onClick={exportScene}><FileJson size={14} />导出场景 <kbd>Ctrl S</kbd></button>
        <button onClick={capture}><ImageDown size={14} />视口截图 <kbd>PNG</kbd></button>
        <i />
        <button className="danger" onClick={() => { resetScene(); setFileOpen(false); notify('已恢复示例场景') }}><Trash2 size={14} />重置场景</button>
      </div>}</div>
    </div>
    <input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={(e) => e.target.files[0] && importScene(e.target.files[0])} />
    <input ref={modelRef} className="file-input" type="file" accept="model/gltf-binary,.glb" onChange={(e) => e.target.files[0] && importModel(e.target.files[0])} />
    <div className="project-title"><span className="status-dot" /> 未命名场景 <span className="save-state">已保存</span></div>
    <div className="header-actions">
      <div className="add-wrap"><button className="add-button" onClick={() => setOpen(!open)}><Plus size={15} /> 添加对象 <ChevronDown size={13} /></button>{open && <AddMenu close={() => setOpen(false)} />}</div>
      <button className="export-button" onClick={exportScene}><Download size={15} /> 导出</button>
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
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('panel') === 'scene' ? 'scene' : 'object')
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
    <div className="inspector-tabs"><button className={tab === 'object' ? 'active' : ''} onClick={() => setTab('object')}>对象</button><button className={tab === 'scene' ? 'active' : ''} onClick={() => setTab('scene')}>场景</button></div>
    {tab === 'scene' ? <SceneInspector /> : !object ? <div className="no-selection"><MousePointer2 size={24} /><span>选择一个对象</span></div> : <>
    <div className="object-title"><div className="object-icon"><Box size={16} /></div><div><input value={object.name} onChange={(e) => updateObject(object.id, { name: e.target.value }, false)} /><small>{object.type.toUpperCase()} / {object.id.slice(-6)}</small></div></div>
    <CollapsibleSection><h3><ChevronDown size={13} /> 变换</h3>
      <VectorInput label="位置" value={object.position} onChange={(position) => updateObject(object.id, { position })} />
      <VectorInput label="旋转" value={object.rotation} onChange={(rotation) => updateObject(object.id, { rotation })} />
      <VectorInput label="缩放" value={object.scale} onChange={(scale) => updateObject(object.id, { scale })} />
    </CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 几何体</h3><div className="property-row"><label>类型</label><div className="readout">{object.type}</div></div></CollapsibleSection>
    {object.type !== 'model' ? <CollapsibleSection><h3><ChevronDown size={13} /> 材质</h3>
      <div className="property-row"><label>颜色</label><div className="color-control"><input type="color" value={object.color} onChange={(e) => updateObject(object.id, { color: e.target.value })} /><input value={object.color.toUpperCase()} readOnly /></div></div>
      <Slider label="粗糙度" value={object.roughness} onChange={(roughness) => updateObject(object.id, { roughness })} />
      <Slider label="金属度" value={object.metalness} onChange={(metalness) => updateObject(object.id, { metalness })} />
      <RangeSetting label="环境反射" value={object.envMapIntensity ?? 1} min={0} max={3} step={0.05} onChange={(envMapIntensity) => updateObject(object.id, { envMapIntensity })} />
      <TextureControl object={object} updateObject={updateObject} />
    </CollapsibleSection> : <CollapsibleSection><h3><ChevronDown size={13} /> GLB 模型</h3><div className="model-source"><BoxSelect size={16} /><div><strong>{object.name}</strong><small>{object.animated ? '包含动画 · 自动播放第一段' : '静态模型 · 保留原始 PBR 材质'}</small>{object.attribution && <small>{object.attribution}</small>}</div></div></CollapsibleSection>}
    <CollapsibleSection><h3><ChevronDown size={13} /> 显示</h3><ToggleRow label="投射阴影" value={object.castShadow !== false} onChange={(castShadow) => updateObject(object.id, { castShadow })} /><ToggleRow label="接收阴影" value={object.receiveShadow !== false} onChange={(receiveShadow) => updateObject(object.id, { receiveShadow })} /></CollapsibleSection>
    </>}
  </aside>
}

function Slider({ label, value, onChange }) { return <div className="property-row slider-row"><label>{label}</label><input type="range" min="0" max="1" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} /><span>{value.toFixed(2)}</span></div> }

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

function SceneInspector() {
  const settings = useEditor()
  const { backgroundMode, background, environmentIntensity, environmentRotation, skyTurbidity, skyRayleigh, skyMieCoefficient, skyMieDirectionalG, sunElevation, sunAzimuth, ambient, keyLightColor, keyLightIntensity, keyLightPosition, fillLightColor, fillLightIntensity, fillLightPosition, fillLightDistance, rimLightEnabled, rimLightColor, rimLightIntensity, rimLightPosition, rimLightAngle, hemisphereEnabled, hemisphereSkyColor, hemisphereGroundColor, hemisphereIntensity, exposure, fogEnabled, fogColor, fogNear, fogFar, grid, gridColor, gridSectionColor, gridSize, shadows, shadowOpacity, shadowBlur, cameraFov, environmentPreset, updateScene, toggleGrid, toggleShadows } = settings
  const applyPreset = (preset) => updateScene({ environmentPreset: preset.id, ...preset.values })
  return <div className="scene-inspector">
    <div className="scene-summary"><div className="scene-orb"><Lightbulb size={18} /></div><div><strong>场景环境</strong><small>天空、大气、灯光与渲染</small></div></div>
    <CollapsibleSection><h3><ChevronDown size={13} /> 环境预设</h3><div className="environment-presets">{ENVIRONMENT_PRESETS.map((preset) => <button key={preset.id} className={environmentPreset === preset.id ? 'active' : ''} onClick={() => applyPreset(preset)}><span><i style={{ background: preset.colors[0] }} /><i style={{ background: preset.colors[1] }} /></span><small>{preset.label}</small></button>)}</div></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 天空与世界</h3><div className="mode-segments"><button className={backgroundMode === 'color' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'color', environmentPreset: 'custom' })}>影棚环境</button><button className={backgroundMode === 'sky' ? 'active' : ''} onClick={() => updateScene({ backgroundMode: 'sky', environmentPreset: 'custom' })}>程序化天空</button></div>{backgroundMode === 'color' ? <ColorSetting label="背景" value={background} onChange={(background) => updateScene({ background, environmentPreset: 'custom' })} /> : <><RangeSetting label="太阳高度" value={sunElevation} min={-5} max={90} step={1} digits={0} suffix="°" onChange={(sunElevation) => updateScene({ sunElevation, environmentPreset: 'custom' })} /><RangeSetting label="太阳方位" value={sunAzimuth} min={0} max={360} step={1} digits={0} suffix="°" onChange={(sunAzimuth) => updateScene({ sunAzimuth, environmentPreset: 'custom' })} /><RangeSetting label="浑浊度" value={skyTurbidity} min={0} max={20} step={0.1} onChange={(skyTurbidity) => updateScene({ skyTurbidity })} /><RangeSetting label="瑞利散射" value={skyRayleigh} min={0} max={4} step={0.05} onChange={(skyRayleigh) => updateScene({ skyRayleigh })} /><RangeSetting label="米氏系数" value={skyMieCoefficient} min={0} max={0.02} step={0.001} digits={3} onChange={(skyMieCoefficient) => updateScene({ skyMieCoefficient })} /><RangeSetting label="米氏方向" value={skyMieDirectionalG} min={0} max={1} step={0.01} onChange={(skyMieDirectionalG) => updateScene({ skyMieDirectionalG })} /></>}<RangeSetting label="环境反射" value={environmentIntensity} min={0} max={3} step={0.05} onChange={(environmentIntensity) => updateScene({ environmentIntensity, environmentPreset: 'custom' })} /><RangeSetting label="环境旋转" value={environmentRotation} min={0} max={360} step={1} digits={0} suffix="°" onChange={(environmentRotation) => updateScene({ environmentRotation, environmentPreset: 'custom' })} /><RangeSetting label="曝光" value={exposure} min={0.2} max={2} step={0.05} onChange={(exposure) => updateScene({ exposure, environmentPreset: 'custom' })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 主光 · 方向光</h3><ColorSetting label="颜色" value={keyLightColor} onChange={(keyLightColor) => updateScene({ keyLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={keyLightIntensity} min={0} max={5} step={0.1} onChange={(keyLightIntensity) => updateScene({ keyLightIntensity, environmentPreset: 'custom' })} /><SceneVectorSetting label="位置" value={keyLightPosition} onChange={(keyLightPosition) => updateScene({ keyLightPosition })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 补光 · 点光</h3><ColorSetting label="颜色" value={fillLightColor} onChange={(fillLightColor) => updateScene({ fillLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={fillLightIntensity} min={0} max={20} step={0.5} onChange={(fillLightIntensity) => updateScene({ fillLightIntensity, environmentPreset: 'custom' })} /><RangeSetting label="距离" value={fillLightDistance} min={1} max={30} step={1} digits={0} onChange={(fillLightDistance) => updateScene({ fillLightDistance })} /><SceneVectorSetting label="位置" value={fillLightPosition} onChange={(fillLightPosition) => updateScene({ fillLightPosition })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 轮廓光 · 聚光</h3><ToggleRow label="启用轮廓光" value={rimLightEnabled} onChange={(rimLightEnabled) => updateScene({ rimLightEnabled })} />{rimLightEnabled && <><ColorSetting label="颜色" value={rimLightColor} onChange={(rimLightColor) => updateScene({ rimLightColor, environmentPreset: 'custom' })} /><RangeSetting label="强度" value={rimLightIntensity} min={0} max={8} step={0.1} onChange={(rimLightIntensity) => updateScene({ rimLightIntensity })} /><RangeSetting label="锥角" value={rimLightAngle} min={5} max={75} step={1} digits={0} suffix="°" onChange={(rimLightAngle) => updateScene({ rimLightAngle })} /><SceneVectorSetting label="位置" value={rimLightPosition} onChange={(rimLightPosition) => updateScene({ rimLightPosition })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 天空光 · 半球光</h3><ToggleRow label="启用天空光" value={hemisphereEnabled} onChange={(hemisphereEnabled) => updateScene({ hemisphereEnabled })} />{hemisphereEnabled && <><ColorSetting label="天空颜色" value={hemisphereSkyColor} onChange={(hemisphereSkyColor) => updateScene({ hemisphereSkyColor })} /><ColorSetting label="地面颜色" value={hemisphereGroundColor} onChange={(hemisphereGroundColor) => updateScene({ hemisphereGroundColor })} /><RangeSetting label="强度" value={hemisphereIntensity} min={0} max={3} step={0.05} onChange={(hemisphereIntensity) => updateScene({ hemisphereIntensity })} /></>}<RangeSetting label="环境光" value={ambient} min={0} max={2} step={0.05} onChange={(ambient) => updateScene({ ambient, environmentPreset: 'custom' })} /></CollapsibleSection>
    <CustomLightsEditor />
    <CollapsibleSection><h3><ChevronDown size={13} /> 雾效</h3><ToggleRow label="启用雾效" value={fogEnabled} onChange={(fogEnabled) => updateScene({ fogEnabled, environmentPreset: 'custom' })} />{fogEnabled && <><ColorSetting label="雾颜色" value={fogColor} onChange={(fogColor) => updateScene({ fogColor, environmentPreset: 'custom' })} /><NumberSetting label="起始 / 结束" values={[fogNear, fogFar]} onChange={([fogNear, fogFar]) => updateScene({ fogNear, fogFar })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 阴影</h3><ToggleRow label="实时阴影" value={shadows} onChange={toggleShadows} />{shadows && <><RangeSetting label="接触阴影" value={shadowOpacity} min={0} max={1} step={0.05} onChange={(shadowOpacity) => updateScene({ shadowOpacity })} /><RangeSetting label="柔化" value={shadowBlur} min={0.5} max={6} step={0.1} onChange={(shadowBlur) => updateScene({ shadowBlur })} /></>}</CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 视口辅助</h3><ToggleRow label="显示网格" value={grid} onChange={toggleGrid} />{grid && <><ColorSetting label="细网格" value={gridColor} onChange={(gridColor) => updateScene({ gridColor })} /><ColorSetting label="主网格" value={gridSectionColor} onChange={(gridSectionColor) => updateScene({ gridSectionColor })} /><RangeSetting label="网格间距" value={gridSize} min={0.1} max={2} step={0.1} onChange={(gridSize) => updateScene({ gridSize })} /></>}<RangeSetting label="相机视角" value={cameraFov} min={20} max={80} step={1} digits={0} suffix="°" onChange={(cameraFov) => updateScene({ cameraFov })} /></CollapsibleSection>
    <CollapsibleSection><h3><ChevronDown size={13} /> 渲染信息</h3><div className="metric-grid"><div><span>{useEditor.getState().objects.length}</span><small>对象</small></div><div><span>WebGL 2</span><small>渲染器</small></div></div></CollapsibleSection>
  </div>
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

function RangeSetting({ label, value, min, max, step, digits = 2, suffix = '', onChange }) { return <div className="property-row slider-row"><label>{label}</label><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /><span>{Number(value).toFixed(digits)}{suffix}</span></div> }

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
      <Scene /><FocusController /><RendererSettings />
    </Canvas>
    <div className="viewport-hint">左键选择 · 右键旋转 · 滚轮缩放</div>
    <div className="viewport-info">{selected ? `${selected.name} · ${selected.type}` : '未选择对象'}</div>
  </main>
}

function App() {
  const [toast, setToast] = useState('')
  const [help, setHelp] = useState(false)
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
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('frame-scene')); if (saved?.objects?.length) useEditor.getState().loadScene(saved) } catch { /* Ignore invalid local drafts. */ } }, [])
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
  useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem('frame-scene', JSON.stringify({ version: 2, objects, settings: JSON.parse(sceneSettingsJson) })) } catch { /* Large textures can exceed the browser storage quota. */ } }, 400); return () => clearTimeout(timer) }, [objects, sceneSettingsJson])
  useEffect(() => { localStorage.setItem('frame-left-panel', leftPanelOpen ? 'open' : 'closed') }, [leftPanelOpen])
  useEffect(() => { localStorage.setItem('frame-right-panel', rightPanelOpen ? 'open' : 'closed') }, [rightPanelOpen])
  const workspaceClass = `workspace ${leftPanelOpen ? '' : 'left-panel-collapsed'} ${rightPanelOpen ? '' : 'right-panel-collapsed'}`
  return <div className="app-shell"><Header notify={notify} showHelp={() => setHelp(true)} /><div className={workspaceClass}>{leftPanelOpen && <SceneTree onCollapse={() => setLeftPanelOpen(false)} />}<Viewport leftPanelOpen={leftPanelOpen} rightPanelOpen={rightPanelOpen} openLeftPanel={() => setLeftPanelOpen(true)} openRightPanel={() => setRightPanelOpen(true)} />{rightPanelOpen && <Inspector onCollapse={() => setRightPanelOpen(false)} />}</div><footer><span><i /> WebGL 2.0</span><span>对象 {objects.length}</span><span>自动保存</span><span className="footer-right">FRAME 0.2.0</span></footer>{toast && <div className="toast"><Check size={15} />{toast}</div>}{help && <div className="modal-backdrop" onMouseDown={() => setHelp(false)}><div className="shortcut-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><strong>快捷键</strong><small>在视口中快速工作</small></div><IconButton icon={X} label="关闭" onClick={() => setHelp(false)} /></div><div className="shortcut-grid"><span>移动对象</span><kbd>W</kbd><span>旋转对象</span><kbd>E</kbd><span>缩放对象</span><kbd>R</kbd><span>聚焦选择</span><kbd>F</kbd><span>复制对象</span><kbd>Ctrl D</kbd><span>删除对象</span><kbd>Delete</kbd><span>撤销 / 重做</span><kbd>Ctrl Z / Shift Z</kbd><span>保存场景</span><kbd>Ctrl S</kbd></div></div></div>}</div>
}

export default App
