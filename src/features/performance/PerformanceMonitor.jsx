import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { create } from 'zustand'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'

const usePerformance = create(() => ({ fps: 0, frameMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, width: 0, height: 0 }))

export function PerformanceSampler() {
  const gl = useThree(s => s.gl)
  const sample = useRef({ elapsed: 0, frames: 0, calls: 0, triangles: 0 })
  useEffect(() => {
    const previous = gl.info.autoReset
    gl.info.autoReset = false
    gl.info.reset()
    return () => { gl.info.autoReset = previous; gl.info.reset() }
  }, [gl])
  // Read the completed previous frame before any passes for the next frame begin.
  useFrame((_, delta) => {
    const acc = sample.current
    if (delta > 1) { acc.elapsed = 0; acc.frames = 0; acc.calls = 0; acc.triangles = 0; gl.info.reset(); return }
    acc.elapsed += delta
    acc.frames++
    acc.calls += gl.info.render.calls
    acc.triangles += gl.info.render.triangles
    gl.info.reset()
    if (acc.elapsed < .5) return
    usePerformance.setState({
      fps: Math.round(acc.frames / acc.elapsed), frameMs: acc.elapsed * 1000 / acc.frames,
      calls: Math.round(acc.calls / acc.frames), triangles: Math.round(acc.triangles / acc.frames),
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      width: gl.domElement.width, height: gl.domElement.height,
    })
    acc.elapsed = 0; acc.frames = 0; acc.calls = 0; acc.triangles = 0
  }, -100)
  return null
}

export function PerformanceOverlay() {
  const stats = usePerformance()
  const [expanded, setExpanded] = useState(true)
  const status = stats.fps >= 50 ? 'good' : stats.fps >= 30 ? 'fair' : 'slow'
  return <section className={`performance-monitor ${status}`} aria-label="性能监控">
    <button className="performance-heading" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      <Activity size={13} /><span>性能监控</span><strong>{stats.fps || '—'} FPS</strong>{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
    {expanded && <><dl>
      <dt>帧间隔</dt><dd>{stats.frameMs.toFixed(1)} ms</dd>
      <dt>绘制调用 / 帧</dt><dd>{stats.calls.toLocaleString()}</dd>
      <dt>三角面提交 / 帧</dt><dd>{stats.triangles.toLocaleString()}</dd>
      <dt>几何体 / 纹理</dt><dd>{stats.geometries} / {stats.textures}</dd>
      <dt>渲染分辨率</dt><dd>{stats.width} × {stats.height}</dd>
    </dl><small>包含阴影及后期通道 · 每 0.5 秒更新</small></>}
  </section>
}
