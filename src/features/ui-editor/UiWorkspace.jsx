import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Check, ChevronDown, Copy, Eye, EyeOff, Grid3X3, ImagePlus, Layers, LayoutTemplate, Magnet, Maximize, Monitor, MousePointer2, Plus, Redo2, Search, Settings2, Smartphone, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { NumberInput } from '../../components/NumberInput'
import { UI_TEMPLATES, createUiTemplate, moveUiNode, readUiProject, uiNodeStyle } from './uiProject'
import './ui-editor.css'

const TYPE_LABELS = { text: '文本', panel: '容器', button: '按钮', image: '图片' }
const iconFor = (type) => type === 'text' ? Type : type === 'image' ? ImagePlus : type === 'button' ? MousePointer2 : LayoutTemplate
const sizes = { '1440x900': '桌面', '1920x1080': '大屏', '390x844': '手机' }

function ToolButton({ icon: Icon, label, onClick, active, disabled }) {
  return <button type="button" className={`design-icon ${active ? 'active' : ''}`} aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}><Icon size={15} /></button>
}

function Field({ label, value, onChange, min, max, step = 1 }) {
  return <label className="design-field"><span>{label}</span><NumberInput aria-label={label} min={min} max={max} step={step} value={value} onValueChange={onChange} /></label>
}

function ColorField({ label, value, onChange }) {
  return <label className="design-color"><span>{label}</span><div><input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(event) => onChange(event.target.value)} /><code>{value}</code></div></label>
}

export function UiWorkspace() {
  const [project, setProject] = useState(() => readUiProject())
  const current = useRef(project)
  const [selectedId, setSelectedId] = useState(null)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [leftTab, setLeftTab] = useState('layers')
  const [query, setQuery] = useState('')
  const [zoomOverride, setZoomOverride] = useState(null)
  const [areaSize, setAreaSize] = useState({ width: 800, height: 600 })
  const [grid, setGrid] = useState(true)
  const [snap, setSnap] = useState(true)
  const [preview, setPreview] = useState(false)
  const [status, setStatus] = useState('所有更改已保存')
  const stage = useRef(null)
  const operation = useRef(null)
  const imageInput = useRef(null)
  const inspector = useRef(null)
  const { canvas, nodes } = project
  const selected = nodes.find((node) => node.id === selectedId)
  useEffect(() => { inspector.current?.scrollTo({ top: 0 }) }, [selectedId])
  const fit = Math.max(.1, Math.min((areaSize.width - 96) / canvas.width, (areaSize.height - 110) / canvas.height, 1))
  const zoom = zoomOverride ?? fit
  const live = useCallback((next) => { current.current = next; setProject(next) }, [])
  const change = useCallback((transform) => {
    const before = current.current
    const next = transform(before)
    if (JSON.stringify(before) === JSON.stringify(next)) return
    setPast((items) => [...items.slice(-39), before]); setFuture([]); live(next)
  }, [live])
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('frame-ui-nodes')
      if (legacy && localStorage.getItem('frame-ui-version') !== '2' && !localStorage.getItem('frame-ui-legacy-backup')) {
        localStorage.setItem('frame-ui-legacy-backup', JSON.stringify({ nodes: JSON.parse(legacy), canvas: JSON.parse(localStorage.getItem('frame-ui-canvas-size') || 'null'), template: localStorage.getItem('frame-ui-template'), version: 1 }))
      }
      localStorage.setItem('frame-ui-nodes', JSON.stringify(project.nodes))
      localStorage.setItem('frame-ui-canvas-size', JSON.stringify(project.canvas))
      localStorage.setItem('frame-ui-template', project.template)
      localStorage.setItem('frame-ui-version', '2')
      setStatus('所有更改已保存')
    } catch { setStatus('本地存储已满，请先导出项目') }
  }, [project])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAreaSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    if (stage.current) observer.observe(stage.current)
    return () => observer.disconnect()
  }, [])
  const patchNode = (patch) => change((value) => ({ ...value, nodes: value.nodes.map((node) => node.id === selectedId ? { ...node, ...patch } : node) }))
  const patchCanvas = (patch) => { change((value) => ({ ...value, canvas: { ...value.canvas, ...patch } })); setZoomOverride(null) }
  const remove = useCallback(() => { if (!selectedId) return; change((value) => ({ ...value, nodes: value.nodes.filter((node) => node.id !== selectedId) })); setSelectedId(null) }, [selectedId, change])
  const duplicate = useCallback(() => {
    const source = current.current.nodes.find((node) => node.id === selectedId)
    if (!source) return
    const node = { ...source, id: crypto.randomUUID(), name: `${source.name} 副本`, ...moveUiNode(source, 16, 16, current.current.canvas) }
    change((value) => ({ ...value, nodes: [...value.nodes, node] })); setSelectedId(node.id)
  }, [selectedId, change])
  const undo = useCallback(() => { if (!past.length) return; const next = past[past.length - 1]; const before = current.current; setFuture((items) => [before, ...items]); setPast(past.slice(0, -1)); live(next) }, [past, live])
  const redo = useCallback(() => { if (!future.length) return; const next = future[0]; const before = current.current; setPast((items) => [...items.slice(-39), before]); setFuture(future.slice(1)); live(next) }, [future, live])
  const add = (type, src) => {
    const node = { id: crypto.randomUUID(), type, name: TYPE_LABELS[type], text: type === 'text' ? '在此输入标题' : type === 'button' ? '立即开始' : '', x: 80, y: 80, width: type === 'panel' || type === 'image' ? 320 : 200, height: type === 'panel' || type === 'image' ? 180 : type === 'text' ? 48 : 44, color: type === 'text' ? (project.template === 'tech' ? '#edf0eb' : '#272c2a') : type === 'button' ? '#de8458' : '#e4e8df', textColor: '#ffffff', radius: type === 'text' ? 0 : 12, fontSize: type === 'text' ? 28 : 16, src }
    change((value) => ({ ...value, nodes: [...value.nodes, node] })); setSelectedId(node.id); setLeftTab('layers')
  }
  const reorder = (offset) => change((value) => {
    const list = [...value.nodes]; const index = list.findIndex((node) => node.id === selectedId)
    const target = Math.min(list.length - 1, Math.max(0, index + offset))
    if (index < 0) return value
    ;[list[index], list[target]] = [list[target], list[index]]
    return { ...value, nodes: list }
  })
  const align = (direction) => {
    if (!selected) return
    patchNode({ x: Math.round(direction === 'left' ? 0 : direction === 'right' ? canvas.width - selected.width : (canvas.width - selected.width) / 2) })
  }
  useEffect(() => {
    const key = (event) => {
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]')) return
      const command = event.ctrlKey || event.metaKey
      if (event.key === 'Escape') { setPreview(false); setSelectedId(null) }
      if (preview) return
      if (command && event.code === 'KeyZ') { event.preventDefault(); event.shiftKey ? redo() : undo() }
      if (command && event.code === 'KeyD') { event.preventDefault(); duplicate() }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove() }
      if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const amount = event.shiftKey ? 10 : 1
        change((value) => ({ ...value, nodes: value.nodes.map((node) => node.id === selectedId ? { ...node, ...moveUiNode(node, event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0, event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0, value.canvas) } : node) }))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [selectedId, preview, undo, redo, duplicate, remove, change])
  useEffect(() => {
    const move = (event) => {
      const op = operation.current
      if (!op) return
      const dx = (event.clientX - op.pointerX) / op.zoom; const dy = (event.clientY - op.pointerY) / op.zoom
      let patch
      if (op.kind === 'move') patch = moveUiNode(op.node, dx, dy, op.before.canvas, op.snap)
      else {
        let { x, y, width, height } = op.node
        if (op.direction.includes('e')) width = Math.max(16, width + dx)
        if (op.direction.includes('s')) height = Math.max(16, height + dy)
        if (op.direction.includes('w')) { const nextX = Math.min(x + width - 16, x + dx); width += x - nextX; x = nextX }
        if (op.direction.includes('n')) { const nextY = Math.min(y + height - 16, y + dy); height += y - nextY; y = nextY }
        patch = Object.fromEntries(Object.entries({ x, y, width, height }).map(([key, number]) => [key, Math.round(number)]))
      }
      live({ ...op.before, nodes: op.before.nodes.map((node) => node.id === op.node.id ? { ...node, ...patch } : node) })
    }
    const end = (event) => {
      const op = operation.current
      if (!op) return
      if (event.type === 'pointercancel') live(op.before)
      else if (JSON.stringify(op.before) !== JSON.stringify(current.current)) { setPast((items) => [...items.slice(-39), op.before]); setFuture([]) }
      operation.current = null; document.body.classList.remove('ui-dragging')
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); document.body.classList.remove('ui-dragging') }
  }, [live])
  const begin = (event, node, kind, direction = '') => {
    if (preview || event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); setSelectedId(node.id)
    operation.current = { before: current.current, node: { ...node }, kind, direction, pointerX: event.clientX, pointerY: event.clientY, zoom, snap }
    document.body.classList.add('ui-dragging')
  }
  const importImage = (event) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) { setStatus('请选择小于 3 MB 的图片'); return }
    const reader = new FileReader(); reader.onload = () => add('image', reader.result); reader.readAsDataURL(file)
  }

  return <div className={`workspace ui-workspace ui-design ${preview ? 'is-preview' : ''}`}>
    <aside className="left-panel panel design-library">
      <div className="panel-heading"><span>界面设计</span><span className="design-pill">DESIGN</span></div>
      <div className="design-page"><span className="design-page-icon"><Monitor size={18} /></span><div><strong>主界面</strong><small>{canvas.width} × {canvas.height} · {nodes.length} 个图层</small></div><Check size={13} /></div>
      <div className="design-tabs"><button className={leftTab === 'layers' ? 'active' : ''} onClick={() => setLeftTab('layers')}><Layers size={13} />图层</button><button className={leftTab === 'components' ? 'active' : ''} onClick={() => setLeftTab('components')}><Plus size={13} />组件与模板</button></div>
      {leftTab === 'layers' ? <>
        <label className="design-search"><Search size={13} /><input aria-label="搜索图层" placeholder="搜索图层…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="design-layer-list">{[...nodes].reverse().filter((node) => node.name.toLowerCase().includes(query.toLowerCase())).map((node) => { const Icon = iconFor(node.type); return <div key={node.id} className={`${selectedId === node.id ? 'selected' : ''} ${node.visible === false ? 'is-hidden' : ''}`}><button onClick={() => setSelectedId(node.id)}><Icon size={13} /><span>{node.name}</span></button><button aria-label={`${node.visible === false ? '显示' : '隐藏'}图层 ${node.name}`} onClick={() => change((value) => ({ ...value, nodes: value.nodes.map((item) => item.id === node.id ? { ...item, visible: item.visible === false } : item) }))}>{node.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button></div> })}{!nodes.some((node) => node.name.toLowerCase().includes(query.toLowerCase())) && <p className="design-empty">没有匹配的图层</p>}</div>
        <div className="design-library-bottom"><button onClick={() => setLeftTab('components')}><Plus size={15} />添加组件</button><span>点击图层选择 · 方向键微调</span></div>
      </> : <div className="design-components"><div className="design-section-label">基础组件 <span>4 COMPONENTS</span></div><div className="design-component-grid">{Object.entries(TYPE_LABELS).map(([type, label]) => { const Icon = iconFor(type); return <button key={type} onClick={() => type === 'image' ? imageInput.current?.click() : add(type)}><Icon size={21} /><strong>{label}</strong><small>{type === 'text' ? '标题与正文' : type === 'panel' ? '卡片与背景' : type === 'button' ? '交互入口' : '上传本地图片'}</small></button> })}</div><div className="design-section-label">从模板开始 <span>1440 × 900</span></div>{Object.entries(UI_TEMPLATES).map(([id, item]) => <button key={id} className={`design-template ${id === project.template ? 'active' : ''}`} onClick={() => { change(() => createUiTemplate(id)); setSelectedId(null); setZoomOverride(null) }}><div className={`design-template-thumb ${id}`}><i /><div><b /><span /><span /><span /><em /></div></div><strong>{item.label}{id === project.template && <Check size={12} />}</strong><small>{item.caption}</small></button>)}<p className="design-helper">应用模板会替换画板内容，可通过撤销恢复。</p></div>}
      <input ref={imageInput} type="file" accept="image/*" hidden onChange={importImage} />
    </aside>
    <main className="design-canvas">
      <div className="design-canvas-heading"><div><span>WORKSPACE</span><strong>主界面</strong></div><button className={preview ? 'active' : ''} onClick={() => setPreview(!preview)}><Eye size={14} />{preview ? '返回编辑' : '预览画板'}</button></div>
      <div className="design-toolbar"><div><ToolButton icon={MousePointer2} label="选择工具" active={!preview} onClick={() => setPreview(false)} /><span className="design-divider" /><ToolButton icon={Undo2} label="撤销 UI 编辑" disabled={!past.length || preview} onClick={undo} /><ToolButton icon={Redo2} label="重做 UI 编辑" disabled={!future.length || preview} onClick={redo} /></div><div><ToolButton icon={Grid3X3} label="画布网格" active={grid} onClick={() => setGrid(!grid)} /><ToolButton icon={Magnet} label="8 像素吸附" active={snap} onClick={() => setSnap(!snap)} /><span className="design-divider" /><ToolButton icon={ZoomOut} label="缩小画板" onClick={() => setZoomOverride(Math.max(.1, zoom - .1))} /><span className="design-zoom">{Math.round(zoom * 100)}%</span><ToolButton icon={ZoomIn} label="放大画板" onClick={() => setZoomOverride(Math.min(2, zoom + .1))} /><ToolButton icon={Maximize} label="适应窗口" onClick={() => setZoomOverride(null)} /></div></div>
      <div ref={stage} className={`design-stage ${grid ? 'show-grid' : ''}`} onPointerDown={() => { if (!preview) setSelectedId(null) }}><div className="design-stage-content" style={{ minWidth: canvas.width * zoom + 96, minHeight: canvas.height * zoom + 110 }}><div className="design-board-shell" style={{ width: canvas.width * zoom, height: canvas.height * zoom }}><div className="design-board-caption"><span><Monitor size={12} />主界面</span><code>{canvas.width} × {canvas.height}</code></div><div className="design-board" style={{ width: canvas.width, height: canvas.height, transform: `scale(${zoom})`, background: canvas.background }}>
        {nodes.map((node) => <div key={node.id} data-node-id={node.id} role={preview ? undefined : 'button'} tabIndex={preview || node.visible === false ? undefined : 0} aria-label={preview ? undefined : `选择图层 ${node.name}`} className={`design-node ${!preview && selectedId === node.id ? 'selected' : ''}`} style={uiNodeStyle(node, canvas)} onPointerDown={(event) => begin(event, node, 'move')} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(node.id) }}>{node.text}{!preview && selectedId === node.id && <><span className="design-selection-label" style={{ transform: `scale(${1 / zoom})` }}>{node.name} · {node.width} × {node.height}</span>{['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((direction) => <i key={direction} className={`design-resize handle-${direction}`} style={{ width: 7 / zoom, height: 7 / zoom }} onPointerDown={(event) => begin(event, node, 'resize', direction)} />)}</>}</div>)}
      </div></div></div></div>
      <div className="design-status"><span className={status.includes('已保存') ? 'saved' : ''}><Check size={11} />{status}</span><span>{preview ? '预览模式' : '拖动移动 · Shift + 方向键 10px'}</span></div>
    </main>
    <aside ref={inspector} className="right-panel panel design-inspector">
      <div className="panel-heading"><span>{selected ? '设计属性' : '画板设置'}</span><Settings2 size={14} /></div>
      {selected ? <>
        <div className="design-selection-heading"><span className="design-page-icon">{React.createElement(iconFor(selected.type), { size: 18 })}</span><div><input aria-label="图层名称" value={selected.name} onChange={(event) => patchNode({ name: event.target.value })} /><small>{TYPE_LABELS[selected.type]}图层</small></div><ToolButton icon={X} label="取消图层选择" onClick={() => setSelectedId(null)} /></div>
        <section><h3>位置与尺寸 <span>LAYOUT</span></h3><div className="design-align"><ToolButton icon={AlignLeft} label="左对齐画板" onClick={() => align('left')} /><ToolButton icon={AlignCenter} label="水平居中画板" onClick={() => align('center')} /><ToolButton icon={AlignRight} label="右对齐画板" onClick={() => align('right')} /><span className="design-divider" /><ToolButton icon={ArrowUp} label="图层上移一层" onClick={() => reorder(1)} /><ToolButton icon={ArrowDown} label="图层下移一层" onClick={() => reorder(-1)} /></div><div className="design-field-grid"><Field label="X" value={selected.x} onChange={(x) => patchNode({ x })} /><Field label="Y" value={selected.y} onChange={(y) => patchNode({ y })} /><Field label="宽度" min={16} value={selected.width} onChange={(width) => patchNode({ width })} /><Field label="高度" min={16} value={selected.height} onChange={(height) => patchNode({ height })} /></div></section>
        {selected.type !== 'image' && <section><h3>文字内容 <span>CONTENT</span></h3><textarea aria-label="图层文字内容" value={selected.text} onChange={(event) => patchNode({ text: event.target.value })} /><div className="design-field-grid"><Field label="字号" min={6} max={200} value={selected.fontSize || 16} onChange={(fontSize) => patchNode({ fontSize })} /><label className="design-field"><span>字重</span><select aria-label="文字字重" value={selected.fontWeight || 400} onChange={(event) => patchNode({ fontWeight: Number(event.target.value) })}><option value={400}>常规</option><option value={500}>中等</option><option value={600}>半粗</option><option value={700}>加粗</option></select></label></div></section>}
        <section><h3>外观 <span>APPEARANCE</span></h3><ColorField label={selected.type === 'text' ? '文字颜色' : '填充颜色'} value={selected.color} onChange={(color) => patchNode({ color })} />{selected.type !== 'text' && selected.text && <ColorField label="文字颜色" value={selected.textColor || '#ffffff'} onChange={(textColor) => patchNode({ textColor })} />}<div className="design-field-grid"><Field label="圆角" min={0} value={selected.radius || 0} onChange={(radius) => patchNode({ radius })} /><Field label="不透明度 %" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)} onChange={(opacity) => patchNode({ opacity: opacity / 100 })} /></div></section>
        <div className="design-inspector-actions"><button onClick={duplicate}><Copy size={14} />复制图层</button><button className="danger" onClick={remove}><Trash2 size={14} />删除</button></div>
      </> : <>
        <div className="design-board-intro"><span><LayoutTemplate size={23} /></span><strong>从画板，构建你的界面。</strong><p>选择图层编辑样式，或添加组件开始设计。</p></div>
        <section><h3>画板尺寸 <span>CANVAS</span></h3><label className="design-preset"><Monitor size={14} /><select aria-label="画板设备规格" value={`${canvas.width}x${canvas.height}`} onChange={(event) => { const [width, height] = event.target.value.split('x').map(Number); patchCanvas({ width, height }) }}>{Object.entries(sizes).map(([value, label]) => <option key={value} value={value}>{label} · {value.replace('x', ' × ')}</option>)}{!sizes[`${canvas.width}x${canvas.height}`] && <option value={`${canvas.width}x${canvas.height}`}>自定义</option>}</select></label><div className="design-field-grid"><Field label="画板宽度" min={240} max={7680} value={canvas.width} onChange={(width) => patchCanvas({ width })} /><Field label="画板高度" min={240} max={4320} value={canvas.height} onChange={(height) => patchCanvas({ height })} /></div></section><section><h3>画板背景 <span>BACKGROUND</span></h3><ColorField label="背景颜色" value={canvas.background} onChange={(background) => patchCanvas({ background })} /></section><div className="design-shortcuts"><strong>快捷操作</strong><span>微调位置 <kbd>↑ ↓ ← →</kbd></span><span>复制图层 <kbd>Ctrl D</kbd></span><span>撤销 / 重做 <kbd>Ctrl Z / ⇧ Z</kbd></span><span>退出预览 <kbd>Esc</kbd></span></div>
      </>}
    </aside>
  </div>
}
