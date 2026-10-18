import React from 'react'
import { Crosshair, Footprints, Move3D, Pause, Play, Plus, RotateCcw, Route, Trash2 } from 'lucide-react'
import { NumberInput } from '../../../components/NumberInput'
import { useRoaming } from './roamingStore'

function NumericField({ value, step = 0.1, min, max, onChange, label }) {
  return <NumberInput aria-label={label} step={step} min={min} max={max} value={value} onValueChange={onChange} />
}

export function RoamingPanel() {
  const state = useRoaming()
  const startManual = () => {
    const canvas = document.querySelector('.viewport canvas')
    if (!canvas?.requestPointerLock) return
    state.setMode('manual')
    Promise.resolve(canvas.requestPointerLock()).catch(() => state.setMode('idle'))
  }
  return <div className="interaction-inspector">
    <div className="scene-summary interaction-summary"><div className="scene-orb"><Footprints size={18} /></div><div><strong>交互操作</strong><small>漫游、路径与 BVH 碰撞</small></div></div>
    <section className="roaming-status"><div><span className={`runtime-dot ${state.mode}`} /><strong>{state.mode === 'auto' ? '自动漫游中' : state.mode === 'manual' ? '手动漫游中' : '编辑模式'}</strong><small>{state.collisionReady ? 'BVH COLLISION READY' : 'WAITING FOR COLLIDERS'}</small></div>{state.mode !== 'idle' && <button onClick={() => { state.setMode('idle'); document.exitPointerLock?.() }}><Pause size={13} />停止</button>}</section>
    <section className="roaming-section"><h3><Route size={13} /> 自动漫游</h3>
      <label className="roaming-show-path"><span>显示漫游路径</span><input type="checkbox" checked={state.showPath !== false} onChange={(event) => state.setSetting({ showPath: event.target.checked })} /></label>
      <button className={`roaming-path-edit ${state.pathEdit ? 'active' : ''}`} disabled={state.mode !== 'idle'} onClick={() => state.setSetting({ pathEdit: !state.pathEdit })}><Move3D size={13} /><span><strong>{state.pathEdit ? '退出路径编辑' : '视口编辑路径'}</strong><small>选择路径点并拖动坐标轴调整曲线</small></span></button>
      <div className="pipe-curve-types roaming-curve-types">{[['catmullrom', 'CatmullRomCurve3 · 自由样条'], ['centripetal', 'CatmullRom · Centripetal'], ['chordal', 'CatmullRom · Chordal'], ['line', 'LineCurve3 · 直线路径'], ['quadratic', 'QuadraticBezierCurve3 · 二次贝塞尔'], ['cubic', 'CubicBezierCurve3 · 三次贝塞尔'], ['curvePath', 'CurvePath · 直线与弯头']].map(([type, label]) => <button key={type} className={state.curveType === type ? 'active' : ''} onClick={() => state.setSetting({ curveType: type })}>{label}</button>)}</div>
      <div className="roaming-actions"><button className="primary" disabled={state.pathPoints.length < 2} onClick={() => state.setMode('auto')}><Play size={13} />播放路径</button><button title="反转路径" onClick={state.reversePath}><RotateCcw size={13} /></button></div>
      <div className="roaming-settings"><label><span>pathSpeed · 路径速度</span><NumericField value={state.speed} min={0.1} onChange={(speed) => state.setSetting({ speed })} /></label>{state.curveType === 'catmullrom' && <label><span>tension · 张力</span><NumericField value={state.tension} min={0} max={1} step={0.05} onChange={(tension) => state.setSetting({ tension })} /></label>}{state.curveType === 'curvePath' && <label><span>bendFactor · 弯头比例</span><NumericField value={state.bendFactor} min={0.02} max={0.48} step={0.02} onChange={(bendFactor) => state.setSetting({ bendFactor })} /></label>}<label><span>lookAhead · 前瞻</span><NumericField value={state.lookAhead} min={0.001} step={0.001} onChange={(lookAhead) => state.setSetting({ lookAhead })} /></label><label className="roaming-check"><span>loop · 循环</span><input type="checkbox" checked={state.loop} onChange={(event) => state.setSetting({ loop: event.target.checked })} /></label></div>
      <div className="path-head"><span>路径点 · {state.pathPoints.length}</span><div><button title="重置路径" onClick={state.resetPath}><RotateCcw size={12} /></button><button title="添加路径点" onClick={() => state.addPoint([0, state.eyeHeight, 0])}><Plus size={12} /></button></div></div>
      <div className="path-points">{state.pathPoints.map((point, index) => <div className="path-point" key={index}><b>{String(index + 1).padStart(2, '0')}</b>{point.map((value, axis) => <NumericField key={axis} label={`路径点 ${index + 1} ${'XYZ'[axis]}`} value={value} onChange={(next) => { const pointValue = [...point]; pointValue[axis] = next; state.updatePoint(index, pointValue) }} />)}<button title="删除路径点" disabled={state.pathPoints.length <= 2} onClick={() => state.removePoint(index)}><Trash2 size={11} /></button></div>)}</div>
    </section>
    <section className="roaming-section"><h3><Crosshair size={13} /> 手动漫游</h3>
      <div className="manual-launch"><button className="primary" onClick={startManual}><Footprints size={14} />进入第一人称</button><small>WASD 移动 · 鼠标观察 · Shift 加速 · Esc 退出</small></div>
      <div className="roaming-settings">
        <label><span>walkSpeed · 步行速度</span><NumericField value={state.walkSpeed} min={0.2} step={0.1} onChange={(walkSpeed) => state.setSetting({ walkSpeed })} /></label>
        <label><span>acceleration · 加速度</span><NumericField value={state.acceleration} min={1} max={40} step={1} onChange={(acceleration) => state.setSetting({ acceleration })} /></label>
        <label><span>lookSensitivity · 灵敏度</span><NumericField value={state.lookSensitivity} min={0.2} max={3} step={0.1} onChange={(lookSensitivity) => state.setSetting({ lookSensitivity })} /></label>
        <label><span>sprint · 加速倍率</span><NumericField value={state.sprintMultiplier} min={1} step={0.1} onChange={(sprintMultiplier) => state.setSetting({ sprintMultiplier })} /></label>
        <label><span>eyeHeight · 眼高</span><NumericField value={state.eyeHeight} min={0.5} onChange={(eyeHeight) => state.setSetting({ eyeHeight })} /></label>
        <label><span>radius · 碰撞半径</span><NumericField value={state.colliderRadius} min={0.1} step={0.05} onChange={(colliderRadius) => state.setSetting({ colliderRadius })} /></label>
        <label><span>gravity · 重力</span><NumericField value={state.gravity} min={0} step={1} onChange={(gravity) => state.setSetting({ gravity })} /></label>
      </div>
    </section>
  </div>
}
