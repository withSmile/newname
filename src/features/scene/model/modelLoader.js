import * as THREE from 'three'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { createModelAssetUrls, getModelAsset } from './modelAssetStore'
import { disposeObject3D, normalizeModelFormat } from './modelUtils'

const loadAsync = (loader, url, onProgress) => new Promise((resolve, reject) => loader.load(url, resolve, onProgress, reject))

function createConfiguredLoaders(manager, renderer) {
  const draco = new DRACOLoader(manager).setDecoderPath('/decoders/draco/gltf/')
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('/decoders/basis/')
  if (renderer) ktx2.detectSupport(renderer)
  const gltf = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
  return {
    gltf,
    draco,
    ktx2,
    fbx: new FBXLoader(manager),
    obj: new OBJLoader(manager),
    stl: new STLLoader(manager),
    ply: new PLYLoader(manager),
    dae: new ColladaLoader(manager),
    '3mf': new ThreeMFLoader(manager),
  }
}

export async function loadImportedModel(object, renderer, onProgress) {
  const manager = new THREE.LoadingManager()
  let assetUrls = null
  let modelPackage = null
  let sourceUrl = object.modelSource
  if (object.modelAssetId) {
    modelPackage = await getModelAsset(object.modelAssetId)
    if (!modelPackage) throw new Error('模型资源包不存在，请重新导入模型文件。')
    assetUrls = createModelAssetUrls(modelPackage)
    manager.setURLModifier(assetUrls.resolve)
    sourceUrl = assetUrls.mainUrl
  }
  const format = normalizeModelFormat(object.modelFormat || modelPackage?.mainFile || object.modelSource)
  const loaders = createConfiguredLoaders(manager, renderer)
  const progress = (event) => onProgress?.(event.total > 0 ? event.loaded / event.total : null)
  try {
    if (!loaders[format] && format !== 'glb' && format !== 'gltf') throw new Error(`暂不支持 .${format} 模型`)
    if (format === 'obj' && modelPackage) {
      const materialEntry = modelPackage.files.find((entry) => normalizeModelFormat(entry.name) === 'mtl')
      if (materialEntry) {
        const mtlUrl = assetUrls.resolve(materialEntry.name)
        const materials = await loadAsync(new MTLLoader(manager), mtlUrl, progress)
        materials.preload()
        loaders.obj.setMaterials(materials)
      }
    }
    const loaded = await loadAsync(format === 'glb' || format === 'gltf' ? loaders.gltf : loaders[format], sourceUrl, progress)
    const geometry = format === 'stl' || format === 'ply' ? loaded : null
    let source
    if (geometry) {
      source = new THREE.Group()
      source.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: object.color || '#b8c1c7', roughness: object.roughness ?? 0.6, metalness: object.metalness ?? 0.05 })))
    } else source = format === 'glb' || format === 'gltf' || format === 'dae' ? loaded.scene : loaded
    return {
      source,
      animations: loaded.animations || source?.animations || [],
      format,
      files: modelPackage?.files.map(({ name, size, type }) => ({ name, size, type })) || [],
      cleanup: () => {
        disposeObject3D(source, { textures: true })
        loaders.draco.dispose()
        loaders.ktx2.dispose()
        assetUrls?.revoke()
      },
    }
  } catch (error) {
    loaders.draco.dispose()
    loaders.ktx2.dispose()
    assetUrls?.revoke()
    throw error
  }
}
