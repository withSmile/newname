const text = (id, name, value, x, y, width, height, fontSize, color, extra = {}) => ({ id, name, type: 'text', text: value, x, y, width, height, fontSize, color, ...extra })
const panel = (id, name, x, y, width, height, color, extra = {}) => ({ id, name, type: 'panel', text: '', x, y, width, height, color, radius: 16, ...extra })

export function createUiTemplate(theme = 'minimal') {
  const dark = theme === 'tech'
  const ink = dark ? '#edf0eb' : '#272c2a'
  const muted = dark ? '#9ca8a1' : '#7c8580'
  const surface = dark ? '#222c28' : '#ffffff'
  const background = dark ? '#161f1b' : '#f3f4ef'
  const accent = '#de8458'
  const nodes = [
    panel('nav', '侧边导航', 0, 0, 200, 900, '#202b26', { radius: 0 }),
    text('brand', '品牌名称', 'FRAME', 30, 36, 150, 34, 27, '#f0f1e9', { fontWeight: 700 }),
    text('brand-caption', '品牌副标题', 'SPATIAL OPERATIONS', 30, 80, 160, 20, 10, '#97a89b'),
    panel('nav-active', '导航选中背景', 16, 155, 168, 45, '#3b493e', { radius: 8 }),
    text('nav-overview', '概览导航', '◈   运营总览', 32, 167, 150, 24, 15, '#f6f1dc'),
    text('nav-assets', '资产导航', '资产管理', 48, 230, 120, 24, 14, '#9bac9d'),
    text('nav-energy', '能源导航', '能源监测', 48, 286, 120, 24, 14, '#9bac9d'),
    text('nav-inspect', '巡检导航', '巡检任务', 48, 342, 120, 24, 14, '#9bac9d'),
    panel('nav-line', '导航分隔线', 28, 769, 144, 1, '#425044', { radius: 0 }),
    text('nav-site', '园区标识', 'NORTH CAMPUS', 30, 794, 155, 24, 12, '#d4decf'),
    text('nav-status', '园区状态', '系统运行正常', 30, 826, 155, 24, 12, '#9bac9d'),
    text('eyebrow', '页面分类', 'WORKSPACE  /  OVERVIEW', 240, 38, 700, 22, 12, muted),
    text('heading', '页面标题', '每一个空间，都在掌握之中。', 240, 83, 880, 56, 34, ink, { fontWeight: 600 }),
    text('description', '页面说明', '园区运营总览 · 实时连接设备、能源与空间', 240, 147, 850, 25, 14, muted),
    panel('live-pill', '连接状态背景', 1226, 43, 170, 34, dark ? '#2b3d31' : '#e5ebdf', { radius: 17 }),
    text('live', '连接状态', '●  实时数据已连接', 1241, 52, 150, 22, 11, dark ? '#a7c9a6' : '#52754e'),
  ]
  const metrics = [['设备在线', '2,486', '较昨日 +12 台'], ['空间使用率', '86.4%', '园区运行状态良好'], ['今日能耗', '42.8', 'kWh  /  较昨日 −8.2%']]
  metrics.forEach(([label, value, caption], index) => {
    const x = 240 + index * 390
    nodes.push(panel(`metric-${index}`, `${label}卡片`, x, 205, 376, 132, surface), text(`metric-label-${index}`, `${label}标题`, label, x + 24, 225, 320, 20, 13, muted), text(`metric-value-${index}`, `${label}数值`, value, x + 24, 257, 320, 42, 34, ink, { fontWeight: 600 }), text(`metric-caption-${index}`, `${label}说明`, caption, x + 24, 308, 320, 18, 11, muted))
  })
  nodes.push(panel('chart', '能耗趋势面板', 240, 359, 750, 306, surface), text('chart-title', '趋势标题', '能源使用趋势', 264, 382, 600, 27, 18, ink, { fontWeight: 600 }), text('chart-caption', '趋势说明', 'ENERGY CONSUMPTION  ·  本周', 264, 421, 600, 20, 11, muted))
  ;[65, 92, 78, 124, 108, 87, 141, 125, 91, 112, 136, 102, 128, 153].forEach((height, index) => {
    nodes.push(panel(`bar-${index}`, `能耗柱 ${index + 1}`, 272 + index * 49, 616 - height, 27, height, index > 10 ? accent : dark ? '#425747' : '#dce4d5', { radius: 5 }))
  })
  nodes.push(text('chart-axis', '趋势时间轴', '周一                  周二                  周三                  周四                  周五                  周六                  周日', 273, 632, 700, 18, 10, muted))
  nodes.push(panel('tasks', '巡检任务面板', 1010, 359, 400, 306, surface), text('tasks-title', '任务标题', '今日巡检', 1034, 382, 340, 27, 18, ink, { fontWeight: 600 }), text('tasks-caption', '任务进度', '18 / 24  项任务已完成', 1034, 421, 340, 20, 12, muted), panel('progress-track', '任务进度轨道', 1034, 464, 350, 7, dark ? '#39473e' : '#e9ede5', { radius: 4 }), panel('progress-value', '任务进度', 1034, 464, 262, 7, accent, { radius: 4 }))
  ;['A 区 · 设备例行检查', 'B 区 · 环境传感器巡检', 'C 区 · 能源系统巡检'].forEach((value, index) => {
    nodes.push(text(`task-${index}`, `巡检任务 ${index + 1}`, value, 1034, 500 + index * 46, 290, 24, 13, ink), text(`task-status-${index}`, `任务状态 ${index + 1}`, index === 2 ? '进行中' : '已完成', 1330, 502 + index * 46, 65, 22, 11, index === 2 ? accent : muted))
  })
  nodes.push(panel('space', '空间状态面板', 240, 688, 1170, 164, surface), text('space-title', '空间标题', '让运营决策，回到清晰。', 268, 716, 800, 36, 25, ink, { fontWeight: 600 }), text('space-caption', '空间说明', '查看完整三维场景，定位设备与空间中的每一次变化。', 268, 769, 760, 25, 14, muted), { id: 'space-action', name: '进入场景按钮', type: 'button', text: '进入三维场景  →', x: 1180, y: 743, width: 200, height: 48, color: accent, textColor: '#fff', radius: 8, fontSize: 14, fontWeight: 600 })
  return { version: 2, template: theme, canvas: { width: 1440, height: 900, background }, nodes }
}

export const UI_TEMPLATES = {
  minimal: { label: '明亮运营', caption: '柔和留白 · 运营工作台', background: '#f3f4ef' },
  tech: { label: '深色运营', caption: '石墨绿灰 · 空间控制台', background: '#161f1b' },
}

export function migrateUiProject(project) {
  if (!Array.isArray(project.nodes)) return createUiTemplate()
  const canvas = { width: 1440, height: 900, ...project.canvas }
  const starter = [
    { id: 'ui-heading', type: 'text', name: '页面标题', text: '设备运行总览', x: 36, y: 34, width: 260, height: 42, fontSize: 28, color: '#f1f3f4' },
    { id: 'ui-status', type: 'panel', name: '状态面板', text: '实时状态', x: 36, y: 104, width: 300, height: 150, color: '#252b2e' },
    { id: 'ui-action', type: 'button', name: '主要操作', text: '启动巡检', x: 36, y: 282, width: 132, height: 38, color: '#d16847' },
  ]
  const isStarter = project.nodes.length === 3 && starter.every((expected) => {
    const node = project.nodes.find((item) => item.id === expected.id)
    return node && Object.entries(expected).every(([key, value]) => node[key] === value) && Object.keys(node).every((key) => key in expected || (key === 'visible' && node.visible === true))
  })
  if (Number(project.version || 1) < 2 && isStarter) return createUiTemplate()
  const scale = Number(project.version || 1) >= 2 ? 1 : 1 / Math.min(720 / canvas.width, 480 / canvas.height)
  return { version: 2, template: project.template || 'minimal', canvas: { ...canvas, background: canvas.background || (project.template === 'tech' ? '#07111d' : '#edf0f2') }, nodes: project.nodes.map((node) => ({ ...node, x: Math.round(node.x * scale), y: Math.round(node.y * scale), width: Math.round(node.width * scale), height: Math.round(node.height * scale), fontSize: (node.fontSize || 16) * scale })) }
}

export function readUiProject(storage = localStorage) {
  try {
    const raw = storage.getItem('frame-ui-nodes')
    if (!raw) return createUiTemplate()
    return migrateUiProject({ version: Number(storage.getItem('frame-ui-version') || 1), template: storage.getItem('frame-ui-template'), canvas: JSON.parse(storage.getItem('frame-ui-canvas-size') || 'null'), nodes: JSON.parse(raw) })
  } catch { return createUiTemplate() }
}

export function uiNodeStyle(node, canvas, responsive = false) {
  const xUnit = (value) => responsive ? `${value / canvas.width * 100}%` : value
  const yUnit = (value) => responsive ? `${value / canvas.height * 100}%` : value
  return {
    position: 'absolute', boxSizing: 'border-box', left: xUnit(node.x), top: yUnit(node.y), width: xUnit(node.width), height: yUnit(node.height),
    display: node.visible === false ? 'none' : node.type === 'button' ? 'flex' : 'block', alignItems: 'center', justifyContent: 'center',
    color: node.type === 'text' ? node.color : node.textColor || '#fff', backgroundColor: node.type === 'text' ? 'transparent' : node.color,
    fontSize: responsive ? `${(node.fontSize || 16) / canvas.width * 100}cqw` : node.fontSize || 16,
    fontFamily: 'Inter, "Segoe UI", "Microsoft YaHei", sans-serif', fontWeight: node.fontWeight || 400, lineHeight: 1.4,
    textAlign: node.textAlign || 'left', borderRadius: responsive ? `${(node.radius || 0) / canvas.width * 100}cqw` : node.radius || 0, opacity: node.opacity ?? 1,
    border: `${responsive ? (node.borderWidth || 0) / canvas.width * 100 : node.borderWidth || 0}${responsive ? 'cqw' : 'px'} solid ${node.borderColor || 'transparent'}`, padding: responsive ? `${(node.padding || 0) / canvas.width * 100}cqw` : node.padding || 0,
    backgroundImage: node.type === 'image' && node.src ? `url(${JSON.stringify(node.src)})` : undefined,
    backgroundSize: 'cover', backgroundPosition: 'center', whiteSpace: 'pre-wrap',
  }
}

export function moveUiNode(node, dx, dy, canvas, snap = false) {
  const align = (value) => snap ? Math.round(value / 8) * 8 : Math.round(value)
  return { x: Math.max(0, Math.min(Math.max(0, canvas.width - node.width), align(node.x + dx))), y: Math.max(0, Math.min(Math.max(0, canvas.height - node.height), align(node.y + dy))) }
}
