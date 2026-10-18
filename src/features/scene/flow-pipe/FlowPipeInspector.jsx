import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, ImagePlus, Move3D, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { NumberInput } from '../../../components/NumberInput'

function Field({ label, value, step = 0.1, min, max, onChange }) {
  return <label><span>{label}</span><NumberInput value={value} min={min} max={max} step={step} onValueChange={onChange} /></label>
}

function ColorField({ label, value, onChange }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (raw) => {
    const next = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[\da-f]{6}$/i.test(next)) onChange(next)
    else setDraft(value)
  }
  return <label className="flow-color-field"><span>{label}</span><div><input aria-label={`${label} 颜色选择`} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} Hex`} value={draft} onChange={(event) => { const raw = event.target.value; setDraft(raw); if (/^#[\da-f]{6}$/i.test(raw)) onChange(raw) }} onBlur={() => commit(draft)} /></div></label>
}

export function FlowPipeInspector({ object, updateObject }) {
  const inputRef = useRef()
  const [error, setError] = useState('')
  const patch = (values) => updateObject(object.id, values)
  const points = object.pipePoints || []
  const arrowCarrier = object.flowArrowCarrier || 'ribbon'
  const upload = (file) => {
    if (!file?.type.startsWith('image/')) { setError('请选择图片贴图'); return }
    if (file.size > 4 * 1024 * 1024) { setError('流动贴图不能超过 4 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { patch({ flowTexture: reader.result, flowTextureName: file.name, flowMode: 'texture' }); setError('') }
    reader.readAsDataURL(file)
  }
  return <section className="flow-pipe-inspector"><h3>流动管道</h3>
    <button className={`pipe-point-edit ${object.pipeEditPoints ? 'active' : ''}`} onClick={() => patch({ pipeEditPoints: !object.pipeEditPoints })}><Move3D size={13} /><span><strong>{object.pipeEditPoints ? '退出控制点编辑' : '视口编辑控制点'}</strong><small>点击控制点后拖动坐标轴进行拉伸和转弯</small></span></button>
    <div className="pipe-curve-types">{[['catmullrom', 'CatmullRomCurve3 · 自由样条'], ['centripetal', 'CatmullRom · Centripetal'], ['chordal', 'CatmullRom · Chordal'], ['line', 'LineCurve3 · 直线折线'], ['quadratic', 'QuadraticBezierCurve3 · 二次贝塞尔'], ['cubic', 'CubicBezierCurve3 · 三次贝塞尔'], ['curvePath', 'CurvePath · 直管与弯头']].map(([type, label]) => <button key={type} className={(object.pipeCurveType || 'catmullrom') === type ? 'active' : ''} onClick={() => patch({ pipeCurveType: type })}>{label}</button>)}</div>
    <div className="flow-mode-tabs">{[['glow', '流光'], ['arrow', '箭头'], ['texture', '贴图']].map(([mode, label]) => <button key={mode} className={object.flowMode === mode ? 'active' : ''} onClick={() => patch({ flowMode: mode })}>{label}</button>)}</div>
    {object.flowMode === 'arrow' && <div className="flow-carrier-tabs" aria-label="箭头载体">{[['ribbon', '宽线带'], ['tube', '实体管'], ['none', '无载体']].map(([carrier, label]) => <button key={carrier} className={arrowCarrier === carrier ? 'active' : ''} onClick={() => patch({ flowArrowCarrier: carrier })}>{label}</button>)}</div>}
    <div className="flow-color-fields"><ColorField label="流光颜色" value={object.flowGlowColor || object.flowEmissive || '#2bbac7'} onChange={(flowGlowColor) => patch({ flowGlowColor })} /><ColorField label="箭头颜色" value={object.flowArrowColor || object.flowEmissive || '#70f3ff'} onChange={(flowArrowColor) => patch({ flowArrowColor })} /></div>
    {object.flowMode === 'texture' && <><button className="flow-texture-upload" onClick={() => inputRef.current?.click()}><ImagePlus size={14} /><span><strong>{object.flowTextureName || '上传流动贴图'}</strong><small>PNG / JPG / WEBP · 沿管道 UV 滚动</small></span></button><input ref={inputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => { upload(event.target.files[0]); event.target.value = '' }} />{error && <div className="texture-error">{error}</div>}</>}
    <div className="flow-fields">
      <Field label="radius · 管径" value={object.pipeRadius ?? 0.16} min={0.02} step={0.02} onChange={(pipeRadius) => patch({ pipeRadius: Math.max(0.02, pipeRadius) })} />
      {['catmullrom'].includes(object.pipeCurveType || 'catmullrom') && <Field label="tension · 弯曲张力" value={object.pipeTension ?? 0.5} min={0} max={1} step={0.05} onChange={(pipeTension) => patch({ pipeTension })} />}
      {object.pipeCurveType === 'curvePath' && <Field label="bendFactor · 弯头比例" value={object.pipeBendFactor ?? 0.22} min={0.02} max={0.48} step={0.02} onChange={(pipeBendFactor) => patch({ pipeBendFactor })} />}
      <Field label="tubularSegments · 路径分段" value={object.pipeSegments ?? 96} min={8} step={8} onChange={(pipeSegments) => patch({ pipeSegments: Math.max(8, Math.round(pipeSegments)) })} />
      <Field label="radialSegments · 截面分段" value={object.pipeRadialSegments ?? 16} min={3} step={1} onChange={(pipeRadialSegments) => patch({ pipeRadialSegments: Math.max(3, Math.round(pipeRadialSegments)) })} />
      <Field label="speed · 速度" value={object.flowSpeed ?? 0.5} min={0} step={0.1} onChange={(flowSpeed) => patch({ flowSpeed: Math.max(0, flowSpeed) })} />
      {object.flowMode === 'arrow' ? <><Field label="pathWidth · 路径宽度" value={object.flowPathWidth ?? 0.09} min={0.025} max={0.8} step={0.01} onChange={(flowPathWidth) => patch({ flowPathWidth: Math.max(0.025, flowPathWidth) })} /><Field label="arrowSize · 箭头尺寸" value={object.flowArrowSize ?? 0.28} min={0.04} max={2} step={0.02} onChange={(flowArrowSize) => patch({ flowArrowSize: Math.max(0.04, flowArrowSize) })} /><Field label="density · 箭头密度" value={object.flowArrowDensity ?? (1 / Math.max(0.08, object.flowArrowSpacing ?? 0.72))} min={0.2} max={8} step={0.1} onChange={(flowArrowDensity) => patch({ flowArrowDensity: Math.max(0.2, flowArrowDensity) })} /><Field label="tailLength · 尾迹长度" value={object.flowArrowTailLength ?? 2.4} min={0.8} max={8} step={0.2} onChange={(flowArrowTailLength) => patch({ flowArrowTailLength })} /></> : <><Field label="repeat · 流光密度" value={object.flowRepeat ?? 4} min={0.25} step={0.25} onChange={(flowRepeat) => patch({ flowRepeat: Math.max(0.25, flowRepeat) })} /><Field label="intensity · 发光强度" value={object.flowIntensity ?? 1.5} min={0} step={0.1} onChange={(flowIntensity) => patch({ flowIntensity: Math.max(0, flowIntensity) })} /></>}
      <label className="pipe-closed-field"><span>closed · 首尾闭合</span><input type="checkbox" checked={Boolean(object.pipeClosed)} onChange={(event) => patch({ pipeClosed: event.target.checked })} /></label>
    </div>
    <div className="flow-direction"><button className={object.flowDirection !== 'reverse' ? 'active' : ''} onClick={() => patch({ flowDirection: 'forward' })}>正向</button><button className={object.flowDirection === 'reverse' ? 'active' : ''} onClick={() => patch({ flowDirection: 'reverse' })}>反向</button><ArrowLeftRight size={13} /></div>
    <div className="path-head"><span>控制点 · {points.length}</span><div><button title="重置路径" onClick={() => patch({ pipePoints: [[-1.8, 0, 0], [-0.6, 0.7, 0], [0.7, -0.2, 0.4], [1.8, 0.4, 0]] })}><RotateCcw size={12} /></button><button title="添加控制点" onClick={() => { const last = points.at(-1) || [0, 0, 0]; patch({ pipePoints: [...points, [last[0] + 1, last[1], last[2]]] }) }}><Plus size={12} /></button></div></div>
    <div className="path-points flow-points">{points.map((point, index) => <div className="path-point" key={index}><b>{String(index + 1).padStart(2, '0')}</b>{point.map((value, axis) => <NumberInput key={axis} aria-label={`管道控制点 ${index + 1} ${'XYZ'[axis]}`} step="0.1" value={value} onValueChange={(number) => { const next = points.map((item) => [...item]); next[index][axis] = number; patch({ pipePoints: next }) }} />)}<button title="删除控制点" disabled={points.length <= 2} onClick={() => patch({ pipePoints: points.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button></div>)}</div>
  </section>
}
