import { DEFAULT_SCENE_SETTINGS } from '../../../store.js'

export const NOVA_MODEL_ASSETS = [
  { name: 'Robot Expressive', source: '/models/nova/RobotExpressive.glb', category: '机器人', animated: true, attribution: 'Tomás Laulhé / Don McCurdy · CC0 1.0' },
  { name: 'Toy Car', source: '/models/nova/ToyCar.glb', category: '车辆', attribution: 'Guido Odendahl / Eric Chadwick · CC0 1.0' },
]

export function createNovaScene() {
  const objects = []
  const add = (id, name, type, position, scale, color, extra = {}) => objects.push({ id: `nova-${id}`, name, type, position, scale, rotation: [0, 0, 0], color, roughness: .38, metalness: .65, visible: true, ...extra })
  const light = (color, intensity = 2) => ({ emissiveColor: color, emissiveIntensity: intensity, roughness: .25, metalness: .25, castShadow: false })
  const circle = (radius, count = 48) => Array.from({ length: count }, (_, index) => { const angle = index / count * Math.PI * 2; return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] })
  const pipe = (id, name, position, points, color, extra = {}) => add(id, name, 'flowPipe', position, [1, 1, 1], color, { pipePoints: points, pipeRadius: .035, pipeSegments: 192, pipeRadialSegments: 8, pipeCurveType: 'catmullrom', pipeTension: .5, pipeClosed: true, pipeSmooth: true, flowMode: 'glow', flowSpeed: .18, flowRepeat: 3, flowDirection: 'forward', flowIntensity: 2.4, flowGlowColor: color, flowEmissive: color, castShadow: false, ...extra })
  add('ground', '01 / 主甲板', 'box', [0, -.44, 0], [22, .5, 19], '#17252d', { roughness: .26, metalness: .8 })
  add('podium', '02 / 主展示台', 'cylinder', [0, .05, 0], [4.4, .52, 4.4], '#1b2e38')
  add('podium-top', '03 / 主台面', 'cylinder', [0, .4, 0], [4.25, .055, 4.25], '#2a414c', { roughness: .22, metalness: .8 })
  pipe('stage-light', '主台 · 橙色能量环', [0, .46, 0], circle(2.73), '#ff8850')
  pipe('stage-lower', '主台 · 底部冷光', [0, -.08, 0], circle(2.76), '#38baca', { pipeRadius: .018 })
  add('robot', 'NOVA-07 / 机器人', 'model', [0, .46, 0], [1, 1, 1], '#ffffff', { modelSource: NOVA_MODEL_ASSETS[0].source, modelFormat: 'glb', attribution: NOVA_MODEL_ASSETS[0].attribution, modelFitMode: 'auto', modelTargetSize: 3.8, modelPivotMode: 'ground', modelNormalMode: 'smooth', creaseAngle: 85, modelShadowMode: 'all', modelBvhEnabled: true, modelMaterialOverride: false, animated: true, animationClipName: 'Idle', animationClipEnabled: true, animationClipSpeed: .7, animationClipLoop: 'repeat' })
  const arch = circle(3.15).map(([x, , z]) => [x, z, 0])
  pipe('portal', '04 / 后方冷光星环', [0, 3.2, -2.2], arch, '#40d8ed', { pipeRadius: .045, flowSpeed: -.12, flowRepeat: 4 })
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2
    add(`arch-${index}`, `星环装甲 ${index + 1}`, 'box', [Math.cos(angle) * 3.35, 3.2 + Math.sin(angle) * 3.35, -2.25], [.32, .6, .42], '#344a54', { rotation: [0, 0, angle - Math.PI / 2] })
  }
  add('car-platform', '05 / 车辆展台', 'cylinder', [-5.2, -.01, 1.5], [3.1, .42, 3.1], '#1d303a')
  pipe('car-halo', '车辆展台 · 冷光环', [-5.2, .27, 1.5], circle(1.94), '#39cfe6', { pipeRadius: .025 })
  add('car', 'ROVER / 概念载具', 'model', [-5.2, .3, 1.5], [1, 1, 1], '#ffffff', { modelSource: NOVA_MODEL_ASSETS[1].source, modelFormat: 'glb', attribution: NOVA_MODEL_ASSETS[1].attribution, modelFitMode: 'auto', modelTargetSize: 2.7, modelPivotMode: 'ground', modelNormalMode: 'source', modelShadowMode: 'all', modelBvhEnabled: true, modelMaterialOverride: false, rotation: [0, .5, 0] })
  add('core-platform', '06 / 能源核心台', 'cylinder', [4.9, -.01, .8], [2.8, .42, 2.8], '#1d303a')
  pipe('core-halo', '核心展台 · 橙光环', [4.9, .27, .8], circle(1.76), '#ff9253', { pipeRadius: .026 })
  add('core', 'CORE / 悬浮能源核心', 'sphere', [4.9, 1.85, .8], [.72, .72, .72], '#49cce2', { ...light('#1da5c2', .8), roughness: .2, metalness: .75, animations: [{ id: 'core-spin', type: 'rotate', axis: 'y', angle: 360, duration: 16, loop: true, easing: 'linear' }, { id: 'core-float', type: 'float', axis: 'y', amount: .18, duration: 4, loop: true, easing: 'linear' }] })
  pipe('core-orbit', '核心 · 倾斜轨道', [4.9, 1.85, .8], circle(1.16), '#ffae68', { pipeRadius: .018, rotation: [.6, 0, .35] })
  // Rear architecture frames the models without filling the foreground.
  for (const [index, x] of [-8.2, -6.8, 6.8, 8.2].entries()) {
    const height = index % 2 ? 4.1 : 5.7
    add(`tower-${index}`, `后方塔体 ${index + 1}`, 'box', [x, height / 2 - .2, -5], [.9, height, 1.2], '#1d3038')
    add(`tower-light-${index}`, `塔体灯带 ${index + 1}`, 'box', [x, height / 2 - .2, -4.38], [.065, height * .78, .035], '#268d9b', light('#32c9dc', 1.8))
  }
  for (let index = 0; index < 7; index += 1) {
    const z = 3.4 + index * .78
    for (const side of [-1, 1]) add(`runway-${side}-${index}`, `跑道引导灯 ${side}/${index + 1}`, 'box', [side * 2.7, -.17, z], [.52, .035, .11], '#ffae69', light('#ff9450', 2.4))
  }
  for (const side of [-1, 1]) {
    add(`pylon-${side}`, `后方支柱 ${side}`, 'box', [side * 3.8, 2.1, -3.8], [.38, 4.7, .65], '#253b46')
    add(`pylon-led-${side}`, `支柱灯条 ${side}`, 'box', [side * 3.8, 2.1, -3.45], [.09, 3.7, .04], '#ff9555', light('#ff8f4d', 2))
  }
  add('rear-beam', '试验舱顶部梁', 'box', [0, 4.65, -3.8], [8.2, .26, .65], '#253b46')
  add('title', 'NOVA / 场景标题', 'box', [0, -.1, 6.7], [.01, .01, .01], '#15232c', { annotationEnabled: true, annotationType: 'css2d', annotationText: 'N O V A  /  0 7', annotationOffset: [0, 0, 0], annotationFontSize: 22, annotationTextColor: '#dcebf0', annotationBackground: '#101b24', annotationBackgroundOpacity: .84, annotationPadding: 12, annotationRadius: 3, annotationOcclude: false, castShadow: false, receiveShadow: false })
  return {
    version: 4, objects,
    settings: {
      ...structuredClone(DEFAULT_SCENE_SETTINGS), sceneName: 'NOVA / 机械试验场', scenePreset: 'nova',
      cameraPosition: [11.8, 7.3, 14.5], cameraTarget: [-.3, 1.65, 0], cameraFov: 43,
      autoPlayAnimations: true, postProcessingQuality: 'performance', background: '#080f18', backgroundMode: 'color', environmentIntensity: .65,
      ambient: .4, keyLightColor: '#d5edf5', keyLightIntensity: 3.8, keyLightPosition: [3, 8, 7],
      fillLightColor: '#24a8c6', fillLightIntensity: 65, fillLightPosition: [-4, 4, 1], fillLightDistance: 18,
      rimLightEnabled: true, rimLightColor: '#ff8b4a', rimLightIntensity: 9, rimLightPosition: [2, 6, -4], rimLightAngle: 45,
      hemisphereEnabled: true, hemisphereSkyColor: '#739eb1', hemisphereGroundColor: '#101821', hemisphereIntensity: .75,
      exposure: 1.05, bloomEnabled: true, bloomIntensity: .65, bloomThreshold: 1.1, bloomSmoothing: .4,
      vignetteEnabled: true, vignetteDarkness: .46, vignetteOffset: .2, aoEnabled: false, depthOfFieldEnabled: false,
      fogEnabled: true, fogColor: '#080f18', fogNear: 20, fogFar: 58, sceneSize: 45,
      shadowOpacity: .6, shadowBlur: 2.5, worldAxesEnabled: false,
      customLights: [{ id: 'nova-core-light', name: '能源核心冷光', type: 'point', enabled: true, position: [4.9, 2.4, .8], color: '#43d5ed', intensity: 22, distance: 9, decay: 2 }, { id: 'nova-floor-light', name: '地台橙色反光', type: 'point', enabled: true, position: [0, 1, 2], color: '#ff8e4d', intensity: 14, distance: 8, decay: 2 }],
    },
    editor: { grid: false, shadows: true, mode: 'select' },
    particles: { preset: 'fireflies', enabled: true, playing: true, simulationSpeed: 1, count: 160, rate: 25, lifetime: 8, spread: 8, position: [0, 2.2, 0], direction: [0, 1, 0], wind: [.02, 0, .01], color: '#5bcfdb', secondary: '#ffac68', randomColors: false, size: .028, speed: .13, gravity: 0, opacity: .7, stretch: 1, angle: 360, spawnHeight: 0, killHeight: -2 },
    sceneEffects: { enabled: false },
    interaction: { roaming: { showPath: false, pathEdit: false, pathPoints: [[10, 4.3, 12], [0, 3.2, 13], [-10, 4, 8], [-9, 4.5, -4], [3, 5, -8], [11, 4, 3]], speed: .32, loop: true, curveType: 'catmullrom', tension: .5, lookAhead: .025 } },
  }
}
