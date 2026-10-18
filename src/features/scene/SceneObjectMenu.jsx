import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { Copy, Eye, EyeOff, Focus, Lock, Pencil, Trash2, Unlock } from 'lucide-react'
import { useEditor } from '../../store'

export function SceneObjectMenu({ objectId, anchor, onClose, onRename }) {
  const menu = useRef(null)
  const object = useEditor((state) => state.objects.find((item) => item.id === objectId))
  useLayoutEffect(() => {
    const element = menu.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(anchor.x, window.innerWidth - bounds.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(anchor.y, window.innerHeight - bounds.height - 8))}px`
    element.querySelector('button')?.focus()
  }, [anchor])
  useEffect(() => {
    const outside = (event) => { if (!menu.current?.contains(event.target)) onClose() }
    const escape = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', onClose)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); window.removeEventListener('resize', onClose) }
  }, [onClose])
  if (!object) return null
  const run = (action) => { useEditor.getState().setSelected(objectId); action(useEditor.getState()); onClose() }
  const items = [
    [Pencil, '重命名', () => onRename(objectId)],
    [Focus, '聚焦对象', () => window.dispatchEvent(new Event('frame-focus'))],
    [Copy, '复制对象', (state) => state.duplicateSelected()],
    [object.visible === false ? Eye : EyeOff, object.visible === false ? '显示对象' : '隐藏对象', (state) => state.updateObject(objectId, { visible: object.visible === false })],
    [Trash2, '删除对象', (state) => state.deleteSelected()],
  ]
  const navigate = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = [...menu.current.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
  }
  return <div ref={menu} className="scene-object-menu" role="menu" aria-label={`${object.name} 对象操作`} onKeyDown={navigate} onContextMenu={(event) => event.preventDefault()}>
    <div className="scene-object-menu-title">{object.name}</div>
    {items.filter(([, label]) => !object.locked || label === '解锁对象').map(([Icon, label, action]) => <button key={label} role="menuitem" className={Icon === Trash2 ? 'danger' : ''} onClick={() => run(action)}><Icon size={14} />{label}</button>)}
  </div>
}
