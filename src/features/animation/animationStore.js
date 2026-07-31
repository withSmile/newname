import { create } from 'zustand'

export const useAnimationRuntime = create((set) => ({
  playing: false,
  paused: false,
  startedAt: 0,
  pausedAt: 0,
  currentTime: 0,
  timelineDuration: 10,
  play: () => set((state) => ({ playing: true, paused: false, startedAt: performance.now() / 1000 - state.currentTime, pausedAt: 0 })),
  pause: () => set((state) => ({ paused: !state.paused, pausedAt: !state.paused ? performance.now() / 1000 : state.pausedAt })),
  resumeFromPause: () => set((state) => {
    if (!state.paused) return state
    const now = performance.now() / 1000
    return { paused: false, startedAt: state.startedAt + (now - state.pausedAt), pausedAt: 0 }
  }),
  stop: () => set({ playing: false, paused: false, startedAt: 0, pausedAt: 0, currentTime: 0 }),
  seek: (currentTime) => set((state) => ({ currentTime, startedAt: state.playing ? performance.now() / 1000 - currentTime : state.startedAt })),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setTimelineDuration: (timelineDuration) => set({ timelineDuration: Math.max(0.1, timelineDuration) }),
}))
