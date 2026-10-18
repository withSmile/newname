const DB_NAME = 'frame-three-assets'
const DB_VERSION = 1
const STORE_NAME = 'model-packages'

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const withStore = async (mode, operation) => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, mode)
    const completion = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const result = await operation(transaction.objectStore(STORE_NAME))
    await completion
    return result
  } finally {
    database.close()
  }
}

export const normalizeAssetPath = (path = '') => {
  let normalized = String(path).replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\//, '')
  try { normalized = decodeURIComponent(normalized) } catch { /* Keep the original URL text. */ }
  return normalized.split('?')[0].split('#')[0]
}

export async function saveModelAsset(files, mainFileName) {
  const entries = [...files].map((file) => ({
    name: normalizeAssetPath(file.webkitRelativePath || file.name),
    type: file.type || 'application/octet-stream',
    size: file.size,
    blob: file.slice(0, file.size, file.type || 'application/octet-stream'),
  }))
  const mainName = normalizeAssetPath(mainFileName)
  const mainEntry = entries.find((entry) => entry.name === mainName) || entries.find((entry) => entry.name.endsWith(`/${mainName}`))
  if (!mainEntry) throw new Error('The selected package does not contain its main model file.')
  const id = `model-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const modelPackage = { id, mainFile: mainEntry.name, files: entries, createdAt: Date.now() }
  await withStore('readwrite', (store) => requestResult(store.put(modelPackage)))
  return modelPackage
}

export const getModelAsset = (id) => withStore('readonly', (store) => requestResult(store.get(id)))

export const deleteModelAsset = (id) => withStore('readwrite', (store) => requestResult(store.delete(id)))

export async function pruneModelAssets(activeIds) {
  const keep = new Set(activeIds.filter(Boolean))
  return withStore('readwrite', async (store) => {
    const keys = await requestResult(store.getAllKeys())
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => requestResult(store.delete(key))))
  })
}

export function createModelAssetUrls(modelPackage) {
  const urls = new Map()
  const basenameCounts = new Map()
  modelPackage.files.forEach((entry) => {
    const name = normalizeAssetPath(entry.name)
    const basename = name.split('/').pop()
    basenameCounts.set(basename, (basenameCounts.get(basename) || 0) + 1)
    urls.set(name, URL.createObjectURL(entry.blob))
  })
  modelPackage.files.forEach((entry) => {
    const name = normalizeAssetPath(entry.name)
    const basename = name.split('/').pop()
    if (basenameCounts.get(basename) === 1) urls.set(basename, urls.get(name))
  })
  const resolve = (requestedUrl) => {
    const requested = normalizeAssetPath(requestedUrl)
    const direct = urls.get(requested)
    if (direct) return direct
    const basename = requested.split('/').pop()
    return urls.get(basename) || requestedUrl
  }
  return {
    mainUrl: urls.get(normalizeAssetPath(modelPackage.mainFile)),
    resolve,
    revoke: () => new Set(urls.values()).forEach((url) => URL.revokeObjectURL(url)),
  }
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob()

export async function serializeModelAsset(id) {
  const modelPackage = await getModelAsset(id)
  if (!modelPackage) return null
  return {
    id: modelPackage.id,
    mainFile: modelPackage.mainFile,
    files: await Promise.all(modelPackage.files.map(async (entry) => ({
      name: entry.name,
      type: entry.type,
      size: entry.size,
      data: await blobToDataUrl(entry.blob),
    }))),
  }
}

export async function restoreModelAsset(serialized) {
  if (!serialized?.id || !serialized?.mainFile || !Array.isArray(serialized.files)) return null
  const files = await Promise.all(serialized.files.map(async (entry) => ({
    name: normalizeAssetPath(entry.name),
    type: entry.type || 'application/octet-stream',
    size: entry.size,
    blob: await dataUrlToBlob(entry.data),
  })))
  const modelPackage = { id: serialized.id, mainFile: normalizeAssetPath(serialized.mainFile), files, createdAt: Date.now() }
  await withStore('readwrite', (store) => requestResult(store.put(modelPackage)))
  return modelPackage
}
