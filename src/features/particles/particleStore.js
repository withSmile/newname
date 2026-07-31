import { create } from 'zustand'

export const PARTICLE_PRESETS = {
  fireworks: { label: '烟花', count: 900, color: '#ffb35c', secondary: '#ff5d68', size: 0.09, speed: 3.8, gravity: -1.5, lifetime: 2.4, spread: 1.2 },
  fire: { label: '喷火', count: 700, color: '#ffcf67', secondary: '#ee4b28', size: 0.12, speed: 2.4, gravity: 0.7, lifetime: 1.2, spread: 0.55 },
  rain: { label: '下雨', count: 1400, color: '#76b7df', secondary: '#b9e9ff', size: 0.035, speed: 8, gravity: -1, lifetime: 2.8, spread: 4 },
  snow: { label: '下雪', count: 850, color: '#ffffff', secondary: '#b9d8ff', size: 0.085, speed: 1.1, gravity: -0.12, lifetime: 7, spread: 4 },
  mist: { label: '喷雾', count: 650, color: '#9de7e2', secondary: '#d8ffff', size: 0.1, speed: 1.5, gravity: 0.15, lifetime: 2.8, spread: 1.5 },
  code: { label: '代码流', count: 1000, color: '#69f5a6', secondary: '#d7ff8c', size: 0.045, speed: 3.6, gravity: -0.05, lifetime: 3.2, spread: 2.2 },
}

export const useParticles = create((set) => ({
  enabled: true,
  preset: 'fireworks',
  ...PARTICLE_PRESETS.fireworks,
  setPreset: (preset) => set({ preset, ...PARTICLE_PRESETS[preset] }),
  patch: (values) => set(values),
  reset: () => set({ enabled: true, preset: 'fireworks', ...PARTICLE_PRESETS.fireworks }),
}))
