import { create } from 'zustand'

export const useModelSelection = create((set) => ({
  objectId: null, path: null,
  select: (objectId, path) => set({ objectId, path }),
  clear: () => set({ objectId: null, path: null }),
}))
