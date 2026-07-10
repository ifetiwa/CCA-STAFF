// Local offline store — storage abstraction.
//
// See docs/OFFLINE_FIRST_ARCHITECTURE.md. This is the on-device database that
// lets the app work fully offline. It is implemented on IndexedDB so it runs
// in the browser today; when the app is packaged with Tauri, this single file
// can be swapped for a Tauri-SQLite driver exposing the same async API, with
// no changes to syncClient.js / store.js or any page.
//
// Records are keyed by their sync `uuid`. Soft-deleted rows are retained (with
// is_deleted = true) so tombstones survive; reads filter them out.

const DB_NAME = 'cca-offline'
// v2 adds the `photos` store (out-of-band image upload queue, Phase E).
const DB_VERSION = 2

// Object stores: one per synced model (keys match the backend sync registry),
// plus an outbox of pending local changes and a small meta store.
export const MODELS = [
  'department', 'designation', 'gradelevel', 'postinglocation',
  'designationoption', 'staff', 'stafftransfer', 'staffpromotion',
  'notification',
]
const OUTBOX = 'outbox'
const META = 'meta'
// Pending image uploads (passport photo / signature). Binary blobs sync
// out-of-band from the row stream — see docs/OFFLINE_FIRST_PHASE3_PLAN.md.
const PHOTOS = 'photos'

let _dbPromise = null

export function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const model of MODELS) {
        if (!db.objectStoreNames.contains(model)) {
          db.createObjectStore(model, { keyPath: 'uuid' })
        }
      }
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(PHOTOS)) {
        // Keyed by `${staff_uuid}:${kind}` so there's at most one pending
        // upload per image field, replaced if the user re-picks.
        db.createObjectStore(PHOTOS, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(db, storeNames, mode) {
  const t = db.transaction(storeNames, mode)
  return t
}

const done = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const txDone = (transaction) =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () => reject(transaction.error)
  })

// ---- Model record access -------------------------------------------------

export async function getAll(model, { includeDeleted = false } = {}) {
  const db = await openDB()
  const rows = await done(tx(db, model, 'readonly').objectStore(model).getAll())
  return includeDeleted ? rows : rows.filter((r) => !r.is_deleted)
}

export async function get(model, uuid) {
  const db = await openDB()
  return done(tx(db, model, 'readonly').objectStore(model).get(uuid))
}

export async function put(model, record) {
  const db = await openDB()
  const t = tx(db, model, 'readwrite')
  t.objectStore(model).put(record)
  await txDone(t)
  return record
}

export async function bulkPut(model, records) {
  if (!records?.length) return 0
  const db = await openDB()
  const t = tx(db, model, 'readwrite')
  const store = t.objectStore(model)
  for (const r of records) store.put(r)
  await txDone(t)
  return records.length
}

// ---- Outbox ---------------------------------------------------------------

export async function enqueue(change) {
  const db = await openDB()
  const t = tx(db, OUTBOX, 'readwrite')
  t.objectStore(OUTBOX).add({ ...change, queuedAt: new Date().toISOString(), attempts: 0 })
  await txDone(t)
}

export async function getOutbox() {
  const db = await openDB()
  return done(tx(db, OUTBOX, 'readonly').objectStore(OUTBOX).getAll())
}

export async function removeOutboxItems(ids) {
  if (!ids?.length) return
  const db = await openDB()
  const t = tx(db, OUTBOX, 'readwrite')
  const store = t.objectStore(OUTBOX)
  for (const id of ids) store.delete(id)
  await txDone(t)
}

export async function updateOutboxItem(item) {
  const db = await openDB()
  const t = tx(db, OUTBOX, 'readwrite')
  t.objectStore(OUTBOX).put(item)
  await txDone(t)
}

// ---- Meta (e.g. last sync timestamp) --------------------------------------

export async function getMeta(key) {
  const db = await openDB()
  const row = await done(tx(db, META, 'readonly').objectStore(META).get(key))
  return row?.value
}

export async function setMeta(key, value) {
  const db = await openDB()
  const t = tx(db, META, 'readwrite')
  t.objectStore(META).put({ key, value })
  await txDone(t)
}

// ---- Photo upload queue ---------------------------------------------------

export async function putPhoto(record) {
  const db = await openDB()
  const t = tx(db, PHOTOS, 'readwrite')
  t.objectStore(PHOTOS).put(record)
  await txDone(t)
  return record
}

export async function getPhotos() {
  const db = await openDB()
  return done(tx(db, PHOTOS, 'readonly').objectStore(PHOTOS).getAll())
}

export async function deletePhoto(key) {
  const db = await openDB()
  const t = tx(db, PHOTOS, 'readwrite')
  t.objectStore(PHOTOS).delete(key)
  await txDone(t)
}

export async function clearAll() {
  const db = await openDB()
  const stores = [...MODELS, OUTBOX, META, PHOTOS]
  const t = tx(db, stores, 'readwrite')
  for (const s of stores) t.objectStore(s).clear()
  await txDone(t)
}

// Clear only the synced model stores, leaving the outbox, photo queue and meta
// intact. Used by a clean full resync so rows the server no longer returns
// (e.g. hard-deleted records that left no tombstone) are dropped locally
// instead of lingering — a plain re-pull only adds/updates, never removes.
export async function clearModels() {
  const db = await openDB()
  const t = tx(db, MODELS, 'readwrite')
  for (const s of MODELS) t.objectStore(s).clear()
  await txDone(t)
}
