import { create } from 'zustand'

export const usePhysicsRuntime = create((set) => ({
  enabled: true,
  debug: false,
  gravity: [0, -9.81, 0],
  revision: 0,
  command: null,
  collisionCount: 0,
  lastCollision: null,
  setEnabled: (enabled) => set({ enabled }),
  setDebug: (debug) => set({ debug }),
  setGravity: (gravity) => set({ gravity }),
  dispatch: (objectId, type, vector = [0, 0, 0]) => set((state) => ({ command: { nonce: (state.command?.nonce || 0) + 1, objectId, type, vector } })),
  reportCollision: (first, second) => set((state) => ({ collisionCount: state.collisionCount + 1, lastCollision: { first, second, at: Date.now() } })),
  reset: () => set((state) => ({ revision: state.revision + 1, collisionCount: 0, lastCollision: null })),
}))
