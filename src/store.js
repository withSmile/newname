import { create } from 'zustand'

const seedObjects = [
  { id: 'cube-1', name: 'Hero Cube', type: 'box', position: [0, 0.75, 0], rotation: [0, 0.35, 0], scale: [1.5, 1.5, 1.5], color: '#e35d35', roughness: 0.32, metalness: 0.12, visible: true },
  { id: 'sphere-1', name: 'Metal Sphere', type: 'sphere', position: [-2.4, 0.65, -0.8], rotation: [0, 0, 0], scale: [1.15, 1.15, 1.15], color: '#8fcbd2', roughness: 0.16, metalness: 1, envMapIntensity: 1.35, visible: true },
  { id: 'torus-1', name: 'Torus', type: 'torus', position: [2.2, 0.8, 0.2], rotation: [1.15, 0.15, 0.1], scale: [1.1, 1.1, 1.1], color: '#e7c75a', roughness: 0.42, metalness: 0.25, visible: true },
]

const sceneDefaults = {
  environmentPreset: 'studio',
  backgroundMode: 'color',
  background: '#25292d',
  environmentIntensity: 1.25,
  environmentRotation: 0,
  skyTurbidity: 8,
  skyRayleigh: 2.5,
  skyMieCoefficient: 0.005,
  skyMieDirectionalG: 0.8,
  sunElevation: 28,
  sunAzimuth: 135,
  ambient: 0.45,
  keyLightColor: '#fff2df',
  keyLightIntensity: 2.1,
  keyLightPosition: [5, 8, 4],
  fillLightColor: '#79a7c7',
  fillLightIntensity: 12,
  fillLightPosition: [-5, 3, -4],
  fillLightDistance: 10,
  rimLightEnabled: true,
  rimLightColor: '#f08a62',
  rimLightIntensity: 2.2,
  rimLightPosition: [1, 4, -6],
  rimLightAngle: 32,
  hemisphereEnabled: true,
  hemisphereSkyColor: '#dce8ef',
  hemisphereGroundColor: '#33383b',
  hemisphereIntensity: 1.1,
  exposure: 1,
  postProcessingEnabled: true,
  postProcessingQuality: 'balanced',
  bloomEnabled: false,
  bloomIntensity: 0.65,
  bloomThreshold: 0.82,
  bloomSmoothing: 0.18,
  depthOfFieldEnabled: false,
  depthOfFieldFocusDistance: 0.02,
  depthOfFieldFocalLength: 0.035,
  depthOfFieldBokehScale: 2,
  vignetteEnabled: true,
  vignetteOffset: 0.22,
  vignetteDarkness: 0.55,
  chromaticAberrationEnabled: false,
  chromaticAberrationOffset: 0.0015,
  noiseEnabled: false,
  noiseOpacity: 0.035,
  fogEnabled: false,
  fogColor: '#25292d',
  fogNear: 12,
  fogFar: 35,
  gridColor: '#5d6266',
  gridSectionColor: '#858b8f',
  gridSize: 0.5,
  sceneSize: 30,
  cameraFov: 42,
  cameraNear: 0.1,
  cameraFar: 1000,
  shadowOpacity: 0.45,
  shadowBlur: 2.5,
  customLights: [],
}

const customLightDefaults = {
  ambient: { color: '#ffffff', intensity: 0.5 },
  directional: { color: '#fff4df', intensity: 1.5, position: [4, 6, 3], castShadow: true },
  point: { color: '#79b8ff', intensity: 8, position: [-3, 3, 2], distance: 12, decay: 2 },
  spot: { color: '#ff9a66', intensity: 6, position: [3, 5, -4], distance: 18, angle: 30, penumbra: 0.6, castShadow: false },
  hemisphere: { skyColor: '#b8d9ff', groundColor: '#403832', intensity: 0.8 },
}

const snapshot = (objects) => JSON.parse(JSON.stringify(objects))
const makeName = (type, objects) => `${type[0].toUpperCase()}${type.slice(1)} ${objects.filter((o) => o.type === type).length + 1}`

export const useEditor = create((set, get) => ({
  objects: seedObjects,
  selectedId: 'cube-1',
  mode: 'translate',
  space: 'world',
  grid: true,
  shadows: true,
  snap: false,
  snapSize: 0.5,
  projection: 'perspective',
  shading: 'solid',
  ...sceneDefaults,
  history: [],
  future: [],
  setSelected: (id) => set({ selectedId: id }),
  setMode: (mode) => set({ mode }),
  setSpace: (space) => set({ space }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  toggleShadows: () => set((s) => ({ shadows: !s.shadows })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setSnapSize: (snapSize) => set({ snapSize }),
  setProjection: (projection) => set({ projection }),
  setShading: (shading) => set({ shading }),
  updateScene: (patch) => set(patch),
  addLight: (type) => {
    const s = get()
    const id = `light-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const count = s.customLights.filter((light) => light.type === type).length + 1
    const light = { id, type, name: `${type[0].toUpperCase()}${type.slice(1)} Light ${count}`, enabled: true, ...snapshot(customLightDefaults[type] || customLightDefaults.point) }
    set({ customLights: [...s.customLights, light] })
    return id
  },
  updateLight: (id, patch) => set((s) => ({ customLights: s.customLights.map((light) => light.id === id ? { ...light, ...patch } : light) })),
  removeLight: (id) => set((s) => ({ customLights: s.customLights.filter((light) => light.id !== id) })),
  commit: (next) => set((s) => ({ objects: next, history: [...s.history.slice(-39), snapshot(s.objects)], future: [] })),
  updateObject: (id, patch, historic = true) => {
    const s = get()
    const next = s.objects.map((o) => o.id === id ? { ...o, ...patch } : o)
    if (historic) s.commit(next)
    else set({ objects: next })
  },
  addObject: (type) => {
    const s = get()
    const id = `${type}-${Date.now()}`
    const flat = type === 'plane'
    const next = [...s.objects, { id, name: makeName(type, s.objects), type, position: [0, flat ? 0.02 : 0.6, 0], rotation: flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0], scale: [1, 1, 1], color: '#7ca6d8', roughness: 0.4, metalness: 0.1, opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, doubleSided: false, visible: true }]
    set({ objects: next, selectedId: id, history: [...s.history.slice(-39), snapshot(s.objects)], future: [] })
  },
  addModel: ({ name, source, attribution, animated }) => {
    const s = get()
    const id = `model-${Date.now()}`
    const model = { id, name: name || 'Imported Model', type: 'model', modelSource: source, attribution, animated, position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', roughness: 0.5, metalness: 0, opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, doubleSided: false, visible: true }
    set({ objects: [...s.objects, model], selectedId: id, history: [...s.history.slice(-39), snapshot(s.objects)], future: [] })
  },
  deleteSelected: () => {
    const s = get()
    if (!s.selectedId) return
    const next = s.objects.filter((o) => o.id !== s.selectedId)
    set({ objects: next, selectedId: next[0]?.id ?? null, history: [...s.history.slice(-39), snapshot(s.objects)], future: [] })
  },
  duplicateSelected: () => {
    const s = get(); const source = s.objects.find((o) => o.id === s.selectedId)
    if (!source) return
    const id = `${source.type}-${Date.now()}`
    const copy = { ...snapshot(source), id, name: `${source.name} Copy`, position: source.position.map((v, i) => v + (i === 0 ? 0.5 : 0)) }
    set({ objects: [...s.objects, copy], selectedId: id, history: [...s.history.slice(-39), snapshot(s.objects)], future: [] })
  },
  undo: () => set((s) => {
    if (!s.history.length) return s
    const previous = s.history[s.history.length - 1]
    return { objects: previous, history: s.history.slice(0, -1), future: [snapshot(s.objects), ...s.future], selectedId: previous.some((o) => o.id === s.selectedId) ? s.selectedId : previous[0]?.id ?? null }
  }),
  redo: () => set((s) => {
    if (!s.future.length) return s
    const next = s.future[0]
    return { objects: next, history: [...s.history, snapshot(s.objects)], future: s.future.slice(1), selectedId: next.some((o) => o.id === s.selectedId) ? s.selectedId : next[0]?.id ?? null }
  }),
  loadScene: (data) => {
    if (!Array.isArray(data?.objects)) return false
    const valid = data.objects.filter((o) => o?.id && o?.type && Array.isArray(o.position))
    if (!valid.length) return false
    const settings = data.settings && typeof data.settings === 'object'
      ? Object.fromEntries(Object.keys(sceneDefaults).filter((key) => data.settings[key] !== undefined).map((key) => [key, data.settings[key]]))
      : {}
    set((s) => ({ ...settings, objects: valid, selectedId: valid[0].id, history: [...s.history, snapshot(s.objects)], future: [] }))
    return true
  },
  resetScene: () => set((s) => ({ ...sceneDefaults, objects: snapshot(seedObjects), selectedId: 'cube-1', history: [...s.history, snapshot(s.objects)], future: [] })),
}))
