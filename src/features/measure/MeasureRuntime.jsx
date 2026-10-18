import React, { useEffect, useRef } from 'react'
import { Html, Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMeasure, formatMeasurement } from './measureStore'
import { useEditor } from '../../store'
import { useRoaming } from '../interaction/roaming/roamingStore'

export function MeasureRuntime({ objectRefs }) {
  const { camera, gl } = useThree()
  const { mode, pending, results, unit } = useMeasure()
  const active = mode !== 'off'
  const previousMode = useRef(null)
  useEffect(() => {
    if (!active) return
    previousMode.current = useEditor.getState().mode
    useEditor.getState().setMode('select')
    return () => { if (useEditor.getState().mode === 'select') useEditor.getState().setMode(previousMode.current || 'translate') }
  }, [active])
  useEffect(() => {
    if (mode === 'off') return
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let down = null
    const start = (event) => { down = event.button === 0 ? [event.clientX, event.clientY] : null }
    const pick = (event) => {
      event.stopImmediatePropagation()
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return
      down = null
      if (useRoaming.getState().mode !== 'idle') { useMeasure.getState().setMode('off'); return }
      const rect = canvas.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const roots = useEditor.getState().objects.filter((object) => object.visible !== false).map((object) => objectRefs.get(object.id)).filter(Boolean)
      const hit = raycaster.intersectObjects(roots, true).find((intersection) => {
        if (!intersection.object.isMesh) return false
        for (let node = intersection.object; node; node = node.parent) if (!node.visible) return false
        return true
      })
      if (hit) useMeasure.getState().addPoint(hit.point.toArray())
      else useMeasure.getState().setHint('未命中可见模型，请点击物体表面')
    }
    const exit = (event) => { event.preventDefault(); event.stopImmediatePropagation(); useMeasure.getState().setMode('off') }
    const key = (event) => { if (event.key === 'Escape') useMeasure.getState().cancel() }
    canvas.addEventListener('pointerdown', start, true)
    canvas.addEventListener('click', pick, true)
    canvas.addEventListener('contextmenu', exit, true)
    window.addEventListener('keydown', key)
    const oldCursor = canvas.style.cursor
    canvas.style.cursor = 'crosshair'
    return () => { canvas.style.cursor = oldCursor; canvas.removeEventListener('pointerdown', start, true); canvas.removeEventListener('click', pick, true); canvas.removeEventListener('contextmenu', exit, true); window.removeEventListener('keydown', key) }
  }, [mode, camera, gl, objectRefs])
  useEffect(() => useRoaming.subscribe((state) => { if (state.mode !== 'idle') useMeasure.getState().setMode('off') }), [])
  useEffect(() => useEditor.subscribe((state) => { if (state.mode !== 'select' && useMeasure.getState().mode !== 'off') useMeasure.getState().setMode('off') }), [])
  return <group>{results.map((result) => <group key={result.id}>
    <Line points={result.points} color="#e77b52" lineWidth={2} depthTest={false} raycast={() => null} />
    <Html position={result.mode === 'angle' ? result.points[1] : result.points[0].map((value, axis) => (value + result.points[1][axis]) / 2)} center style={{ pointerEvents: 'none' }}><span className="measurement-label">{formatMeasurement(result, unit)}</span></Html>
  </group>)}{pending.length > 1 && <Line points={pending} color="#ffc5ab" lineWidth={2} depthTest={false} raycast={() => null} />}{pending.map((point, index) => <Html key={index} position={point} center style={{ pointerEvents: 'none' }}><span className="measurement-point">{index + 1}</span></Html>)}</group>
}
