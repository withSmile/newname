import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { useEditor } from '../src/store.js'
import { CAMERA_VIEWS, fitBounds } from '../src/features/scene/viewportMath.js'

test('unchanged or missing object edits do not consume undo history or clear redo', () => {
  const state = useEditor.getState()
  const first = state.objects[0]
  state.updateObject(first.id, { position: [2, 3, 4] })
  useEditor.getState().undo()
  const before = useEditor.getState()
  before.updateObject(first.id, { position: [...first.position] })
  before.updateObject('missing-object', { name: 'ignored' })
  assert.equal(useEditor.getState().history, before.history)
  assert.equal(useEditor.getState().future, before.future)
  useEditor.getState().redo()
  assert.deepEqual(useEditor.getState().objects[0].position, [2, 3, 4])
})

test('rename is undoable and new edits invalidate redo', () => {
  const state = useEditor.getState()
  const object = state.objects[0]
  state.updateObject(object.id, { name: 'New name' })
  useEditor.getState().undo()
  assert.equal(useEditor.getState().objects[0].name, object.name)
  useEditor.getState().updateObject(object.id, { locked: true })
  assert.equal(useEditor.getState().future.length, 0)
})

test('camera fitting keeps every bounds corner visible in portrait and landscape', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-5, -2, -3), new THREE.Vector3(8, 6, 4))
  for (const aspect of [0.5, 1, 2]) {
    for (const view of Object.values(CAMERA_VIEWS)) {
      const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000)
      const fitted = fitBounds(camera, bounds, new THREE.Vector3(...view.direction))
      camera.position.copy(fitted.position)
      camera.lookAt(fitted.target)
      camera.updateMatrixWorld()
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera)
        assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1, `${view.label}, aspect=${aspect}`)
      }
    }
  }
})

test('orthographic fitting is finite for point bounds and ignores empty bounds', () => {
  const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 1000)
  assert.equal(fitBounds(camera, new THREE.Box3(), new THREE.Vector3()), null)
  const result = fitBounds(camera, new THREE.Box3(new THREE.Vector3(1, 2, 3), new THREE.Vector3(1, 2, 3)), new THREE.Vector3())
  assert.ok(Number.isFinite(result.zoom) && result.zoom > 0)
  assert.ok(result.position.toArray().every(Number.isFinite))
})
