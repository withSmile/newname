import { DEFAULT_SCENE_SETTINGS, useEditor } from '../../../store.js'
import { useParticles } from '../../particles/particleStore.js'
import { useSceneEffects } from '../../scene-effects/sceneEffectStore.js'
import { useRoaming } from '../../interaction/roaming/roamingStore.js'
import { useAnimationRuntime } from '../../animation/animationStore.js'
import { useMeasure } from '../../measure/measureStore.js'
import { createNovaScene } from './novaScene.js'

const BACKUP_KEY = 'frame-before-nova-scene'
const runtimeKeys = new Set(['activeCount', 'restartToken', 'progress', 'collisionReady'])
export const serializeFeatureSettings = (state) => Object.fromEntries(Object.entries(state).filter(([key, value]) => typeof value !== 'function' && !runtimeKeys.has(key)))

export function getSceneBackupAssetIds() {
  try { return (JSON.parse(localStorage.getItem(BACKUP_KEY))?.objects || []).map((object) => object.modelAssetId).filter(Boolean) } catch { return [] }
}

export function applySceneDocument(document) {
  if (useEditor.getState().sceneLocked) return false
  useAnimationRuntime.getState().stop()
  useMeasure.getState().setMode('off')
  useRoaming.getState().setMode('idle')
  if (!useEditor.getState().loadScene(document)) return false
  if (document.editor) useEditor.setState(document.editor)
  useEditor.setState({ selectedId: null })
  if (document.particles) useParticles.getState().patch(document.particles)
  if (document.sceneEffects) useSceneEffects.getState().patch(document.sceneEffects)
  if (document.interaction?.roaming) useRoaming.getState().setSetting({ ...document.interaction.roaming, mode: 'idle' })
  if (document.settings?.autoPlayAnimations) useAnimationRuntime.getState().play()
  return true
}

export function loadNovaScene() {
  const state = useEditor.getState()
  if (state.sceneLocked) return false
  if (state.scenePreset !== 'nova') {
    // Keep the project and referenced IndexedDB packages available for restoration.
    const backup = { version: 4, objects: state.objects, settings: Object.fromEntries(Object.keys(DEFAULT_SCENE_SETTINGS).map((key) => [key, state[key]])), editor: { grid: state.grid, shadows: state.shadows, mode: state.mode }, particles: serializeFeatureSettings(useParticles.getState()), sceneEffects: serializeFeatureSettings(useSceneEffects.getState()), interaction: { roaming: { ...serializeFeatureSettings(useRoaming.getState()), mode: 'idle' } } }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
  }
  applySceneDocument(createNovaScene())
}

export function restoreSceneBeforeNova() {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return false
  return applySceneDocument(JSON.parse(raw))
}
