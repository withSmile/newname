export const interactionRuntimeSource = String.raw`
export function createSceneInteraction({ container, renderer, scene, camera, controls, nodes, locked = false, onSelect }) {
  let selected = null
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
  const gizmo = new TransformControls(camera, renderer.domElement)
  const helper = gizmo.getHelper()
  scene.add(helper)
  gizmo.addEventListener('dragging-changed', event => { controls.enabled = event.value ? false : controlsAllowed })
  const controlsAllowed = controls.enabled
  const selectObject = id => {
    if (locked) return null
    const entry = nodes.get(id)
    if (!entry || entry.object.locked) return null
    selected = id; gizmo.attach(entry.node); onSelect?.(id, entry.node)
    return entry.node
  }
  const setLocked = value => {
    locked = Boolean(value); selected = null; gizmo.detach(); controls.enabled = controlsAllowed
    onSelect?.(null, null)
  }
  let down = null
  const pointerDown = event => { down = [event.clientX, event.clientY] }
  const pointerUp = event => {
    if (locked || gizmo.dragging || event.button !== 0 || !down || Math.hypot(event.clientX-down[0], event.clientY-down[1]) > 4) return
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects([...nodes.values()].map(entry => entry.node), true)
    const hit = hits.find(hit => { for (let p=hit.object; p; p=p.parent) if (!p.visible) return false; return true })
    if (!hit) { selected=null; gizmo.detach(); onSelect?.(null, null); return }
    for (const [id, entry] of nodes) {
      let p = hit.object
      while (p) { if (p === entry.node) { selectObject(id); return }; p=p.parent }
    }
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown)
  renderer.domElement.addEventListener('pointerup', pointerUp)
  return {
    get locked() { return locked }, get selectedId() { return selected }, setLocked, selectObject,
    setTransformMode(mode) { if (!locked && ['translate','rotate','scale'].includes(mode)) gizmo.setMode(mode) },
    updateObject(id, patch) {
      const entry=nodes.get(id)
      if (locked || !entry || entry.object.locked) return false
      for (const key of ['position','rotation','scale']) if (patch[key]) {
        if (!Array.isArray(patch[key]) || patch[key].length!==3 || !patch[key].every(Number.isFinite)) return false
      }
      for (const key of ['position','rotation','scale']) if (patch[key]) { entry.node[key].fromArray(patch[key]); entry.object[key]=[...patch[key]] }
      return true
    },
    dispose() { gizmo.detach(); gizmo.dispose(); helper.removeFromParent(); renderer.domElement.removeEventListener('pointerdown',pointerDown); renderer.domElement.removeEventListener('pointerup',pointerUp) },
  }
}

export function createRuntimeHud(container, interaction, renderer, options = {}) {
  const root = document.createElement('div')
  root.className = 'frame-runtime-hud'
  const lock = document.createElement('button')
  lock.className = 'frame-runtime-lock'
  const updateLock = () => {
    const label = interaction.locked ? '解锁整个场景' : '锁定整个场景'
    lock.title = label; lock.setAttribute('aria-label',label); lock.setAttribute('aria-pressed',String(interaction.locked))
    lock.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="' + (interaction.locked ? 'M8 10V7a4 4 0 018 0v3' : 'M16 10V7a4 4 0 00-8 0') + '"/></svg>'
  }
  lock.onclick=()=>{ interaction.setLocked(!interaction.locked); updateLock() }
  updateLock(); root.appendChild(lock)
  const monitor=document.createElement('section'), heading=document.createElement('button'), detail=document.createElement('pre')
  monitor.className='frame-runtime-performance'; monitor.setAttribute('aria-label','性能监控')
  heading.textContent='性能监控'; heading.setAttribute('aria-expanded','true')
  heading.onclick=()=>{ detail.hidden=!detail.hidden; heading.setAttribute('aria-expanded',String(!detail.hidden)) }
  monitor.append(heading,detail)
  if (options.performanceMonitor !== false) root.appendChild(monitor)
  container.appendChild(root)
  let elapsed=0, frames=0, calls=0, triangles=0, latest=null
  return {
    updateLock,
    get stats() { return latest },
    sample(delta) {
      if (delta<=0 || delta>1) { elapsed=frames=calls=triangles=0; return }
      elapsed+=delta; frames++; calls+=renderer.info.render.calls; triangles+=renderer.info.render.triangles
      if (elapsed<.5) return
      latest={ fps:Math.round(frames/elapsed), frameMs:elapsed*1000/frames, calls:Math.round(calls/frames), triangles:Math.round(triangles/frames), geometries:renderer.info.memory.geometries, textures:renderer.info.memory.textures, width:renderer.domElement.width, height:renderer.domElement.height }
      heading.textContent='性能监控  '+latest.fps+' FPS'
      detail.textContent='帧间隔  '+latest.frameMs.toFixed(1)+' ms\n绘制调用 / 帧  '+latest.calls+'\n三角面提交 / 帧  '+latest.triangles.toLocaleString()+'\n几何体 / 纹理  '+latest.geometries+' / '+latest.textures+'\n渲染分辨率  '+latest.width+' × '+latest.height+'\n包含阴影及后期通道'
      elapsed=frames=calls=triangles=0
    },
    dispose() { lock.onclick=null; heading.onclick=null; root.remove() },
  }
}
`
