import { create } from 'zustand'

export function measureValue(mode, points) {
  if (mode === 'distance' && points.length === 2) return Math.hypot(...points[0].map((value, axis) => value - points[1][axis]))
  if (mode === 'angle' && points.length === 3) {
    const a = points[0].map((value, axis) => value - points[1][axis])
    const b = points[2].map((value, axis) => value - points[1][axis])
    const length = Math.hypot(...a) * Math.hypot(...b)
    if (length < 1e-12) return null
    return Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, axis) => sum + value * b[axis], 0) / length))) * 180 / Math.PI
  }
  return null
}

export const useMeasure = create((set, get) => ({
  mode: 'off', pending: [], results: [], hint: '', unit: 'u',
  setMode: (mode) => set({ mode, pending: [], hint: '' }),
  setUnit: (unit) => set({ unit }),
  setHint: (hint) => set({ hint }),
  cancel: () => set({ pending: [], hint: '' }),
  clear: () => set({ pending: [], results: [], hint: '' }),
  remove: (id) => set((state) => ({ results: state.results.filter((result) => result.id !== id) })),
  addPoint: (point) => {
    const state = get()
    if (state.mode === 'off' || point.length !== 3 || !point.every(Number.isFinite)) return
    if (state.pending.some((other) => Math.hypot(...point.map((value, axis) => value - other[axis])) < 1e-6)) {
      set({ hint: '请选取不同的位置' }); return
    }
    const points = [...state.pending, [...point]]
    const required = state.mode === 'angle' ? 3 : 2
    if (points.length < required) { set({ pending: points, hint: '' }); return }
    const value = measureValue(state.mode, points)
    if (value === null) { set({ hint: '无法计算，请重新选点', pending: [] }); return }
    set({ pending: [], hint: '', results: [...state.results.slice(-99), { id: crypto.randomUUID(), mode: state.mode, points, value }] })
  },
}))

export const formatMeasurement = (result, unit) => result.mode === 'angle'
  ? `${result.value.toFixed(2)}°`
  : `${(result.value * ({ u: 1, m: 1, cm: 100, mm: 1000 }[unit] || 1)).toFixed(3)} ${unit}`
