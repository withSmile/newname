import React from 'react'
import { Ruler, Triangle, X, Trash2 } from 'lucide-react'
import { useMeasure, formatMeasurement } from './measureStore'

export function MeasureOverlay() {
  const mode = useMeasure((state) => state.mode)
  const pending = useMeasure((state) => state.pending)
  if (mode === 'off') return null
  return <div className="measure-overlay"><Ruler size={14} /><span>{mode === 'angle' ? '测角' : '测距'} · 已选 {pending.length}/{mode === 'angle' ? 3 : 2} 点</span><button onClick={() => useMeasure.getState().setMode('off')}>结束测量</button></div>
}

export function MeasurePanel() {
  const state = useMeasure()
  return <div className="editor-tool-panel">
    <div className="tool-intro"><Ruler size={18} /><div><strong>空间测量</strong><small>点击模型表面选点，拖动仍可旋转视角</small></div></div>
    <div className="tool-segments">{[['off', X, '退出'], ['distance', Ruler, '测距'], ['angle', Triangle, '测角']].map(([mode, Icon, label]) => <button key={mode} aria-pressed={state.mode === mode} className={state.mode === mode ? 'active' : ''} onClick={() => state.setMode(mode)}><Icon size={14} />{label}</button>)}</div>
    <p className="tool-note">{state.hint || (state.mode === 'off' ? '选择测量工具开始。结果仅在本次编辑会话保留。' : state.mode === 'angle' ? `依次选取起点、顶点、终点（${state.pending.length}/3）。Esc 取消本组，右键退出。` : `依次选择两个点（${state.pending.length}/2）。Esc 取消本组，右键退出。`)}</p>
    <label className="tool-unit">显示单位<select aria-label="测量显示单位" value={state.unit} onChange={(event) => state.setUnit(event.target.value)}><option value="u">场景单位 u</option><option value="m">米 m</option><option value="cm">厘米 cm</option><option value="mm">毫米 mm</option></select></label>
    {state.unit !== 'u' && <p className="tool-note">换算约定：1 场景单位 = 1 米，请先确认模型导入比例。</p>}
    <div className="tool-list-heading"><span>测量结果 · {state.results.length}</span><button disabled={!state.results.length && !state.pending.length} onClick={state.clear}><Trash2 size={13} />清空</button></div>
    {state.results.length === 0 && <div className="tool-empty">暂无测量结果</div>}
    <div className="measurement-list">{state.results.map((result, index) => <div key={result.id}><span><small>{result.mode === 'angle' ? '角度' : '距离'} {index + 1}</small><strong>{formatMeasurement(result, state.unit)}</strong></span><button aria-label={`删除测量 ${index + 1}`} onClick={() => state.remove(result.id)}><X size={14} /></button></div>)}</div>
  </div>
}
