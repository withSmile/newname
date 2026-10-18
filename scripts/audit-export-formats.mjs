import { buildSceneProject } from '../src/projectExporter.js'
import { createUiTemplate } from '../src/features/ui-editor/uiProject.js'
import { createNovaScene } from '../src/features/scene/presets/novaScene.js'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {parse,compileScript}=require('../node_modules/.cache/frame-export-audit/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js')
const ts=require('../node_modules/.cache/frame-export-audit/node_modules/typescript/lib/typescript.js')
for(const mode of ['scene','ui','composite'])for(const framework of ['react','vue'])for(const language of ['js','ts']){
 const preset=createNovaScene(),files=await buildSceneProject({framework,language,exportMode:mode,folderName:'audit',...preset,ui:createUiTemplate('tech'),includeAssets:false,includeReadme:true})
 const compiled=new Map(files)
 for(const [name,source]of files)if(name.endsWith('.vue')){
  const {descriptor,errors}=parse(source,{filename:name})
  if(errors.length)throw new Error(name+': '+errors.join('\n'))
  compiled.set(name,compileScript(descriptor,{id:'frame-'+mode,inlineTemplate:true}).content)
 }
 await build({entryPoints:['src/index.'+language],bundle:true,write:false,format:'esm',jsx:'automatic',plugins:[{name:'export-memory',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(!args.path.startsWith('.')&&!args.path.startsWith('src/'))return{path:args.path,external:true}
   let target=args.importer?path.posix.normalize(path.posix.join(path.posix.dirname(args.importer),args.path)):args.path
   const resolved=[target,target+'.ts',target+'.js',target+'.tsx',target+'.jsx'].find(candidate=>compiled.has(candidate))
   if(!resolved)return{errors:[{text:'Missing exported module: '+target}]}
   return{path:resolved,namespace:'export'}
  })
  b.onLoad({filter:/.*/,namespace:'export'},args=>({contents:args.path.endsWith('.css')?'':compiled.get(args.path),loader:args.path.endsWith('.vue')?(language==='ts'?'ts':'js'):args.path.endsWith('.css')?'js':args.path.split('.').pop()}))
 }}]})
 if(language==='ts'){
  const root=path.resolve('node_modules/.cache/frame-export-audit/generated/'+framework+'-'+mode)
  const names=[]
  for(const[name,source]of compiled){if(!/\.(ts|tsx|vue)$/.test(name))continue;const filename=path.join(root,name.endsWith('.vue')?name+'.ts':name);await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,source);names.push(filename)}
  const program=ts.createProgram(names,{noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,allowSyntheticDefaultImports:true,allowArbitraryExtensions:true,types:['react'],typeRoots:[path.resolve('node_modules/.cache/frame-export-audit/node_modules/@types'),path.resolve('node_modules/@types')]})
  const diagnostics=ts.getPreEmitDiagnostics(program)
  if(diagnostics.length){console.log(framework,mode,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));throw new Error('Typecheck failed: '+framework+' '+mode)}
 }
 console.log('PASS',mode,framework,language,'bundle'+(language==='ts'?' + strict typecheck':''))
}
