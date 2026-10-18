import React from 'react'
import { Box, Droplets, ScanLine, Sparkles } from 'lucide-react'
import { useEditor } from '../../store'
import { useSceneEffects } from './sceneEffectStore'
import './SceneEffectPanel.css'

export const MODEL_EFFECT_PRESETS = {
  hologram: { label: '全息投影', hint: '透明条纹与轮廓辉光', icon: ScanLine, color: '#38d9ff', intensity: 1.2, speed: 1, scale: 7, opacity: 0.72 },
  fresnel: { label: '菲涅尔辉光', hint: '沿模型边缘产生能量光', icon: Sparkles, color: '#7b61ff', intensity: 1.35, speed: 0.45, scale: 4, opacity: 1 },
  xray: { label: 'X-Ray 透视', hint: '半透明表面与轮廓增强', icon: Box, color: '#66ffd1', intensity: 1.1, speed: 0.3, scale: 5, opacity: 0.42 },
  scan: { label: '扫描脉冲', hint: '扫描带沿模型表面循环', icon: ScanLine, color: '#ffb45e', intensity: 1.25, speed: 0.8, scale: 5, opacity: 1 },
  dissolve: { label: '溶解消散', hint: '程序化噪声裁切与发光边缘', icon: Sparkles, color: '#ff7a3d', intensity: 2.1, speed: 0, scale: 3.5, opacity: 1, progress: 0.42, edgeWidth: 0.12 },
}

const defaults = { enabled: true, type: 'hologram', ...MODEL_EFFECT_PRESETS.hologram }

export function SceneEffectPanel() {
  const selectedObjectId = useEditor((state) => state.selectedId)
  const object = useEditor((state) => state.objects.find((item) => item.id === state.selectedId))
  const updateObject = useEditor((state) => state.updateObject)
  const isEffectTarget = Boolean(object && object.type !== 'flowPipe')
  const effect = { ...defaults, ...(object?.effects?.model || object?.effects?.material || {}) }

  const patch = (next) => {
    if (!isEffectTarget) return
    updateObject(selectedObjectId, { effects: { ...object.effects, model: { ...effect, ...next } } })
  }
  const choosePreset = (type) => patch({ enabled: true, type, ...MODEL_EFFECT_PRESETS[type] })
  const clearEffect = () => {
    if (!isEffectTarget) return
    const effects = { ...object.effects }
    delete effects.model
    delete effects.material
    updateObject(selectedObjectId, { effects })
  }

  if (!isEffectTarget) return <div className="scene-effect-panel model-effect-panel"><FluidControls /><div className="model-effect-empty"><Sparkles size={25} /><strong>选择一个模型</strong><span>对象特效会跟随模型保存；屏幕空间流体是独立场景效果。</span></div></div>

  return <div className="scene-effect-panel model-effect-panel">
    <FluidControls />
    <section className="model-effect-target">
      <div className="model-effect-target-icon"><Box size={16} /></div>
      <div><strong>{object.name}</strong><span>MODEL / {object.id.slice(-6)}</span></div>
      <label className="model-effect-switch"><input type="checkbox" checked={Boolean(effect.enabled && object.effects?.model)} onChange={(event) => patch({ enabled: event.target.checked })} /><i /></label>
    </section>

    <section>
      <h3>模型处理效果</h3>
      <div className="model-effect-presets">
        {Object.entries(MODEL_EFFECT_PRESETS).map(([key, preset]) => {
          const Icon = preset.icon
          return <button key={key} className={effect.type === key && object.effects?.model ? 'active' : ''} onClick={() => choosePreset(key)}>
            <Icon size={15} /><span><b>{preset.label}</b><small>{preset.hint}</small></span>
          </button>
        })}
      </div>
    </section>

    <section className="model-effect-controls">
      <h3>效果参数</h3>
      <label className="scene-effect-color"><span>效果颜色</span><input type="color" value={effect.color} onChange={(event) => patch({ color: event.target.value })} /></label>
      <Slider label="效果强度" value={effect.intensity} min={0} max={3} step={0.05} onChange={(intensity) => patch({ intensity })} />
      <Slider label="动画速度" value={effect.speed} min={0} max={3} step={0.05} onChange={(speed) => patch({ speed })} />
      <Slider label="纹理密度" value={effect.scale} min={1} max={16} step={0.5} onChange={(scale) => patch({ scale })} />
      <Slider label="表面透明度" value={effect.opacity} min={0.1} max={1} step={0.02} onChange={(opacity) => patch({ opacity })} />
      {effect.type === 'dissolve' && <>
        <Slider label="溶解进度" value={effect.progress ?? 0.42} min={0} max={1} step={0.01} onChange={(progress) => patch({ progress })} />
        <Slider label="发光边缘宽度" value={effect.edgeWidth ?? 0.12} min={0.01} max={0.4} step={0.01} onChange={(edgeWidth) => patch({ edgeWidth })} />
      </>}
    </section>

    <section className="model-effect-footer">
      <div><strong>对象级特效</strong><span>跟随模型复制、保存与导出</span></div>
      <button onClick={clearEffect} disabled={!object.effects?.model && !object.effects?.material}>移除效果</button>
    </section>
  </div>
}

function FluidControls() {
  const fluid = useSceneEffects()
  const active = fluid.enabled && fluid.type === 'screenFluid'
  const enable = () => {
    if (!active) fluid.setPreset('screenFluid')
    fluid.patch({ enabled: !active, type: 'screenFluid', preset: 'screenFluid', targetMode: 'scene' })
  }
  return <section className="screen-fluid-controls">
    <div className="screen-fluid-heading"><div><Droplets size={16} /><span><strong>屏幕空间流体</strong><small>独立场景粒子流体</small></span></div><label className="model-effect-switch"><input type="checkbox" checked={active} onChange={enable} /><i /></label></div>
    {active && <>
      <label className="scene-effect-color"><span>流体颜色</span><input type="color" value={fluid.color} onChange={(event) => fluid.patch({ color: event.target.value })} /></label>
      <label className="scene-effect-color"><span>深层颜色</span><input type="color" value={fluid.fluidSecondary || '#083d72'} onChange={(event) => fluid.patch({ fluidSecondary: event.target.value })} /></label>
      <Slider label="粒子数量" value={fluid.fluidCount ?? 900} min={100} max={2600} step={50} onChange={(fluidCount) => fluid.patch({ fluidCount })} />
      <Slider label="粒子半径" value={fluid.fluidPointSize ?? 0.34} min={0.08} max={0.8} step={0.01} onChange={(fluidPointSize) => fluid.patch({ fluidPointSize })} />
      <Slider label="流体范围" value={fluid.fluidSpread ?? 2.4} min={0.4} max={6} step={0.1} onChange={(fluidSpread) => fluid.patch({ fluidSpread })} />
      <Slider label="流体透明度" value={fluid.fluidOpacity ?? 0.72} min={0.1} max={1} step={0.02} onChange={(fluidOpacity) => fluid.patch({ fluidOpacity })} />
      <Slider label="流动速度" value={fluid.speed ?? 0.8} min={0} max={3} step={0.05} onChange={(speed) => fluid.patch({ speed })} />
    </>}
  </section>
}

function Slider({ label, value, min, max, step, onChange }) {
  return <label className="scene-effect-slider"><span>{label}<b>{Number(value).toFixed(2)}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
