import React, { useMemo } from 'react'
import { ChevronDown, Gauge, Pause, Play, Plus, RotateCw, Square, Trash2, Waves } from 'lucide-react'
import { NumberInput } from '../../components/NumberInput'
import { useEditor } from '../../store'
import { useAnimationRuntime } from './animationStore'

const EFFECTS = {
  rotate: { label: '旋转', description: 'Rotate · 按轴持续旋转', defaults: { axis: 'y', angle: 360, duration: 4, loop: true, easing: 'linear' } },
  float: { label: '浮动', description: 'Float · 往返漂浮', defaults: { axis: 'y', amount: 0.35, duration: 2.5, loop: true, direction: 'alternate', easing: 'easeInOut' } },
  move: { label: '位移', description: 'Move · 沿指定轴移动', defaults: { axis: 'x', amount: 2, duration: 2, loop: false, easing: 'easeInOut' } },
  pulse: { label: '脉冲', description: 'Pulse · 呼吸缩放', defaults: { amount: 0.5, duration: 1.6, loop: true, easing: 'easeInOut' } },
  fade: { label: '淡入淡出', description: 'Fade · 材质透明动画', defaults: { from: 0.15, to: 1, duration: 2, loop: true, direction: 'alternate', easing: 'easeInOut' } },
  blink: { label: '闪烁', description: 'Blink · 周期显示隐藏', defaults: { duration: 1, loop: true, easing: 'linear' } },
  keyframe: { label: '关键帧', description: 'KeyframeTrack · 多关键帧插值', defaults: { channel: 'position', duration: 2, loop: false, easing: 'linear', keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [2, 1, 0] }] } },
}

const PRESETS = [
  { id: 'equipment', label: '设备旋转', note: 'Rotate · 匀速循环' },
  { id: 'door', label: '门轴开合', note: 'Keyframe · 旋转 90°' },
  { id: 'piston', label: '活塞往复', note: 'Keyframe · 直线循环' },
  { id: 'pendulum', label: '摆锤巡检', note: 'Keyframe · 弧线摆动' },
  { id: 'alarm', label: '告警呼吸', note: 'Pulse + Blink' },
]

export function AnimationPanel() {
  const objects = useEditor((state) => state.objects)
  const selectedId = useEditor((state) => state.selectedId)
  const updateObject = useEditor((state) => state.updateObject)
  const object = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId])
  const { playing, paused, currentTime, timelineDuration, play, pause, resumeFromPause, stop, seek, setTimelineDuration } = useAnimationRuntime()
  if (!object) return <div className="no-selection"><Waves size={24} /><span>选择对象后添加动画</span></div>
  const animations = object.animations || []
  const setAnimations = (next) => updateObject(object.id, { animations: next })
  const add = (type) => setAnimations([...animations, { id: `animation-${Date.now()}`, name: EFFECTS[type].label, type, enabled: true, delay: 0, direction: 'normal', ...EFFECTS[type].defaults }])
  const patch = (id, values) => setAnimations(animations.map((item) => item.id === id ? { ...item, ...values } : item))
  const remove = (id) => setAnimations(animations.filter((item) => item.id !== id))
  const applyPreset = (id) => {
    const base = Date.now()
    const track = (index, values) => ({ id: `animation-${base}-${index}`, enabled: true, delay: 0, easing: 'easeInOut', direction: 'normal', ...values })
    let additions = []
    if (id === 'equipment') additions = [track(0, { name: '设备持续旋转', type: 'rotate', axis: 'y', angle: 360, duration: 4, loop: true, easing: 'linear' })]
    if (id === 'door') additions = [track(0, { name: '门轴开合', type: 'keyframe', channel: 'rotation', duration: 1.2, loop: false, keyframes: [{ time: 0, value: [...object.rotation] }, { time: 1.2, value: [object.rotation[0], object.rotation[1] + Math.PI / 2, object.rotation[2]] }] })]
    if (id === 'piston') additions = [track(0, { name: '活塞往复', type: 'keyframe', channel: 'position', duration: 1.6, loop: true, direction: 'alternate', keyframes: [{ time: 0, value: [...object.position] }, { time: 1.6, value: [object.position[0] + 1.5, object.position[1], object.position[2]] }] })]
    if (id === 'pendulum') additions = [track(0, { name: '摆锤巡检', type: 'keyframe', channel: 'rotation', duration: 2.4, loop: true, keyframes: [{ time: 0, value: [object.rotation[0], object.rotation[1], object.rotation[2] - 0.55] }, { time: 1.2, value: [object.rotation[0], object.rotation[1], object.rotation[2] + 0.55] }, { time: 2.4, value: [object.rotation[0], object.rotation[1], object.rotation[2] - 0.55] }] })]
    if (id === 'alarm') additions = [track(0, { name: '告警呼吸', type: 'pulse', amount: 0.65, duration: 1.2, loop: true }), track(1, { name: '告警闪烁', type: 'blink', duration: 0.6, loop: true, easing: 'linear' })]
    setAnimations([...animations, ...additions])
    setTimelineDuration(Math.max(timelineDuration, ...additions.map((item) => item.duration || 0)))
  }
  return <div className="animation-panel">
    <div className="animation-summary"><div><RotateCw size={16} /><span><strong>{object.name}</strong><small>{animations.length} 条动画轨道</small></span></div><div className={`animation-runtime-state ${playing ? 'playing' : ''}`}><i />{playing ? paused ? '已暂停' : '播放中' : '已停止'}</div></div>
    {object.type === 'model' && <div className="clip-controller"><div><strong>AnimationClip · 模型片段</strong><label><input type="checkbox" checked={object.animationClipEnabled !== false} onChange={(event) => updateObject(object.id, { animationClipEnabled: event.target.checked })} />启用</label></div>{object.modelClips?.length ? <><select value={object.animationClipName || object.modelClips[0]} onChange={(event) => updateObject(object.id, { animationClipName: event.target.value })}>{object.modelClips.map((name) => <option key={name}>{name}</option>)}</select><div><label><span>speed · 速度</span><NumberInput step="0.1" value={object.animationClipSpeed ?? 1} onValueChange={(animationClipSpeed) => updateObject(object.id, { animationClipSpeed })} /></label><label><span>weight · 权重</span><NumberInput min="0" max="1" step="0.05" value={object.animationClipWeight ?? 1} onValueChange={(animationClipWeight) => updateObject(object.id, { animationClipWeight })} /></label><label><span>fade · 过渡</span><NumberInput min="0" step="0.05" value={object.animationClipFade ?? 0.2} onValueChange={(animationClipFade) => updateObject(object.id, { animationClipFade })} /></label><label><span>loop · 循环</span><select value={object.animationClipLoop || 'repeat'} onChange={(event) => updateObject(object.id, { animationClipLoop: event.target.value })}><option value="repeat">repeat</option><option value="once">once</option><option value="pingpong">pingpong</option></select></label></div></> : <small>该模型没有 AnimationClip</small>}</div>}
    <div className="animation-transport"><button onClick={() => playing ? (paused ? resumeFromPause() : pause()) : play()}>{playing && !paused ? <Pause size={14} /> : <Play size={14} />}{playing && !paused ? '暂停' : '播放'}</button><button onClick={stop}><Square size={13} />停止</button></div>
    <div className="animation-timeline"><div><span>Timeline</span><b>{currentTime.toFixed(2)}s /</b><NumberInput min="0.1" step="0.5" value={timelineDuration} onValueChange={setTimelineDuration} /></div><input type="range" min="0" max={timelineDuration} step="0.01" value={Math.min(currentTime, timelineDuration)} onChange={(event) => seek(Number(event.target.value))} /></div>
    <div className="animation-presets"><span>案例预设 · Examples</span><div>{PRESETS.map((preset) => <button key={preset.id} title={preset.note} onClick={() => applyPreset(preset.id)}><Gauge size={12} /><span>{preset.label}</span><small>{preset.note}</small></button>)}</div></div>
    <div className="animation-add"><span>添加效果</span><div>{Object.entries(EFFECTS).map(([type, effect]) => <button key={type} onClick={() => add(type)} title={effect.description}><Plus size={11} />{effect.label}</button>)}</div></div>
    <div className="animation-tracks">{animations.length === 0 ? <div className="animation-empty"><Waves size={22} /><span>尚未添加动画</span><small>从上方选择一种效果</small></div> : animations.map((animation, index) => <section key={animation.id} className="animation-track">
      <div className="animation-track-head"><ChevronDown size={12} /><b>{String(index + 1).padStart(2, '0')}</b><input value={animation.name} onChange={(event) => patch(animation.id, { name: event.target.value })} /><button onClick={() => remove(animation.id)} title="删除动画"><Trash2 size={12} /></button></div>
      <div className="animation-track-grid"><label><span>type · 类型</span><select value={animation.type} onChange={(event) => patch(animation.id, { type: event.target.value, ...EFFECTS[event.target.value].defaults })}>{Object.entries(EFFECTS).map(([type, effect]) => <option key={type} value={type}>{effect.label}</option>)}</select></label><label><span>axis · 轴</span><select value={animation.axis || 'y'} disabled={['pulse', 'fade', 'blink'].includes(animation.type)} onChange={(event) => patch(animation.id, { axis: event.target.value })}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label><label><span>duration · 时长</span><NumberInput min="0.05" step="0.1" value={animation.duration} onValueChange={(duration) => patch(animation.id, { duration })} /></label><label><span>delay · 延迟</span><NumberInput min="0" step="0.1" value={animation.delay || 0} onValueChange={(delay) => patch(animation.id, { delay })} /></label><label><span>amount · 幅度</span><NumberInput step="0.1" value={animation.type === 'rotate' ? animation.angle ?? 360 : animation.amount ?? 1} onValueChange={(amount) => patch(animation.id, animation.type === 'rotate' ? { angle: amount } : { amount })} /></label><label><span>easing · 缓动</span><select value={animation.easing || 'easeInOut'} onChange={(event) => patch(animation.id, { easing: event.target.value })}><option value="linear">linear</option><option value="easeIn">easeIn</option><option value="easeOut">easeOut</option><option value="easeInOut">easeInOut</option></select></label></div>
      {animation.type === 'keyframe' && <div className="keyframe-editor"><div><span>channel · 属性</span><select value={animation.channel || 'position'} onChange={(event) => patch(animation.id, { channel: event.target.value })}><option value="position">position</option><option value="rotation">rotation</option><option value="scale">scale</option></select></div>{(animation.keyframes || []).map((frame, frameIndex) => <div key={frameIndex} className="keyframe-row"><b>{frameIndex + 1}</b><NumberInput step="0.1" value={frame.time} onValueChange={(time) => { const keyframes = animation.keyframes.map((item, index) => index === frameIndex ? { ...item, time } : item); patch(animation.id, { keyframes }) }} />{frame.value.map((value, valueIndex) => <NumberInput key={valueIndex} step="0.1" value={value} onValueChange={(nextValue) => { const keyframes = animation.keyframes.map((item, index) => index === frameIndex ? { ...item, value: item.value.map((number, axisIndex) => axisIndex === valueIndex ? nextValue : number) } : item); patch(animation.id, { keyframes }) }} />)}</div>)}</div>}
      <div className="animation-track-options"><label><input type="checkbox" checked={animation.enabled !== false} onChange={(event) => patch(animation.id, { enabled: event.target.checked })} />启用</label><label><input type="checkbox" checked={Boolean(animation.loop)} onChange={(event) => patch(animation.id, { loop: event.target.checked })} />循环 loop</label><select value={animation.direction || 'normal'} onChange={(event) => patch(animation.id, { direction: event.target.value })}><option value="normal">正向 normal</option><option value="reverse">反向 reverse</option><option value="alternate">往返 alternate</option></select></div>
    </section>)}</div>
  </div>
}
