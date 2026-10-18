import React from 'react'
import { History, Undo2, Redo2, Check } from 'lucide-react'
import { useEditor } from '../../store'
import { describeChange, jumpHistory } from './historyUtils'

export function HistoryPanel() {
  const history = useEditor((state) => state.history)
  const future = useEditor((state) => state.future)
  const objects = useEditor((state) => state.objects)
  const states = [...history, objects, ...future]
  const current = history.length
  return <div className="editor-tool-panel">
    <div className="tool-intro"><History size={18} /><div><strong>操作历史</strong><small>{history.length} 步可撤销 · {future.length} 步可重做</small></div></div>
    <div className="tool-segments"><button disabled={!history.length} onClick={() => useEditor.getState().undo()}><Undo2 size={14} />撤销</button><button disabled={!future.length} onClick={() => useEditor.getState().redo()}><Redo2 size={14} />重做</button></div>
    <p className="tool-note">点击记录恢复对应状态。当前记录场景对象编辑；环境、粒子和 UI 画布设置不在此历史中。最多保留 40 步，刷新后重新开始。</p>
    <ol className="history-list">{states.map((state, index) => <li key={index}><button className={`${index === current ? 'active' : ''} ${index > current ? 'future' : ''}`} aria-current={index === current ? 'step' : undefined} onClick={() => jumpHistory(useEditor, index)}><span className="history-step">{index === current ? <Check size={13} /> : index}</span><span>{index === 0 ? '起始状态（保留范围内）' : describeChange(states[index - 1], state)}</span>{index === current && <small>当前</small>}</button></li>)}</ol>
  </div>
}
