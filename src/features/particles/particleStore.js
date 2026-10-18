import { create } from 'zustand'

export const PARTICLE_LIMITS = {
  count: [20, 5000], rate: [1, 2000], size: [0.01, 0.8], speed: [0, 20], gravity: [-10, 10],
  lifetime: [0.2, 15], spread: [0.2, 20], spawnHeight: [0, 30], killHeight: [-30, 0], angle: [0, 360],
  opacity: [0.05, 1], stretch: [0.2, 12], simulationSpeed: [0.1, 3],
}

export const PARTICLE_PRESETS = {
  fireworks: { label: '烟花', hint: '球形爆发', group: '经典', count: 900, rate: 420, angle: 360, opacity: 1, stretch: 1.9, randomColors: true, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2.6, 0], color: '#ffd166', secondary: '#ff496c', size: 0.085, speed: 4.2, gravity: -1.65, lifetime: 2.4, spread: 1.2, spawnHeight: 0, killHeight: -8 },
  fire: { label: '火焰', hint: '锥形上升', group: '经典', count: 700, rate: 580, angle: 34, opacity: 1, stretch: 1.8, randomColors: false, direction: [0, 1, 0], wind: [0.08, 0, 0], position: [0, 1.65, 0], color: '#ffe08a', secondary: '#f04428', size: 0.14, speed: 2.2, gravity: 0.65, lifetime: 1.15, spread: 0.55, spawnHeight: 0, killHeight: -3 },
  rain: { label: '雨幕', hint: '区域降雨', group: '环境', count: 1800, rate: 720, angle: 4, opacity: 0.78, stretch: 6.5, randomColors: false, direction: [0, -1, 0], wind: [0.18, 0, 0], position: [0, 0, 0], color: '#70b8e8', secondary: '#d1f1ff', size: 0.032, speed: 9, gravity: -1.2, lifetime: 2.2, spread: 6, spawnHeight: 6.5, killHeight: -0.15 },
  snow: { label: '飘雪', hint: '缓慢飘落', group: '环境', count: 1100, rate: 180, angle: 18, opacity: 0.9, stretch: 1, randomColors: false, direction: [0, -1, 0], wind: [0.12, 0, 0.04], position: [0, 0, 0], color: '#ffffff', secondary: '#b9dcff', size: 0.1, speed: 0.95, gravity: -0.06, lifetime: 8, spread: 6, spawnHeight: 6.5, killHeight: -0.15 },
  mist: { label: '雾流', hint: '柔和扩散', group: '环境', count: 750, rate: 260, angle: 58, opacity: 0.52, stretch: 1.35, randomColors: false, direction: [0, 1, 0], wind: [0.32, 0.04, 0], position: [0, 1.25, 0], color: '#85ded9', secondary: '#e0ffff', size: 0.2, speed: 1.35, gravity: 0.06, lifetime: 3.2, spread: 1.8, spawnHeight: 0, killHeight: -3 },
  code: { label: '数字雨', hint: '霓虹数据流', group: '环境', count: 1200, rate: 420, angle: 3, opacity: 0.88, stretch: 4.8, randomColors: false, direction: [0, -1, 0], wind: [0, 0, 0], position: [0, 0, 0], color: '#5cff9b', secondary: '#d8ff72', size: 0.045, speed: 4.4, gravity: -0.08, lifetime: 3.4, spread: 4.2, spawnHeight: 5.5, killHeight: -0.15 },
  fireflies: { label: '萤火虫', hint: '呼吸微光', group: '自然', count: 420, rate: 90, angle: 360, opacity: 0.92, stretch: 1, randomColors: false, direction: [0, 1, 0], wind: [0.04, 0, 0.02], position: [0, 2.2, 0], color: '#f5ff7a', secondary: '#62ff9f', size: 0.075, speed: 0.32, gravity: 0, lifetime: 7, spread: 4.8, spawnHeight: 0, killHeight: -4 },
  stardust: { label: '魔法星尘', hint: '螺旋升腾', group: '魔法', count: 1000, rate: 300, angle: 42, opacity: 1, stretch: 1.25, randomColors: false, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.6, 0], color: '#78d8ff', secondary: '#d880ff', size: 0.065, speed: 1.15, gravity: 0.1, lifetime: 4.6, spread: 2.3, spawnHeight: 0, killHeight: -4 },
  portal: { label: '漩涡传送门', hint: '环形吸附', group: '魔法', count: 1400, rate: 520, angle: 12, opacity: 0.95, stretch: 1.5, randomColors: false, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2.5, 0], color: '#38d9ff', secondary: '#9b5cff', size: 0.055, speed: 2.4, gravity: 0, lifetime: 3.8, spread: 2.2, spawnHeight: 0, killHeight: -4 },
  fountain: { label: '粒子喷泉', hint: '重力抛洒', group: '自然', count: 1100, rate: 430, angle: 30, opacity: 0.9, stretch: 1.8, randomColors: false, direction: [0, 1, 0], wind: [0.08, 0, 0], position: [0, 0.2, 0], color: '#9ce8ff', secondary: '#3c8dff', size: 0.055, speed: 5.4, gravity: -5.2, lifetime: 2.4, spread: 0.5, spawnHeight: 0, killHeight: -0.2 },
  shockwave: { label: '能量冲击波', hint: '环形扩散', group: '能量', count: 900, rate: 360, angle: 0, opacity: 1, stretch: 2.8, randomColors: false, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.35, 0], color: '#ffffff', secondary: '#28b8ff', size: 0.075, speed: 5.8, gravity: 0, lifetime: 1.8, spread: 0.5, spawnHeight: 0, killHeight: -4 },
  galaxy: { label: '银河旋臂', hint: '星系轨道', group: '宇宙', behavior: 'orbit', count: 2400, rate: 900, angle: 360, opacity: 0.92, stretch: 1, randomColors: false, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2.2, 0], color: '#ffd6a0', secondary: '#6d72ff', size: 0.045, speed: 0.65, gravity: 0, lifetime: 10, spread: 5.5, spawnHeight: 0, killHeight: -4 },

  dandelion: { label: '蒲公英种子', hint: '绒羽随风', group: '自然类', behavior: 'drift', count: 650, rate: 95, angle: 40, opacity: 0.92, stretch: 1.8, direction: [0.3, 0.35, 0], wind: [0.5, 0.08, 0.12], position: [-2, 1.4, 0], color: '#fffbe8', secondary: '#d8e7c3', size: 0.09, speed: 0.42, gravity: -0.025, lifetime: 9, spread: 4.5, spawnHeight: 2, killHeight: -0.2 },
  leaves: { label: '落叶', hint: '旋转翻飞', group: '自然类', behavior: 'fall', count: 800, rate: 120, angle: 22, opacity: 0.95, stretch: 1.6, direction: [0, -1, 0], wind: [0.32, 0, 0.08], position: [0, 0, 0], color: '#d28a36', secondary: '#8b3f26', size: 0.13, speed: 0.7, gravity: -0.08, lifetime: 8, spread: 6, spawnHeight: 6, killHeight: -0.15 },
  petals: { label: '花瓣飘落', hint: '轻盈回旋', group: '自然类', behavior: 'fall', count: 850, rate: 130, angle: 28, opacity: 0.9, stretch: 1.35, direction: [0, -1, 0], wind: [0.18, 0, 0.05], position: [0, 0, 0], color: '#ffd4df', secondary: '#ff8fb3', size: 0.11, speed: 0.55, gravity: -0.04, lifetime: 9, spread: 5.5, spawnHeight: 6, killHeight: -0.15 },
  sandstorm: { label: '沙尘暴', hint: '横向沙幕', group: '自然类', behavior: 'storm', count: 2600, rate: 1100, angle: 12, opacity: 0.48, stretch: 4.5, direction: [1, 0.08, 0], wind: [1.8, 0.05, 0], position: [-5, 1.6, 0], color: '#d6ad72', secondary: '#8f6841', size: 0.045, speed: 5.8, gravity: -0.05, lifetime: 3.5, spread: 5, spawnHeight: 3, killHeight: -0.3 },
  bubbles: { label: '水下气泡', hint: '上浮摇摆', group: '自然类', behavior: 'bubble', count: 700, rate: 180, angle: 18, opacity: 0.72, stretch: 1, direction: [0, 1, 0], wind: [0.03, 0, 0], position: [0, 0.15, 0], color: '#d9fbff', secondary: '#62d8ff', size: 0.1, speed: 1.15, gravity: 0.12, lifetime: 5.5, spread: 3.6, spawnHeight: 0, killHeight: -3 },
  splash: { label: '水面飞沫', hint: '皇冠溅射', group: '自然类', behavior: 'burst', count: 800, rate: 360, angle: 55, opacity: 0.92, stretch: 2.4, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.2, 0], color: '#efffff', secondary: '#4bbcff', size: 0.055, speed: 4.8, gravity: -5.8, lifetime: 1.5, spread: 0.8, spawnHeight: 0, killHeight: -0.3 },
  steam: { label: '蒸汽', hint: '热流扩散', group: '自然类', behavior: 'smoke', count: 900, rate: 260, angle: 38, opacity: 0.34, stretch: 1.8, direction: [0, 1, 0], wind: [0.22, 0, 0], position: [0, 0.25, 0], color: '#f5f7f2', secondary: '#b6c1bd', size: 0.22, speed: 1.05, gravity: 0.13, lifetime: 4.2, spread: 1.1, spawnHeight: 0, killHeight: -3 },
  ash: { label: '火山灰', hint: '灰烬浮沉', group: '自然类', behavior: 'ash', count: 1500, rate: 420, angle: 60, opacity: 0.65, stretch: 1.4, direction: [0, 1, 0], wind: [0.3, 0, 0.06], position: [0, 0.4, 0], color: '#77716d', secondary: '#292625', size: 0.075, speed: 1.3, gravity: -0.16, lifetime: 6.5, spread: 3.2, spawnHeight: 0, killHeight: -0.3 },
  thunder: { label: '雷雨电火花', hint: '高频电闪', group: '自然类', behavior: 'electric', count: 900, rate: 420, angle: 22, opacity: 1, stretch: 5.5, direction: [0, -1, 0], wind: [0.1, 0, 0], position: [0, 5.5, 0], color: '#ffffff', secondary: '#68a7ff', size: 0.035, speed: 9.5, gravity: -0.4, lifetime: 0.65, spread: 4.5, spawnHeight: 0, killHeight: -0.2 },

  upload: { label: '数据上传流', hint: '编码上行', group: '科幻类', behavior: 'stream', count: 1300, rate: 500, angle: 5, opacity: 0.9, stretch: 5, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.2, 0], color: '#4dffd2', secondary: '#b6fff4', size: 0.04, speed: 4.2, gravity: 0, lifetime: 3.2, spread: 3.2, spawnHeight: 0, killHeight: -3 },
  hologram: { label: '全息扫描线', hint: '层叠扫描', group: '科幻类', behavior: 'scan', count: 1100, rate: 520, angle: 2, opacity: 0.72, stretch: 6.5, direction: [1, 0, 0], wind: [0, 0, 0], position: [0, 2, 0], color: '#32e6ff', secondary: '#a5f8ff', size: 0.035, speed: 2.2, gravity: 0, lifetime: 3.4, spread: 3.4, spawnHeight: 0, killHeight: -3 },
  energyCore: { label: '能量核心', hint: '脉冲聚核', group: '科幻类', behavior: 'core', count: 1600, rate: 650, angle: 360, opacity: 1, stretch: 2.2, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2, 0], color: '#ffffff', secondary: '#00b7ff', size: 0.055, speed: 2.4, gravity: 0, lifetime: 3.6, spread: 2.6, spawnHeight: 0, killHeight: -4 },
  atom: { label: '原子轨道', hint: '三轴电子云', group: '科幻类', behavior: 'atom', count: 720, rate: 260, angle: 360, opacity: 0.96, stretch: 1.4, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2, 0], color: '#fff6a8', secondary: '#56d9ff', size: 0.065, speed: 1.8, gravity: 0, lifetime: 8, spread: 2.5, spawnHeight: 0, killHeight: -4 },
  laserDust: { label: '激光尘埃', hint: '光束微尘', group: '科幻类', behavior: 'beam', count: 900, rate: 360, angle: 8, opacity: 0.95, stretch: 6.8, direction: [1, 0, 0], wind: [0, 0, 0], position: [-3, 2, 0], color: '#ff3d77', secondary: '#ffe1eb', size: 0.035, speed: 5.2, gravity: 0, lifetime: 2.4, spread: 1.1, spawnHeight: 0, killHeight: -4 },
  arcNodes: { label: '电弧节点', hint: '节点跃迁', group: '科幻类', behavior: 'electric', count: 850, rate: 420, angle: 360, opacity: 1, stretch: 5.8, direction: [1, 0, 0], wind: [0, 0, 0], position: [0, 2, 0], color: '#ffffff', secondary: '#785cff', size: 0.035, speed: 6.5, gravity: 0, lifetime: 0.85, spread: 3.4, spawnHeight: 0, killHeight: -4 },
  wormhole: { label: '虫洞', hint: '时空漏斗', group: '科幻类', behavior: 'wormhole', count: 2400, rate: 1000, angle: 360, opacity: 0.92, stretch: 2, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2.2, 0], color: '#ff61d8', secondary: '#4c7dff', size: 0.045, speed: 1.6, gravity: 0, lifetime: 7, spread: 4.8, spawnHeight: 0, killHeight: -4 },
  shield: { label: '粒子护盾', hint: '球面护罩', group: '科幻类', behavior: 'shield', count: 1900, rate: 780, angle: 360, opacity: 0.78, stretch: 1.4, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 2, 0], color: '#b8ffff', secondary: '#287cff', size: 0.045, speed: 0.75, gravity: 0, lifetime: 6, spread: 2.6, spawnHeight: 0, killHeight: -4 },
  radar: { label: '雷达扫描环', hint: '扇区探测', group: '科幻类', behavior: 'ring', count: 1000, rate: 420, angle: 0, opacity: 0.88, stretch: 3.5, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.3, 0], color: '#baffdc', secondary: '#00e781', size: 0.055, speed: 3.2, gravity: 0, lifetime: 2.6, spread: 0.6, spawnHeight: 0, killHeight: -4 },

  healing: { label: '治疗光点', hint: '生命升华', group: '技能类', behavior: 'heal', count: 1000, rate: 300, angle: 30, opacity: 0.95, stretch: 1.5, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.2, 0], color: '#efffba', secondary: '#3dff9a', size: 0.07, speed: 1.1, gravity: 0.08, lifetime: 4.5, spread: 2.4, spawnHeight: 0, killHeight: -4 },
  ice: { label: '冰冻碎片', hint: '晶片爆散', group: '技能类', behavior: 'burst', count: 900, rate: 420, angle: 360, opacity: 0.98, stretch: 2.8, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 1.3, 0], color: '#f3ffff', secondary: '#4ab9ff', size: 0.075, speed: 4.6, gravity: -1.8, lifetime: 2.4, spread: 1, spawnHeight: 0, killHeight: -4 },
  poison: { label: '毒雾', hint: '腐蚀扩散', group: '技能类', behavior: 'smoke', count: 1200, rate: 380, angle: 65, opacity: 0.48, stretch: 1.5, direction: [0, 1, 0], wind: [0.18, 0, 0], position: [0, 0.5, 0], color: '#b9ff38', secondary: '#54217d', size: 0.2, speed: 0.85, gravity: 0.04, lifetime: 5.2, spread: 2.8, spawnHeight: 0, killHeight: -3 },
  shadow: { label: '暗影吸附', hint: '向心吞噬', group: '技能类', behavior: 'implode', count: 1500, rate: 580, angle: 360, opacity: 0.88, stretch: 2.5, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 1.5, 0], color: '#925cff', secondary: '#130b24', size: 0.065, speed: 2.2, gravity: 0, lifetime: 3.4, spread: 4, spawnHeight: 0, killHeight: -4 },
  holyLight: { label: '圣光降落', hint: '天穹光柱', group: '技能类', behavior: 'beamDown', count: 1400, rate: 600, angle: 6, opacity: 0.92, stretch: 8, direction: [0, -1, 0], wind: [0, 0, 0], position: [0, 5.5, 0], color: '#ffffff', secondary: '#ffd96a', size: 0.045, speed: 5.5, gravity: 0, lifetime: 1.8, spread: 2, spawnHeight: 0, killHeight: -0.1 },
  fireball: { label: '火球拖尾', hint: '炽热彗尾', group: '技能类', behavior: 'beam', count: 1100, rate: 520, angle: 16, opacity: 1, stretch: 7, direction: [1, 0.15, 0], wind: [0, 0, 0], position: [-3, 1.6, 0], color: '#fff4a8', secondary: '#f03218', size: 0.08, speed: 6.2, gravity: -0.12, lifetime: 2.2, spread: 0.7, spawnHeight: 0, killHeight: -4 },
  sword: { label: '剑气轨迹', hint: '弧光斩击', group: '技能类', behavior: 'slash', count: 900, rate: 400, angle: 12, opacity: 1, stretch: 8.5, direction: [1, 0, 0], wind: [0, 0, 0], position: [-2, 1.6, 0], color: '#ffffff', secondary: '#56d5ff', size: 0.045, speed: 7.5, gravity: 0, lifetime: 1.25, spread: 1.2, spawnHeight: 0, killHeight: -4 },
  magicCircle: { label: '地面法阵', hint: '符文环绕', group: '技能类', behavior: 'circle', count: 1700, rate: 680, angle: 360, opacity: 0.9, stretch: 1.8, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 0.12, 0], color: '#fff1a6', secondary: '#ff7b30', size: 0.05, speed: 1.25, gravity: 0, lifetime: 6.5, spread: 3.2, spawnHeight: 0, killHeight: -4 },
  charge: { label: '聚能爆发', hint: '收束引爆', group: '技能类', behavior: 'charge', count: 1800, rate: 800, angle: 360, opacity: 1, stretch: 2.8, direction: [0, 1, 0], wind: [0, 0, 0], position: [0, 1.6, 0], color: '#ffffff', secondary: '#ff3fd2', size: 0.06, speed: 3.4, gravity: 0, lifetime: 2.8, spread: 4, spawnHeight: 0, killHeight: -4 },
}

function sanitizePatch(values) {
  const next = { ...values }
  Object.entries(PARTICLE_LIMITS).forEach(([key, [min, max]]) => {
    if (!(key in next)) return
    const value = Number(next[key])
    if (!Number.isFinite(value)) delete next[key]
    else next[key] = Math.min(max, Math.max(min, key === 'count' ? Math.round(value) : value))
  })
  ;['position', 'direction', 'wind'].forEach((key) => {
    if (!(key in next)) return
    const vector = next[key]
    if (!Array.isArray(vector) || vector.length !== 3 || vector.some((value) => !Number.isFinite(Number(value)))) delete next[key]
    else next[key] = vector.map(Number)
  })
  return next
}

export const useParticles = create((set) => ({
  enabled: true,
  playing: true,
  simulationSpeed: 1,
  activeCount: 0,
  restartToken: 0,
  preset: 'fireworks',
  ...PARTICLE_PRESETS.fireworks,
  setPreset: (preset) => set((state) => PARTICLE_PRESETS[preset] ? { preset, ...PARTICLE_PRESETS[preset], activeCount: 0, restartToken: state.restartToken + 1 } : state),
  patch: (values) => set(sanitizePatch(values)),
  setStats: (activeCount) => set((state) => state.activeCount === activeCount ? state : { activeCount }),
  restart: () => set((state) => ({ activeCount: 0, restartToken: state.restartToken + 1 })),
  reset: () => set((state) => ({ enabled: true, playing: true, simulationSpeed: 1, activeCount: 0, restartToken: state.restartToken + 1, preset: 'fireworks', ...PARTICLE_PRESETS.fireworks })),
}))
