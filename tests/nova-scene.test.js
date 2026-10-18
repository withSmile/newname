import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNovaScene, NOVA_MODEL_ASSETS } from '../src/features/scene/presets/novaScene.js'
import { DEFAULT_SCENE_SETTINGS } from '../src/store.js'

test('NOVA is a complete, isolated scene document with valid transforms', () => {
  const scene = createNovaScene()
  assert.equal(new Set(scene.objects.map(o => o.id)).size, scene.objects.length)
  assert.ok(scene.objects.length > 20 && scene.objects.length <= 80)
  for (const object of scene.objects) {
    for (const key of ['position', 'rotation', 'scale']) {
      assert.equal(object[key].length, 3)
      assert.ok(object[key].every(Number.isFinite), `${object.id}: ${key}`)
    }
  }
  for (const key of Object.keys(DEFAULT_SCENE_SETTINGS)) assert.ok(key in scene.settings, key)
  assert.equal(scene.editor.grid, false)
  assert.equal(scene.interaction.roaming.showPath, false)
  assert.ok(scene.particles.count <= 200)
  scene.settings.cameraPosition[0] = 999
  scene.objects[0].position[0] = 999
  assert.notEqual(createNovaScene().settings.cameraPosition[0], 999)
  assert.notEqual(createNovaScene().objects[0].position[0], 999)
})

test('downloaded model files are intact GLBs and the configured animation exists', () => {
  const scene = createNovaScene()
  for (const asset of NOVA_MODEL_ASSETS) {
    const bytes = readFileSync(new URL(`../public${asset.source}`, import.meta.url))
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
    assert.equal(bytes.readUInt32LE(4), 2)
    assert.equal(bytes.readUInt32LE(8), bytes.length)
    const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)))
    const object = scene.objects.find(o => o.modelSource === asset.source)
    assert.ok(object)
    if (object.animationClipEnabled) assert.ok(document.animations.some(a => a.name === object.animationClipName))
    assert.equal(document.extensionsRequired?.length || 0, 0)
  }
})
