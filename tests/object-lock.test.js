import test from 'node:test'
import assert from 'node:assert/strict'
import { useEditor } from '../src/store.js'

test('locking clears selection and blocks editing, selection, deletion and copying', () => {
  const object = { id: 'lock-test', type: 'box', name: 'Protected', position: [0, 0, 0] }
  useEditor.setState({ objects: [object], selectedId: object.id, history: [], future: [] })
  const editor = useEditor.getState()
  editor.toggleObjectLock(object.id)
  assert.equal(useEditor.getState().selectedId, null)
  editor.setSelected(object.id)
  assert.equal(useEditor.getState().selectedId, null)
  editor.updateObject(object.id, { position: [9, 9, 9] })
  editor.updateObject(object.id, { locked: false, name: 'Bypass' }, false)
  assert.deepEqual(useEditor.getState().objects[0].position, [0, 0, 0])
  assert.equal(useEditor.getState().objects[0].locked, true)
  useEditor.setState({ selectedId: object.id })
  editor.deleteSelected(); editor.duplicateSelected()
  assert.equal(useEditor.getState().objects.length, 1)
  editor.updateObject(object.id, { modelLoadState: 'ready' }, false)
  assert.equal(useEditor.getState().objects[0].modelLoadState, 'ready')
  editor.toggleObjectLock(object.id)
  editor.setSelected(object.id)
  editor.updateObject(object.id, { name: 'Editable again' })
  assert.equal(useEditor.getState().objects[0].name, 'Editable again')
})

test('undo, redo and document hydration never select a locked object', () => {
  const object = { id: 'lock-test', type: 'box', name: 'Protected', position: [0, 0, 0] }
  useEditor.setState({ objects: [object], selectedId: object.id, history: [], future: [] })
  const editor = useEditor.getState()
  editor.toggleObjectLock(object.id); editor.undo()
  assert.equal(useEditor.getState().objects[0].locked, undefined)
  editor.redo()
  assert.equal(useEditor.getState().objects[0].locked, true)
  assert.equal(useEditor.getState().selectedId, null)
  editor.loadScene({ objects: [{ ...object, locked: true }] })
  assert.equal(useEditor.getState().selectedId, null)
})
