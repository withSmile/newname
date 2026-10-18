import * as THREE from 'three'

export const DEFAULT_MODEL_IMPORT_SETTINGS = {
  modelFitMode: 'auto',
  sceneScale: 1,
  modelTargetSize: 1.8,
  modelPivotMode: 'center',
  modelNormalMode: 'source',
  modelShadowMode: 'auto',
  modelMaterialOverride: false,
  modelBvhEnabled: true,
}

export const normalizeModelFormat = (value = '') => String(value).split(/[?#]/)[0].split('.').pop()?.toLowerCase() || 'glb'

const safePositive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback

export function inspectModel(root, hierarchyLimit = 80) {
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const validBounds = !bounds.isEmpty() && bounds.min.toArray().every(Number.isFinite) && bounds.max.toArray().every(Number.isFinite)
  const safeBounds = validBounds ? bounds : new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5))
  const size = safeBounds.getSize(new THREE.Vector3())
  const center = safeBounds.getCenter(new THREE.Vector3())
  let meshCount = 0
  let triangleCount = 0
  const hierarchy = []
  const visit = (node, parentPath = '') => {
    node.children.forEach((child, index) => {
      const segment = `${child.name || child.type || 'Object'}[${index}]`
      const path = parentPath ? `${parentPath}/${segment}` : segment
      if (child.isMesh) {
        meshCount += 1
        const geometry = child.geometry
        triangleCount += geometry?.index ? geometry.index.count / 3 : (geometry?.attributes?.position?.count || 0) / 3
      }
      if (hierarchy.length < hierarchyLimit) hierarchy.push({ path, name: child.name || child.type, type: child.type, depth: path.split('/').length - 1, mesh: Boolean(child.isMesh) })
      visit(child, path)
    })
  }
  visit(root)
  return {
    validBounds,
    min: safeBounds.min.toArray(),
    max: safeBounds.max.toArray(),
    size: size.toArray(),
    center: center.toArray(),
    maxDimension: Math.max(size.x, size.y, size.z, 0.001),
    diagonal: size.length(),
    meshCount,
    triangleCount: Math.round(triangleCount),
    hierarchy,
    hierarchyTruncated: hierarchy.length >= hierarchyLimit,
  }
}

export function getModelLayout(object, metrics) {
  const sceneScale = safePositive(object.sceneScale, 1)
  const targetSize = safePositive(object.modelTargetSize, 1.8)
  const fitScale = object.modelFitMode === 'source' ? 1 : targetSize / Math.max(metrics.maxDimension, 0.001)
  const scale = THREE.MathUtils.clamp(fitScale * sceneScale, 1e-7, 1e7)
  const center = new THREE.Vector3(...metrics.center)
  const min = new THREE.Vector3(...metrics.min)
  let offset = new THREE.Vector3()
  if (object.modelPivotMode === 'ground') offset.set(-center.x, -min.y, -center.z)
  else if (object.modelPivotMode !== 'origin') offset.copy(center).multiplyScalar(-1)
  return { scale, offset: offset.toArray(), sourceScale: sceneScale, fitScale }
}

export function applyModelNodeSettings(root, object, metrics) {
  const hiddenPaths = new Set(object.modelHiddenNodes || [])
  const largeModel = metrics.triangleCount > 500000 || metrics.meshCount > 500
  const shadowMode = object.modelShadowMode || 'auto'
  const normalMode = object.modelNormalMode || 'source'
  const visit = (node, parentPath = '') => {
    node.children.forEach((child, index) => {
      const segment = `${child.name || child.type || 'Object'}[${index}]`
      const path = parentPath ? `${parentPath}/${segment}` : segment
      child.visible = !hiddenPaths.has(path)
      if (child.isMesh) {
        child.frustumCulled = true
        child.castShadow = shadowMode === 'none' || shadowMode === 'receive' || (shadowMode === 'auto' && largeModel) ? false : object.castShadow !== false
        child.receiveShadow = shadowMode === 'none' ? false : object.receiveShadow !== false
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.filter(Boolean).forEach((material) => {
          if (object.modelMaterialOverride) {
            if ('roughness' in material) material.roughness = object.roughness ?? material.roughness
            if ('metalness' in material) material.metalness = object.metalness ?? material.metalness
          }
          material.transparent = Boolean(object.transparent || (object.opacity ?? 1) < 1)
          material.opacity = object.opacity ?? 1
          material.alphaTest = object.alphaTest ?? 0
          material.depthWrite = object.depthWrite !== false
          material.side = object.doubleSided ? THREE.DoubleSide : THREE.FrontSide
          material.flatShading = normalMode === 'flat'
          material.needsUpdate = true
        })
      }
      visit(child, path)
    })
  }
  visit(root)
  return largeModel
}

export function disposeObject3D(root, { textures = false } = {}) {
  const geometries = new Set()
  const materials = new Set()
  const textureSet = new Set()
  root?.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry)
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
    childMaterials.filter(Boolean).forEach((material) => {
      materials.add(material)
      if (textures) Object.values(material).forEach((value) => { if (value?.isTexture) textureSet.add(value) })
    })
  })
  geometries.forEach((geometry) => { geometry.disposeBoundsTree?.(); geometry.dispose?.() })
  materials.forEach((material) => material.dispose?.())
  textureSet.forEach((texture) => texture.dispose?.())
}
