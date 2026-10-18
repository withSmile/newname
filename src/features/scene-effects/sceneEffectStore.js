import { create } from 'zustand'

export const SCENE_EFFECT_PRESETS = {
  mirror: { label: '镜面反射', hint: '动态平面镜', group: '材质与空间', type: 'mirror', color: '#8db7c9', strength: 0.85, scale: 5, speed: 0.5 },
  water: { label: '反射水面', hint: 'Three Water 实时反射', group: '水体', type: 'water', color: '#0b3943', strength: 0.62, scale: 6, speed: 0.8, waterAlpha: 1, waterResolution: 512, waterSunColor: '#ffffff', waterSunIntensity: 0.65, waterWaveScale: 18, waterSkyEnabled: false },
  ripple: { label: '水波纹', hint: '同心波扩散', group: '水体', type: 'ripple', color: '#78e5ff', strength: 0.9, scale: 4.8, speed: 1.15 },
  clipping: { label: '裁剪剖面', hint: '动态扫描切片', group: '几何处理', type: 'clipping', color: '#ff784f', strength: 0.7, scale: 4.5, speed: 0.55 },
  screenFluid: { label: '屏幕空间流体', hint: '点精灵厚度融合与球面高光', group: '流体', type: 'screenFluid', color: '#25b9ff', strength: 0.9, scale: 3, speed: 0.8, targetMode: 'scene', position: [0, 0, 0], fluidSecondary: '#083d72', fluidCount: 900, fluidPointSize: 0.34, fluidOpacity: 0.72, fluidSpread: 2.4 },
}

const initial = SCENE_EFFECT_PRESETS.water

export const SCENE_EFFECT_DEFAULTS = {
  position: [0, 0.04, 0],
  rotation: [0, 0, 0],
  size: [6, 6],
  targetMode: 'object',
  targetObjectId: null,
  inheritTargetTransform: true,
  clippingEnabled: false,
  clippingAxis: 'x',
  clippingOffset: 0,
  clippingInvert: false,
  clippingAnimate: true,
  clippingSweep: 0.45,
}

export const useSceneEffects = create((set) => ({
  enabled: false,
  preset: 'water',
  ...SCENE_EFFECT_DEFAULTS,
  ...initial,
  setPreset: (preset) => {
    const next = SCENE_EFFECT_PRESETS[preset] || initial
    const size = next.size || [next.scale ?? 6, next.scale ?? 6]
    set({ preset, ...SCENE_EFFECT_DEFAULTS, ...next, size, clippingEnabled: preset === 'clipping' })
  },
  patch: (patch) => set(patch),
}))
