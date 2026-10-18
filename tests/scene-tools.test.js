import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { useMeasure, measureValue, formatMeasurement } from '../src/features/measure/measureStore.js'
import { indexModelNodes } from '../src/features/scene/sceneRegistry.js'
import { describeChange, jumpHistory } from '../src/features/history/historyUtils.js'
import { useEditor } from '../src/store.js'

test('distance and angles, including degenerate vectors', () => {
  assert.equal(measureValue('distance', [[0, 0, 0], [3, 4, 0]]), 5)
  assert.equal(measureValue('angle', [[1, 0, 0], [0, 0, 0], [0, 1, 0]]), 90)
  assert.equal(measureValue('angle', [[0, 0, 0], [0, 0, 0], [1, 0, 0]]), null)
  assert.equal(measureValue('angle', [[1, 0, 0], [0, 0, 0], [-1, 0, 0]]), 180)
})

test('measurement rejects duplicate and invalid points and resets partial groups', () => {
  const store = useMeasure.getState()
  store.clear()
  store.setMode('distance')
  store.addPoint([0, 0, 0]); store.addPoint([0, 0, 0]); store.addPoint([NaN, 0, 0])
  assert.equal(useMeasure.getState().pending.length, 1)
  store.addPoint([3, 4, 0])
  assert.equal(useMeasure.getState().results[0].value, 5)
  assert.equal(useMeasure.getState().pending.length, 0)
  assert.equal(formatMeasurement(useMeasure.getState().results[0], 'cm'), '500.000 cm')
  store.addPoint([1, 2, 3]); store.setMode('angle')
  assert.equal(useMeasure.getState().pending.length, 0)
  store.setMode('off'); store.addPoint([1, 2, 3])
  assert.equal(useMeasure.getState().pending.length, 0)
})

test('model indexing uses stable hierarchy paths even with duplicate names', () => {
  const root = new THREE.Group()
  const group = new THREE.Group(); group.name = 'Part'
  const first = new THREE.Mesh(); first.name = 'Mesh'
  const second = new THREE.Mesh(); second.name = 'Mesh'
  root.add(group); group.add(first, second)
  const nodes = indexModelNodes(root)
  assert.equal(nodes.get('Part[0]/Mesh[0]'), first)
  assert.equal(nodes.get('Part[0]/Mesh[1]'), second)
})

test('history labels and jumping restore the correct object states in both directions', () => {
  useEditor.setState({ history: [], future: [] })
  const initial = useEditor.getState().objects
  const id = initial[0].id
  useEditor.getState().updateObject(id, { name: 'History sample' })
  assert.match(describeChange(initial, useEditor.getState().objects), /重命名/)
  useEditor.getState().updateObject(id, { position: [7, 8, 9] })
  jumpHistory(useEditor, 0)
  assert.deepEqual(useEditor.getState().objects, initial)
  jumpHistory(useEditor, 2)
  assert.equal(useEditor.getState().objects[0].name, 'History sample')
  assert.deepEqual(useEditor.getState().objects[0].position, [7, 8, 9])
  jumpHistory(useEditor, 99)
  assert.equal(useEditor.getState().history.length, 2)
})

test('draft hydration starts a clean history instead of generating fake edit records', () => {
  const objects = useEditor.getState().objects
  assert.equal(useEditor.getState().loadScene({ objects }, { historic: false }), true)
  assert.equal(useEditor.getState().history.length, 0)
  assert.equal(useEditor.getState().future.length, 0)
})
