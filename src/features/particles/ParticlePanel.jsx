import { Activity, Flame, CloudRain, Snowflake, Sparkles, Wind, Code2, RotateCcw, Play, Pause, RefreshCw, Gauge, Move3D, Palette, Bug, Orbit, Waves, CircleDot, CircleDashed } from 'lucide-react'
import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NumberInput } from '../../components/NumberInput'
import { PARTICLE_PRESETS, useParticles } from './particleStore'

const icons = {
  fireworks: Sparkles, fire: Flame, rain: CloudRain, snow: Snowflake, mist: Wind, code: Code2,
  fireflies: Bug, stardust: Sparkles, portal: Orbit, fountain: Waves, shockwave: CircleDashed, galaxy: CircleDot,
}
const simulationFields = [
  ['count', '实例上限', 20, 5000, 10], ['rate', '发射数量', 1, 2000, 10],
  ['lifetime', '生命周期', 0.2, 15, 0.1], ['simulationSpeed', '时间倍率', 0.1, 3, 0.1],
]
const motionFields = [
  ['speed', '初始速度', 0, 20, 0.1], ['gravity', '垂直加速度', -10, 10, 0.1],
  ['spread', '水平范围', 0.2, 20, 0.1], ['angle', '扩散角度', 0, 360, 1],
  ['spawnHeight', '出生高度', 0, 30, 0.1], ['killHeight', '回收高度', -30, 0, 0.1],
]
const appearanceFields = [
  ['size', '粒子尺寸', 0.01, 0.8, 0.01], ['opacity', '整体透明度', 0.05, 1, 0.05],
  ['stretch', '速度拉伸', 0.2, 12, 0.1],
]

function NumberField({ item, settings, patch }) {
  const [key, label, min, max, step] = item
  return <label className="particle-field"><span>{label}</span><NumberInput min={min} max={max} step={step} value={settings[key]} onValueChange={(value) => patch({ [key]: value })} /></label>
}

function VectorField({ label, value, onChange }) {
  return <div className="particle-vector"><span>{label}</span><div>{value.map((axis, index) => <label key={index}><i>{'XYZ'[index]}</i><NumberInput aria-label={`${label} ${'XYZ'[index]}`} step="0.1" value={axis} onValueChange={(number) => { const next = [...value]; next[index] = number; onChange(next) }} /></label>)}</div></div>
}

function ParticleStats() {
  const stats = useParticles(useShallow((state) => ({ activeCount: state.activeCount, count: state.count, preset: state.preset, playing: state.playing })))
  const load = Math.min(100, Math.round((stats.activeCount / stats.count) * 100))
  return <div className="particle-stats"><div><span>{stats.playing ? 'LIVE' : 'PAUSED'}</span><b>{stats.activeCount.toLocaleString()} <small>/ {stats.count.toLocaleString()}</small></b></div><div className="particle-meter"><i style={{ width: `${load}%` }} /></div></div>
}

function ParameterGroup({ icon: Icon, title, children }) {
  return <section className="particle-group"><h3><Icon size={13} /><span>{title}</span></h3><div className="particle-grid">{children}</div></section>
}

export function ParticlePanel() {
  const settings = useParticles(useShallow((state) => { const { activeCount, ...panelSettings } = state; return panelSettings }))
  const patch = settings.patch
  const current = PARTICLE_PRESETS[settings.preset]
  return <div className="particle-panel">
    <header className="particle-hero">
      <div className="particle-hero-icon"><Activity size={17} /></div>
      <div><strong>Particle Studio</strong><small>{current.label} · InstancedMesh</small></div>
      <button title="恢复默认设置" onClick={settings.reset}><RotateCcw size={14} /></button>
    </header>
    <div className="particle-runtime"><ParticleStats /><div className="particle-actions"><button className={settings.playing ? 'primary' : ''} onClick={() => patch({ playing: !settings.playing })}>{settings.playing ? <Pause size={13} /> : <Play size={13} />}{settings.playing ? '暂停' : '播放'}</button><button onClick={settings.restart}><RefreshCw size={13} />重播</button></div></div>
    <label className="particle-master"><span><b>粒子渲染</b><small>单批次实例化渲染</small></span><input type="checkbox" checked={settings.enabled} onChange={(event) => patch({ enabled: event.target.checked })} /></label>

    <section className="particle-presets-section"><div className="particle-section-title"><h3>效果预设</h3><span>{Object.keys(PARTICLE_PRESETS).length} FX</span></div><div className="particle-presets">{Object.entries(PARTICLE_PRESETS).map(([id, item]) => { const Icon = icons[id] || Sparkles; return <button key={id} className={settings.preset === id ? 'active' : ''} onClick={() => settings.setPreset(id)}><i><Icon size={15} /></i><span>{item.label}<small>{item.hint}</small></span><em>{item.group || '经典'}</em></button> })}</div></section>

    <ParameterGroup icon={Gauge} title="发射与模拟">{simulationFields.map((item) => <NumberField key={item[0]} item={item} settings={settings} patch={patch} />)}</ParameterGroup>
    <ParameterGroup icon={Move3D} title="运动与空间">{motionFields.map((item) => <NumberField key={item[0]} item={item} settings={settings} patch={patch} />)}<VectorField label="发射位置" value={settings.position} onChange={(position) => patch({ position })} /><VectorField label="发射方向" value={settings.direction} onChange={(direction) => patch({ direction })} /><VectorField label="环境风力" value={settings.wind} onChange={(wind) => patch({ wind })} /></ParameterGroup>
    <ParameterGroup icon={Palette} title="外观"><div className="particle-colors"><label><span>起始色</span><input type="color" value={settings.color} onChange={(event) => patch({ color: event.target.value })} /></label><label><span>结束色</span><input type="color" value={settings.secondary} onChange={(event) => patch({ secondary: event.target.value })} /></label></div>{appearanceFields.map((item) => <NumberField key={item[0]} item={item} settings={settings} patch={patch} />)}{settings.preset === 'fireworks' && <label className="particle-inline-toggle"><span>多彩爆发</span><input type="checkbox" checked={Boolean(settings.randomColors)} onChange={(event) => patch({ randomColors: event.target.checked })} /></label>}</ParameterGroup>
  </div>
}
