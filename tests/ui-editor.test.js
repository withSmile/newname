import test from 'node:test'
import assert from 'node:assert/strict'
import { transform } from 'esbuild'
import { createUiTemplate, migrateUiProject, moveUiNode, uiNodeStyle } from '../src/features/ui-editor/uiProject.js'
import { buildSceneProject } from '../src/projectExporter.js'

test('templates have unique ids and fit within the actual canvas dimensions', () => {
  for (const theme of ['minimal', 'tech']) {
    const project = createUiTemplate(theme)
    assert.equal(new Set(project.nodes.map((node) => node.id)).size, project.nodes.length)
    assert.ok(project.nodes.length > 30)
    for (const node of project.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.width <= project.canvas.width && node.y + node.height <= project.canvas.height, node.id)
    }
  }
})

test('legacy artwork migrates once while preserving its relative displayed position', () => {
  const old = { version: 1, template: 'tech', canvas: { width: 1440, height: 900 }, nodes: [{ id: 'custom', type: 'text', name: 'Custom', text: 'Keep me', x: 36, y: 40, width: 200, height: 30, fontSize: 20, color: '#fff' }] }
  const next = migrateUiProject(old)
  assert.equal(next.nodes[0].x, 72)
  assert.equal(next.nodes[0].fontSize, 40)
  assert.equal(next.nodes[0].text, 'Keep me')
  assert.deepEqual(migrateUiProject(next), next)
  assert.equal(old.nodes[0].x, 36)
})

test('node motion clamps to the real canvas and supports grid snapping', () => {
  const node = { x: 10, y: 20, width: 100, height: 100 }
  assert.deepEqual(moveUiNode(node, 5, 5, { width: 1440, height: 900 }, true), { x: 16, y: 24 })
  assert.deepEqual(moveUiNode(node, 5000, -5000, { width: 1440, height: 900 }), { x: 1340, y: 0 })
})

test('editor and export share styles for typography, images, opacity and geometry', () => {
  const node = { type: 'image', x: 144, y: 90, width: 720, height: 450, src: 'data:image/png;base64,abc', fontSize: 24, radius: 12, opacity: .6 }
  const canvas = { width: 1440, height: 900 }
  const editor = uiNodeStyle(node, canvas)
  const output = uiNodeStyle(node, canvas, true)
  assert.equal(editor.width, 720)
  assert.equal(output.width, '50%')
  assert.equal(output.left, '10%')
  assert.equal(output.top, '10%')
  assert.equal(output.opacity, .6)
  assert.equal(output.backgroundImage, editor.backgroundImage)
  assert.match(output.fontSize, /cqw$/)
})

test('UI exports produce valid React JSX/TSX and a self-contained style helper', async () => {
  for (const framework of ['react', 'vue']) for (const language of ['js', 'ts']) {
    const files = await buildSceneProject({ framework, language, folderName: 'ui_test', exportMode: 'ui', objects: [], settings: {}, editor: {}, ui: createUiTemplate(), includeAssets: false, includeReadme: false })
    const extension = language === 'ts' ? 'ts' : 'js'
    const helper = files.get(`src/runtime/uiNodeStyle.${extension}`)
    assert.ok(helper.includes('export const uiNodeStyle'))
    await transform(helper, { loader: extension })
    if (framework === 'react') {
      await transform(files.get(`src/components/UiCanvas.${language === 'ts' ? 'tsx' : 'jsx'}`), { loader: language === 'ts' ? 'tsx' : 'jsx' })
    } else {
      assert.match(files.get('src/components/UiCanvas.vue'), /uiNodeStyle\(node, uiConfig.canvas, true\)/)
    }
    assert.match(files.get('src/styles/ui-canvas.css'), /container-type:inline-size/)
  }
})
