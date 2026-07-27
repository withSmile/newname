import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const initialPath = [
  [-4, 1.7, 5],
  [0, 1.7, 6],
  [4, 1.7, 2],
  [2, 1.7, -4],
  [-3, 1.7, -3],
]

export const useRoaming = create(persist((set, get) => ({
  mode: 'idle',
  pathPoints: initialPath,
  speed: 1.6,
  loop: true,
  curveType: 'catmullrom',
  tension: 0.5,
  bendFactor: 0.22,
  lookAhead: 0.012,
  eyeHeight: 1.7,
  colliderRadius: 0.35,
  gravity: 18,
  sprintMultiplier: 2,
  progress: 0,
  pathEdit: false,
  collisionReady: false,
  setSetting: (patch) => set(patch),
  setMode: (mode) => set({ mode, pathEdit: mode === 'idle' ? get().pathEdit : false, progress: mode === 'auto' ? get().progress : 0 }),
  setProgress: (progress) => set({ progress }),
  setCollisionReady: (collisionReady) => set({ collisionReady }),
  addPoint: (point) => set((state) => ({ pathPoints: [...state.pathPoints, point || [0, state.eyeHeight, 0]] })),
  updatePoint: (index, point) => set((state) => ({ pathPoints: state.pathPoints.map((item, itemIndex) => itemIndex === index ? point : item) })),
  removePoint: (index) => set((state) => ({ pathPoints: state.pathPoints.filter((_, itemIndex) => itemIndex !== index) })),
  reversePath: () => set((state) => ({ pathPoints: [...state.pathPoints].reverse() })),
  resetPath: () => set({ pathPoints: initialPath, progress: 0 }),
}), {
  name: 'frame-roaming',
  partialize: (state) => ({
    pathPoints: state.pathPoints,
    speed: state.speed,
    loop: state.loop,
    curveType: state.curveType,
    tension: state.tension,
    bendFactor: state.bendFactor,
    lookAhead: state.lookAhead,
    eyeHeight: state.eyeHeight,
    colliderRadius: state.colliderRadius,
    gravity: state.gravity,
    sprintMultiplier: state.sprintMultiplier,
  }),
}))
