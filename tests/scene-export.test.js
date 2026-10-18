import test from 'node:test'
import assert from 'node:assert/strict'
import { transform } from 'esbuild'
import { buildSceneProject } from '../src/projectExporter.js'
import { createNovaScene } from '../src/features/scene/presets/novaScene.js'
import * as THREE from 'three'
import { interactionRuntimeSource } from '../src/features/export/interactionRuntimeSource.js'
import { particleRuntimeSource } from '../src/features/export/particleRuntimeSource.js'
import { animationRuntimeSource } from '../src/features/export/animationRuntimeSource.js'

test('scene exports compile in React/Vue and JS/TS with current runtime features', async () => {
  for (const framework of ['react','vue']) for (const language of ['js','ts']) {
    const scene=createNovaScene()
    const files=await buildSceneProject({ framework, language, folderName:'nova_test', ...scene, editor:{...scene.editor,sceneLocked:true}, includeAssets:false, includeReadme:true })
    for (const [name,source] of files) {
      if (/\.[jt]sx?$/.test(name)) await transform(source,{loader:name.split('.').pop()})
      if (name.endsWith('.vue')) await transform(source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1],{loader:language})
    }
    const runtime=files.get(`src/runtime/createThreeScene.${language}`)
    assert.match(runtime,/createSceneInteraction/)
    assert.match(runtime,/locked:options.sceneLocked \?\? config.editor\?\.sceneLocked/)
    assert.match(runtime,/hud.sample\(rawDelta\)/)
    assert.match(runtime,/new FXAAEffect/)
    assert.match(runtime,/clips.find\(clip => clip.name === object.animationClipName\)/)
    assert.match(runtime,/new THREE.TubeGeometry/)
    assert.match(runtime,/particleSystem\?\.update\(camera,delta\)/)
    const component=files.get(`src/components/ThreeScene.${framework==='vue'?'vue':language==='ts'?'tsx':'jsx'}`)
    assert.match(component,/particles: particleConfig/)
    assert.match(files.get(`src/config/scene.config.${language}`),/"sceneLocked": true/)
    assert.match(files.get('src/types.ts') || '',language==='ts'?/setLocked\(value: boolean\)/:/.*/)
  }
})

test('an export without particles still includes a valid disabled particle module', async () => {
  const scene=createNovaScene(); delete scene.particles
  const files=await buildSceneProject({framework:'react',language:'js',folderName:'without_particles',...scene,includeAssets:false,includeReadme:false})
  assert.match(files.get('src/config/particles.config.js'),/"enabled": false/)
  assert.ok(files.has('src/runtime/createExportParticles.js'))
})

test('exported interaction rejects edits while locked and detaches controls on relock', () => {
  class Gizmo {
    getHelper() { return new THREE.Group() }
    addEventListener() {}
    attach(node) { this.object=node }
    detach() { this.object=null }
    setMode() {}
    dispose() {}
  }
  const factory=new Function('THREE','TransformControls',interactionRuntimeSource.replaceAll('export function','function')+'\nreturn createSceneInteraction')(THREE,Gizmo)
  const node=new THREE.Object3D(), object={id:'core',position:[0,0,0]}
  const scene=new THREE.Scene(), controls={enabled:true}
  const interaction=factory({container:{},scene,camera:new THREE.PerspectiveCamera(),renderer:{domElement:{addEventListener(){},removeEventListener(){}}},controls,nodes:new Map([['core',{node,object}]]),locked:true})
  assert.equal(interaction.selectObject('core'),null)
  assert.equal(interaction.updateObject('core',{position:[1,2,3]}),false)
  interaction.setLocked(false)
  assert.equal(interaction.selectObject('core'),node)
  assert.equal(interaction.updateObject('core',{position:[1,2,3]}),true)
  assert.deepEqual(node.position.toArray(),[1,2,3])
  interaction.setLocked(true)
  assert.equal(interaction.selectedId,null)
  assert.equal(interaction.updateObject('core',{scale:[9,9,9]}),false)
  interaction.dispose()
  assert.equal(scene.children.length,0)
})

test('exported NOVA particles and object animations run with finite transforms', () => {
  const scene=createNovaScene()
  const document={createElement:()=>({getContext:()=>({clearRect(){},fillRect(){},createRadialGradient:()=>({addColorStop(){}})})})}
  const factory=new Function('THREE','document',particleRuntimeSource.replace("import * as THREE from 'three'",'').replaceAll('export function','function')+'\nreturn createExportParticles')(THREE,document)
  const particles=factory(scene.particles), camera=new THREE.PerspectiveCamera()
  for(let index=0;index<300;index++) particles.update(camera,1/60)
  assert.ok(particles.mesh.count>0 && particles.mesh.count<=scene.particles.count)
  assert.ok(particles.mesh.instanceMatrix.array.every(Number.isFinite))
  const core=scene.objects.find(o=>o.id==='nova-core'), node=new THREE.Object3D()
  const animate=new Function('THREE',animationRuntimeSource.replaceAll('export function','function')+'\nreturn createObjectAnimationUpdater')(THREE)([core],new Map([[core.id,{node,object:core}]]))
  animate(1)
  assert.ok(node.position.y>core.position[1])
  assert.ok(node.rotation.y>0)
  particles.dispose()
})
