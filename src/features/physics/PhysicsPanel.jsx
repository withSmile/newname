import React, { useMemo } from 'react'
import { Activity, ArrowUp, Box, CircleDot, RotateCcw, RotateCw, Square, Zap } from 'lucide-react'
import { useEditor } from '../../store'
import { usePhysicsRuntime } from './physicsStore'

const PRESETS = [
  { id: 'bounce', label: '弹跳物体', description: '高弹性 + CCD，适合落球与碰撞演示' },
  { id: 'door', label: '门轴', description: 'RevoluteJoint · 铰链旋转限制' },
  { id: 'piston', label: '活塞', description: 'PrismaticJoint · 直线滑轨马达' },
  { id: 'pendulum', label: '摆锤', description: 'RevoluteJoint · 重力驱动摆动' },
]

export function PhysicsPanel() {
  const objects = useEditor((state) => state.objects)
  const selectedId = useEditor((state) => state.selectedId)
  const updateObject = useEditor((state) => state.updateObject)
  const object = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId])
  const { enabled, debug, gravity, collisionCount, lastCollision, setEnabled, setDebug, setGravity, dispatch, reset } = usePhysicsRuntime()
  if (!object) return <div className="no-selection"><Box size={24} /><span>选择对象后配置物理</span></div>

  const patch = (values) => updateObject(object.id, values)
  const number = (label, key, fallback, step = 0.1, options = {}) => <label><span>{label}</span><input type="number" step={step} min={options.min} max={options.max} value={object[key] ?? fallback} onChange={(event) => patch({ [key]: Number(event.target.value) })} /></label>
  const vectorInputs = (label, key, fallback, step = 0.1) => <div className="physics-vector"><span>{label}</span>{(object[key] || fallback).map((value, index) => <input key={index} type="number" step={step} value={value} onChange={(event) => { const next = [...(object[key] || fallback)]; next[index] = Number(event.target.value); patch({ [key]: next }) }} />)}</div>
  const axisLocks = (label, key) => <div className="physics-axis-lock"><span>{label}</span>{['X', 'Y', 'Z'].map((axis, index) => <label key={axis}><input type="checkbox" checked={Boolean(object[key]?.[index])} onChange={(event) => { const next = [...(object[key] || [false, false, false])]; next[index] = event.target.checked; patch({ [key]: next }) }} />{axis}</label>)}</div>

  const applyPreset = (id) => {
    const size = object.physicsSize || [1, 1, 1]
    const common = { physicsEnabled: true, physicsBodyType: 'dynamic', canSleep: true }
    if (id === 'bounce') patch({ ...common, restitution: 0.82, friction: 0.3, ccdEnabled: true, physicsJoint: 'none' })
    if (id === 'door') patch({ ...common, gravityScale: 0, physicsJoint: 'revolute', jointAnchor: [-size[0] * 0.5, 0, 0], jointAxis: [0, 1, 0], jointLimitsEnabled: true, jointLimitMin: 0, jointLimitMax: 1.57, jointMotorEnabled: true, jointMotorVelocity: 0.8, jointMotorFactor: 2 })
    if (id === 'piston') patch({ ...common, gravityScale: 0, physicsJoint: 'prismatic', jointAnchor: [0, 0, 0], jointAxis: [1, 0, 0], jointLimitsEnabled: true, jointLimitMin: -1.5, jointLimitMax: 1.5, jointMotorEnabled: true, jointMotorVelocity: 1, jointMotorFactor: 3, lockRotations: [true, true, true] })
    if (id === 'pendulum') patch({ ...common, gravityScale: 1, physicsJoint: 'revolute', jointAnchor: [0, size[1] * 0.5, 0], jointAxis: [0, 0, 1], jointLimitsEnabled: true, jointLimitMin: -1.25, jointLimitMax: 1.25, jointMotorEnabled: false })
  }

  const bodyType = object.physicsBodyType || 'dynamic'
  const jointType = object.physicsJoint || 'none'
  return <div className="physics-panel">
    <div className="physics-summary"><div><Box size={16} /><span><strong>Rapier Physics</strong><small>{object.name}</small></span></div><button onClick={reset}><RotateCcw size={13} />重置模拟</button></div>
    <div className="physics-global">
      <label><span>physicsWorld · 运行</span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /></label>
      <label><span>debugRender · 调试线框</span><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /></label>
      <div><span>gravity · 重力</span>{gravity.map((value, index) => <input key={index} type="number" step="0.1" value={value} onChange={(event) => { const next = [...gravity]; next[index] = Number(event.target.value); setGravity(next) }} />)}</div>
    </div>

    <section className="physics-presets"><h3>物理案例 · Presets</h3><div>{PRESETS.map((preset) => <button key={preset.id} title={preset.description} onClick={() => applyPreset(preset.id)}><CircleDot size={12} /><span>{preset.label}</span><small>{preset.description.split(' · ')[0]}</small></button>)}</div></section>

    <section><h3>对象刚体 · RigidBody</h3>
      <label className="physics-toggle"><span>physicsEnabled · 启用</span><input type="checkbox" checked={Boolean(object.physicsEnabled)} onChange={(event) => patch({ physicsEnabled: event.target.checked })} /></label>
      {object.physicsEnabled && <>
        <div className="physics-selects"><label><span>bodyType · 类型</span><select value={bodyType} onChange={(event) => patch({ physicsBodyType: event.target.value })}><option value="dynamic">dynamic · 动态</option><option value="fixed">fixed · 固定</option><option value="kinematic">kinematic · 动画驱动</option></select></label><label><span>collider · 碰撞体</span><select value={object.colliderType || 'cuboid'} onChange={(event) => patch({ colliderType: event.target.value })}><option value="cuboid">Cuboid</option><option value="ball">Ball</option><option value="capsule">Capsule</option><option value="cylinder">Cylinder</option></select></label></div>
        <div className="physics-fields">{number('mass · 质量', 'mass', 1, 0.1, { min: 0 })}{number('density · 密度', 'density', 1, 0.1, { min: 0.001 })}{number('friction · 摩擦', 'friction', 0.5, 0.05, { min: 0, max: 1 })}{number('restitution · 弹性', 'restitution', 0.1, 0.05, { min: 0, max: 1 })}{number('linearDamping · 线性阻尼', 'linearDamping', 0.1, 0.05, { min: 0 })}{number('angularDamping · 角阻尼', 'angularDamping', 0.1, 0.05, { min: 0 })}{number('gravityScale · 重力倍率', 'gravityScale', 1, 0.1)}</div>
        {vectorInputs('colliderSize · 尺寸 XYZ', 'physicsSize', [1, 1, 1])}
        {axisLocks('lockTranslations · 锁定位移', 'lockTranslations')}{axisLocks('lockRotations · 锁定旋转', 'lockRotations')}
        <div className="physics-flags"><label><input type="checkbox" checked={object.canSleep !== false} onChange={(event) => patch({ canSleep: event.target.checked })} />canSleep · 休眠</label><label><input type="checkbox" checked={Boolean(object.ccdEnabled)} onChange={(event) => patch({ ccdEnabled: event.target.checked })} />CCD · 连续检测</label><label><input type="checkbox" checked={Boolean(object.physicsSensor)} onChange={(event) => patch({ physicsSensor: event.target.checked })} />sensor · 触发器</label></div>
      </>}
    </section>

    {object.physicsEnabled && bodyType === 'dynamic' && <section><h3>物理动画 · Forces & Joints</h3>
      <div className="physics-actions"><button onClick={() => dispatch(object.id, 'impulse', [0, Math.max(1, object.mass || 1) * 5, 0])}><ArrowUp size={13} />向上冲量</button><button onClick={() => dispatch(object.id, 'torque', [0, Math.max(1, object.mass || 1) * 2, 0])}><RotateCw size={13} />旋转冲量</button><button onClick={() => dispatch(object.id, 'clear')}><Square size={12} />清零速度</button></div>
      <div className="physics-selects physics-joint-select"><label><span>jointType · 关节</span><select value={jointType} onChange={(event) => patch({ physicsJoint: event.target.value })}><option value="none">none · 无</option><option value="revolute">revolute · 铰链</option><option value="prismatic">prismatic · 滑轨</option><option value="rope">rope · 绳索</option><option value="spring">spring · 弹簧</option></select></label><label><span>用途</span><output>{jointType === 'revolute' ? '门轴 / 摆锤' : jointType === 'prismatic' ? '活塞 / 滑台' : jointType === 'rope' ? '吊装 / 限长' : jointType === 'spring' ? '悬挂 / 缓冲' : '自由刚体'}</output></label></div>
      {jointType !== 'none' && <div className="physics-joint-fields">{vectorInputs('anchor · 局部锚点 XYZ', 'jointAnchor', [0, 0, 0])}{['revolute', 'prismatic'].includes(jointType) && vectorInputs('axis · 运动轴 XYZ', 'jointAxis', [0, 1, 0])}{['rope', 'spring'].includes(jointType) && <div className="physics-fields">{number('length · 静止长度', 'jointLength', 1, 0.1, { min: 0.01 })}{jointType === 'spring' && number('stiffness · 刚度', 'jointStiffness', 25, 1, { min: 0 })}{jointType === 'spring' && number('damping · 阻尼', 'jointDamping', 2, 0.1, { min: 0 })}</div>}{['revolute', 'prismatic'].includes(jointType) && <><div className="physics-flags physics-joint-flags"><label><input type="checkbox" checked={Boolean(object.jointLimitsEnabled)} onChange={(event) => patch({ jointLimitsEnabled: event.target.checked })} />limits · 限位</label><label><input type="checkbox" checked={Boolean(object.jointMotorEnabled)} onChange={(event) => patch({ jointMotorEnabled: event.target.checked })} />motor · 马达</label></div>{object.jointLimitsEnabled && <div className="physics-fields">{number('limitMin · 最小', 'jointLimitMin', -1)}{number('limitMax · 最大', 'jointLimitMax', 1)}</div>}{object.jointMotorEnabled && <div className="physics-fields">{number('targetVelocity · 目标速度', 'jointMotorVelocity', 1)}{number('motorFactor · 马达系数', 'jointMotorFactor', 1, 0.1, { min: 0 })}</div>}</>}</div>}
    </section>}

    <section className="physics-events"><h3>碰撞事件 · CollisionEvents</h3><div><Activity size={14} /><span><strong>{collisionCount}</strong><small>{lastCollision ? `${lastCollision.first} ↔ ${lastCollision.second}` : '等待碰撞或传感器进入'}</small></span><Zap size={13} /></div></section>
    <div className="physics-ownership"><strong>控制权</strong><span>{bodyType === 'dynamic' ? 'Rapier 控制对象变换；通过冲量、关节与马达产生物理动画。' : bodyType === 'kinematic' ? '动画控制目标位置，Rapier 负责碰撞响应。' : '对象固定，仅参与碰撞与传感事件。'}</span></div>
  </div>
}
