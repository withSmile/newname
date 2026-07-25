import React, { useMemo, useState } from 'react'
import { Check, Download, FileCode2, FolderOpen, Package, X } from 'lucide-react'
import { buildSceneProject, chooseProjectDirectory, downloadProjectZip, getProjectSummary, writeProjectDirectory } from './projectExporter'

function Toggle({ checked, onChange, label, note }) {
  return <label className="export-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><Check size={11} /></span><div><strong>{label}</strong><small>{note}</small></div></label>
}

export function ExportDialog({ objects, settings, editor, onClose, notify }) {
  const [framework, setFramework] = useState('react')
  const [folderName, setFolderName] = useState('three_scene')
  const [includeAssets, setIncludeAssets] = useState(true)
  const [includeReadme, setIncludeReadme] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const summary = useMemo(() => getProjectSummary(objects), [objects])
  const folderSupported = typeof window.showDirectoryPicker === 'function'

  const build = () => buildSceneProject({ framework, folderName, objects, settings, editor, includeAssets, includeReadme })
  const runExport = async (type) => {
    setBusy(true); setError(''); setProgress(type === 'folder' ? '等待选择保存位置' : '正在整理项目文件')
    try {
      const directory = type === 'folder' ? await chooseProjectDirectory(folderName) : null
      if (type === 'folder' && !directory) throw new Error('当前浏览器不支持目录导出，请使用 ZIP 下载')
      setProgress('正在收集模型与贴图资源')
      const files = await build()
      const onProgress = (current, total, path) => setProgress(`${current} / ${total}  ${path}`)
      if (type === 'folder') await writeProjectDirectory(directory, files, onProgress)
      else await downloadProjectZip(folderName, files, onProgress)
      notify(`${framework === 'react' ? 'React' : 'Vue'} 项目已导出`)
      onClose()
    } catch (exportError) {
      if (exportError?.name !== 'AbortError') setError(exportError?.message || '项目导出失败')
      else setProgress('')
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop export-backdrop" onMouseDown={() => !busy && onClose()}>
    <div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="export-head"><div className="export-head-icon"><Package size={18} /></div><div><strong id="export-title">导出可复用项目</strong><small>生成组件、运行时、配置和本地资源</small></div><button aria-label="关闭导出" title="关闭" disabled={busy} onClick={onClose}><X size={16} /></button></div>
      <div className="export-body">
        <div className="export-field"><label>目标框架</label><div className="export-framework"><button className={framework === 'react' ? 'active' : ''} onClick={() => setFramework('react')}><FileCode2 size={15} /><span><strong>React</strong><small>ThreeScene.jsx</small></span></button><button className={framework === 'vue' ? 'active' : ''} onClick={() => setFramework('vue')}><FileCode2 size={15} /><span><strong>Vue 3</strong><small>ThreeScene.vue</small></span></button></div></div>
        <div className="export-field"><label htmlFor="export-folder">项目文件夹</label><div className="export-folder-input"><FolderOpen size={14} /><input id="export-folder" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="three_scene" /><span>/</span></div></div>
        <div className="export-options"><Toggle checked={includeAssets} onChange={setIncludeAssets} label="复制场景资源" note={`${summary.models} 个模型 · ${summary.textures} 张贴图`} /><Toggle checked={includeReadme} onChange={setIncludeReadme} label="生成接入文档" note="包含依赖和组件用法" /></div>
        <div className="export-tree"><div><span>项目结构</span><small>{summary.objects} 个场景对象</small></div><pre>{`${folderName || 'three_scene'}/\n├─ package.json\n├─ README.md\n└─ src/\n   ├─ components/ThreeScene.${framework === 'react' ? 'jsx' : 'vue'}\n   ├─ config/scene.config.js\n   ├─ runtime/createThreeScene.js\n   ├─ styles/three-scene.css\n   └─ assets/{ models, textures }`}</pre></div>
        {(progress || error) && <div className={`export-status ${error ? 'error' : ''}`}>{error || progress}</div>}
      </div>
      <div className="export-actions"><button className="export-zip" disabled={busy} onClick={() => runExport('zip')}><Download size={14} />下载 ZIP</button><button className="export-primary" disabled={busy || !folderSupported} title={folderSupported ? '选择父目录并创建项目文件夹' : '当前浏览器不支持目录选择，请下载 ZIP'} onClick={() => runExport('folder')}><FolderOpen size={14} />{busy ? '正在导出…' : '选择位置并导出'}</button></div>
    </div>
  </div>
}
