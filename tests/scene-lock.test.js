import test from 'node:test'
import assert from 'node:assert/strict'
import { useEditor } from '../src/store.js'

test('global lock blocks all objects and edits, then restores editing on unlock', () => {
  const objects = ['a', 'b'].map(id => ({ id, type: 'box', name: id, position: [0, 0, 0], locked: id === 'b' }))
  useEditor.setState({ objects, selectedId: 'a', sceneLocked: false, history: [], future: [] })
  const editor = useEditor.getState()
  editor.toggleSceneLock()
  assert.equal(useEditor.getState().selectedId, null)
  assert.equal(useEditor.getState().sceneLocked, true)
  const before = useEditor.getState().objects
  for (const id of ['a', 'b']) {
    editor.setSelected(id)
    assert.equal(useEditor.getState().selectedId, null)
    editor.updateObject(id, { name: 'changed' }, false)
    editor.toggleObjectLock(id)
  }
  editor.addObject('sphere'); editor.deleteSelected(); editor.duplicateSelected(); editor.undo(); editor.redo()
  editor.commit([])
  assert.equal(editor.loadScene({ objects: [] }), false)
  assert.equal(useEditor.getState().objects, before)
  editor.toggleSceneLock()
  assert.equal(useEditor.getState().sceneLocked, false)
  for (const id of ['a', 'b']) {
    editor.setSelected(id)
    assert.equal(useEditor.getState().selectedId, id)
    editor.updateObject(id, { name: `edited-${id}` })
  }
  assert.deepEqual(useEditor.getState().objects.map(o => o.name), ['edited-a', 'edited-b'])
})
