const fieldNames = { name: '重命名', position: '移动', rotation: '旋转', scale: '缩放', color: '颜色', visible: '显隐', locked: '锁定', modelHiddenNodes: '子节点显隐', roughness: '粗糙度', metalness: '金属度', effects: '特效', animationTracks: '动画', physicsEnabled: '物理' }
const runtimeFields = new Set(['modelMetrics', 'modelHierarchy', 'modelHierarchyTruncated', 'modelLoadState', 'modelLoadError', 'modelFiles', 'modelClips'])

export function describeChange(before, after) {
  const previous = new Map(before.map((object) => [object.id, object]))
  const next = new Map(after.map((object) => [object.id, object]))
  const added = after.filter((object) => !previous.has(object.id))
  const removed = before.filter((object) => !next.has(object.id))
  if (added.length) return `添加 ${added[0].name}${added.length > 1 ? ` 等 ${added.length} 项` : ''}`
  if (removed.length) return `删除 ${removed[0].name}${removed.length > 1 ? ` 等 ${removed.length} 项` : ''}`
  for (const object of after) {
    const old = previous.get(object.id)
    const keys = [...new Set([...Object.keys(old || {}), ...Object.keys(object)])].filter((key) => !runtimeFields.has(key) && JSON.stringify(old?.[key]) !== JSON.stringify(object[key]))
    if (keys.length) return `${fieldNames[keys[0]] || '属性'} · ${object.name}${keys.length > 1 ? `（${keys.length} 项）` : ''}`
  }
  return '更新对象'
}

export function jumpHistory(store, target) {
  const state = store.getState()
  if (!Number.isInteger(target) || target < 0 || target > state.history.length + state.future.length) return
  const steps = target - state.history.length
  for (let step = 0; step < Math.abs(steps); step += 1) store.getState()[steps < 0 ? 'undo' : 'redo']()
}
