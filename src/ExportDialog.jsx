import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, FileCode2, FolderOpen, Package, ShieldCheck, X } from 'lucide-react'
import { buildSceneProject, chooseProjectDirectory, downloadProjectZip, getProjectSummary, validateSceneAssets, writeProjectDirectory } from './projectExporter'

function Toggle({ checked, onChange, label, note, disabled = false }) {
  return <label className={`export-toggle ${disabled ? 'disabled' : ''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span><Check size={11} /></span><div><strong>{label}</strong><small>{note}</small></div></label>
}

export function ExportDialog({ objects, settings, editor, onClose, notify }) {
  const [framework, setFramework] = useState('react')
  const [language, setLanguage] = useState('ts')
  const [folderName, setFolderName] = useState('three_scene')
  const [includeAssets, setIncludeAssets] = useState(true)
  const [includeReadme, setIncludeReadme] = useState(true)
  const [optimizeDraco, setOptimizeDraco] = useState(true)
  const [optimizeKtx2, setOptimizeKtx2] = useState(true)
  const [preflight, setPreflight] = useState({ checking: true, references: 0, issues: [] })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const summary = useMemo(() => getProjectSummary(objects), [objects])
  const folderSupported = typeof window.showDirectoryPicker === 'function'
  const moduleExtension = language === 'ts' ? 'ts' : 'js'
  const componentExtension = framework === 'react' ? (language === 'ts' ? 'tsx' : 'jsx') : 'vue'
  const blocked = preflight.checking || preflight.issues.length > 0

  useEffect(() => {
    let active = true
    setPreflight((value) => ({ ...value, checking: true }))
    validateSceneAssets(objects).then((result) => { if (active) setPreflight({ checking: false, ...result }) })
    return () => { active = false }
  }, [objects])

  const build = () => buildSceneProject({ framework, language, folderName, objects, settings, editor, includeAssets, includeReadme, optimizeDraco, optimizeKtx2 })
  const runExport = async (type) => {
    setBusy(true); setError(''); setProgress(type === 'folder' ? '等待选择保存位置' : '正在整理项目文件')
    try {
      if (preflight.issues.length) throw new Error(`存在 ${preflight.issues.length} 个缺失资源，请修复后再导出`)
      const directory = type === 'folder' ? await chooseProjectDirectory(folderName) : null
      if (type === 'folder' && !directory) throw new Error('当前浏览器不支持目录导出，请使用 ZIP 下载')
      setProgress('正在收集模型、贴图与解码器')
      const files = await build()
      const onProgress = (current, total, path) => setProgress(`${current} / ${total}  ${path}`)
      const result = type === 'folder' ? await writeProjectDirectory(directory, files, onProgress) : await downloadProjectZip(folderName, files, onProgress)
      const incremental = result ? `，写入 ${result.written}，跳过 ${result.skipped}` : ''
      notify(`${framework === 'react' ? 'React' : 'Vue'} ${language === 'ts' ? 'TypeScript' : 'JavaScript'} 项目已导出${incremental}`)
      onClose()
    } catch (exportError) {
      if (exportError?.name !== 'AbortError') setError(exportError?.message || '项目导出失败')
      else setProgress('')
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop export-backdrop" onMouseDown={() => !busy && onClose()}>
    <div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="export-head"><div className="export-head-icon"><Package size={18} /></div><div><strong id="export-title">导出可复用项目</strong><small>生成组件、运行时、配置、优化脚本和本地资源</small></div><button aria-label="关闭导出" title="关闭" disabled={busy} onClick={onClose}><X size={16} /></button></div>
      <div className="export-body">
        <div className="export-target-grid">
          <div className="export-field"><label>目标框架</label><div className="export-framework"><button className={framework === 'react' ? 'active' : ''} onClick={() => setFramework('react')}><FileCode2 size={15} /><span><strong>React</strong><small>组件模板</small></span></button><button className={framework === 'vue' ? 'active' : ''} onClick={() => setFramework('vue')}><FileCode2 size={15} /><span><strong>Vue 3</strong><small>组件模板</small></span></button></div></div>
          <div className="export-field"><label>代码语言</label><div className="export-language"><button className={language === 'ts' ? 'active' : ''} onClick={() => setLanguage('ts')}>TypeScript</button><button className={language === 'js' ? 'active' : ''} onClick={() => setLanguage('js')}>JavaScript</button></div></div>
        </div>
        <div className="export-field"><label htmlFor="export-folder">项目文件夹</label><div className="export-folder-input"><FolderOpen size={14} /><input id="export-folder" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="three_scene" /><span>/</span></div></div>
        <div className="export-options"><Toggle checked={includeAssets} onChange={setIncludeAssets} label="复制场景资源" note={`${summary.models} 个模型 · ${summary.textures} 张贴图`} /><Toggle checked={includeReadme} onChange={setIncludeReadme} label="生成接入文档" note="依赖、组件用法与许可提示" /><Toggle checked={optimizeDraco} disabled={!includeAssets} onChange={setOptimizeDraco} label="Draco 几何压缩" note="生成可缓存的模型优化脚本" /><Toggle checked={optimizeKtx2} disabled={!includeAssets} onChange={setOptimizeKtx2} label="KTX2 / UASTC" note="压缩 GLB 内嵌纹理" /></div>
        <div className={`export-preflight ${preflight.issues.length ? 'error' : ''}`}>{preflight.checking ? <><span className="preflight-spinner" />正在检查场景资源</> : preflight.issues.length ? <><AlertTriangle size={13} /><span><strong>{preflight.issues.length} 个资源不可用</strong><small>{preflight.issues.slice(0, 2).map((issue) => `${issue.object} / ${issue.kind}`).join('，')}</small></span></> : <><ShieldCheck size={14} /><span><strong>资源检查通过</strong><small>{preflight.references} 个外部资源可正常读取</small></span></>}</div>
        <div className="export-tree"><div><span>项目结构</span><small>{summary.objects} 个场景对象</small></div><pre>{`${folderName || 'three_scene'}/\n├─ package.json\n├─ .frame-export-manifest.json\n├─ README.md\n├─ scripts/optimize-assets.mjs\n└─ src/\n   ├─ components/ThreeScene.${componentExtension}\n   ├─ config/scene.config.${moduleExtension}\n   ├─ runtime/createThreeScene.${moduleExtension}\n   ${language === 'ts' ? '├─ types.ts\n   ' : ''}├─ styles/three-scene.css\n   └─ assets/{ models, textures, decoders }`}</pre></div>
        {(progress || error) && <div className={`export-status ${error ? 'error' : ''}`}>{error || progress}</div>}
      </div>
      <div className="export-actions"><button className="export-zip" disabled={busy || blocked} onClick={() => runExport('zip')}><Download size={14} />下载 ZIP</button><button className="export-primary" disabled={busy || blocked || !folderSupported} title={folderSupported ? '选择父目录并增量写入项目文件夹' : '当前浏览器不支持目录选择，请下载 ZIP'} onClick={() => runExport('folder')}><FolderOpen size={14} />{busy ? '正在导出…' : '选择位置并导出'}</button></div>
    </div>
  </div>
}
