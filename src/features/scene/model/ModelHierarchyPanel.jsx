import React from 'react'
import { Box, Eye, EyeOff, Focus, Layers } from 'lucide-react'
import * as THREE from 'three'
import { MODEL_NODE_REFS } from '../sceneRegistry'
import { useModelSelection } from './modelSelectionStore'

export function ModelHierarchyPanel({ object, updateObject }) {
  const selection = useModelSelection()
  const activePath = selection.objectId === object.id ? selection.path : null
  const node = MODEL_NODE_REFS.get(object.id)?.get(activePath)
  const hidden = new Set(object.modelHiddenNodes || [])
  const materials = node ? (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean) : []
  const size = node ? new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3()).toArray() : []
  const positions = node?.geometry?.attributes?.position?.count || 0
  const triangles = Math.round((node?.geometry?.index?.count || positions) / 3)
  const metadata = Object.entries(node?.userData || {}).filter(([key]) => !key.startsWith('__')).slice(0, 20)
  return <div className="model-node-panel">
    <div className="tool-list-heading"><span>子节点 · {object.modelHierarchy.length}{object.modelHierarchyTruncated ? '+' : ''}</span><button disabled={!activePath} onClick={selection.clear}>取消选择</button></div>
    <div className="model-node-list">{object.modelHierarchy.map((item) => <div key={item.path} className={item.path === activePath ? 'active' : ''}>
      <button title={item.path} aria-pressed={item.path === activePath} style={{ paddingLeft: 8 + Math.min(item.depth, 5) * 10 }} onClick={() => selection.select(object.id, item.path)}>{item.mesh ? <Box size={12} /> : <Layers size={12} />}<span>{item.name}</span></button>
      <button aria-label={`${hidden.has(item.path) ? '显示' : '隐藏'}节点 ${item.name}`} onClick={() => updateObject(object.id, { modelHiddenNodes: hidden.has(item.path) ? [...hidden].filter((path) => path !== item.path) : [...hidden, item.path] })}>{hidden.has(item.path) ? <EyeOff size={12} /> : <Eye size={12} />}</button>
    </div>)}</div>
    {object.modelHierarchyTruncated && <p className="tool-note">仅列出前 80 个节点，视口仍可点选其他子网格。</p>}
    {activePath && node && <div className="model-node-details"><strong>{node.name || node.type}</strong><small>{node.type} · {activePath}</small>
      <dl><dt>顶点 / 三角面</dt><dd>{positions.toLocaleString()} / {triangles.toLocaleString()}</dd><dt>世界尺寸</dt><dd>{size.map((value) => value.toFixed(3)).join(' × ')}</dd><dt>材质</dt><dd>{materials.map((material) => material.name || material.type).join('、') || '无（分组节点）'}</dd></dl>
      <button onClick={() => window.dispatchEvent(new CustomEvent('frame-focus', { detail: { objectId: object.id, nodePath: activePath } }))}><Focus size={13} />聚焦子节点</button>
      {metadata.length > 0 && <><h4>节点附加属性</h4><dl>{metadata.map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{(typeof value === 'string' ? value : JSON.stringify(value))?.slice(0, 1000)}</dd></React.Fragment>)}</dl></>}
    </div>}
  </div>
}
