import React from 'react'
import { Crosshair, Footprints, Move3D, Pause, Play, Plus, RotateCcw, Route, Trash2 } from 'lucide-react'
import { useRoaming } from './roamingStore'

function NumericField({ value, step = 0.1, onChange, label }) {
  return <input aria-label={label} type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
}

export function RoamingPanel() {
  const state = useRoaming()
  const startManual = () => {
    state.setMode('manual')
    document.querySelector('.viewport canvas')?.requestPointerLock?.()
  }
  return <div className="interaction-inspector">
    <div className="scene-summary interaction-summary"><div className="scene-orb"><Footprints size={18} /></div><div><strong>交互操作</strong><small>漫游、路径与 BVH 碰撞</small></div></div>
    <section className="roaming-status"><div><span className={`runtime-dot ${state.mode}`} /><strong>{state.mode === 'auto' ? '自动漫游中' : state.mode === 'manual' ? '手动漫游中' : '编辑模式'}</strong><small>{state.collisionReady ? 'BVH COLLISION READY' : 'WAITING FOR COLLIDERS'}</small></div>{state.mode !== 'idle' && <button onClick={() => { state.setMode('idle'); document.exitPointerLock?.() }}><Pause size={13} />停止</button>}</section>
    <section className="roaming-section"><h3><Route size={13} /> 自动漫游</h3>
      <button className={`roaming-path-edit ${state.pathEdit ? 'active' : ''}`} disabled={state.mode !== 'idle'} onClick={() => state.setSetting({ pathEdit: !state.pathEdit })}><Move3D size={13} /><span><strong>{state.pathEdit ? '退出路径编辑' : '视口编辑路径'}</strong><small>选择路径点并拖动坐标轴调整曲线</small></span></button>
      <div className="pipe-curve-types roaming-curve-types">{[['catmullrom', 'CatmullRomCurve3 · 自由样条'], ['centripetal', 'CatmullRom · Centripetal'], ['chordal', 'CatmullRom · Chordal'], ['line', 'LineCurve3 · 直线路径'], ['quadratic', 'QuadraticBezierCurve3 · 二次贝塞尔'], ['cubic', 'CubicBezierCurve3 · 三次贝塞尔'], ['curvePath', 'CurvePath · 直线与弯头']].map(([type, label]) => <button key={type} className={state.curveType === type ? 'active' : ''} onClick={() => state.setSetting({ curveType: type })}>{label}</button>)}</div>
      <div className="roaming-actions"><button className="primary" disabled={state.pathPoints.length < 2} onClick={() => state.setMode('auto')}><Play size={13} />播放路径</button><button title="反转路径" onClick={state.reversePath}><RotateCcw size={13} /></button></div>
      <div className="roaming-settings"><label><span>speed · 速度</span><NumericField value={state.speed} onChange={(speed) => state.setSetting({ speed: Math.max(0.1, speed) })} /></label>{state.curveType === 'catmullrom' && <label><span>tension · 张力</span><NumericField value={state.tension} step={0.05} onChange={(tension) => state.setSetting({ tension: Math.max(0, Math.min(1, tension)) })} /></label>}{state.curveType === 'curvePath' && <label><span>bendFactor · 弯头比例</span><NumericField value={state.bendFactor} step={0.02} onChange={(bendFactor) => state.setSetting({ bendFactor: Math.max(0.02, Math.min(0.48, bendFactor)) })} /></label>}<label><span>lookAhead · 前瞻</span><NumericField value={state.lookAhead} step={0.001} onChange={(lookAhead) => state.setSetting({ lookAhead: Math.max(0.001, lookAhead) })} /></label><label className="roaming-check"><span>loop · 循环</span><input type="checkbox" checked={state.loop} onChange={(event) => state.setSetting({ loop: event.target.checked })} /></label></div>
      <div className="path-head"><span>路径点 · {state.pathPoints.length}</span><div><button title="重置路径" onClick={state.resetPath}><RotateCcw size={12} /></button><button title="添加路径点" onClick={() => state.addPoint([0, state.eyeHeight, 0])}><Plus size={12} /></button></div></div>
      <div className="path-points">{state.pathPoints.map((point, index) => <div className="path-point" key={index}><b>{String(index + 1).padStart(2, '0')}</b>{point.map((value, axis) => <NumericField key={axis} label={`路径点 ${index + 1} ${'XYZ'[axis]}`} value={value} onChange={(next) => { const pointValue = [...point]; pointValue[axis] = next; state.updatePoint(index, pointValue) }} />)}<button title="删除路径点" disabled={state.pathPoints.length <= 2} onClick={() => state.removePoint(index)}><Trash2 size={11} /></button></div>)}</div>
    </section>
    <section className="roaming-section"><h3><Crosshair size={13} /> 手动漫游</h3>
      <div className="manual-launch"><button className="primary" onClick={startManual}><Footprints size={14} />进入第一人称</button><small>WASD 移动 · 鼠标观察 · Shift 加速 · Esc 退出</small></div>
      <div className="roaming-settings"><label><span>eyeHeight · 眼高</span><NumericField value={state.eyeHeight} onChange={(eyeHeight) => state.setSetting({ eyeHeight: Math.max(0.5, eyeHeight) })} /></label><label><span>radius · 半径</span><NumericField value={state.colliderRadius} step={0.05} onChange={(colliderRadius) => state.setSetting({ colliderRadius: Math.max(0.1, colliderRadius) })} /></label><label><span>gravity · 重力</span><NumericField value={state.gravity} step={1} onChange={(gravity) => state.setSetting({ gravity: Math.max(0, gravity) })} /></label><label><span>sprint · 加速</span><NumericField value={state.sprintMultiplier} onChange={(sprintMultiplier) => state.setSetting({ sprintMultiplier: Math.max(1, sprintMultiplier) })} /></label></div>
    </section>
  </div>
}
