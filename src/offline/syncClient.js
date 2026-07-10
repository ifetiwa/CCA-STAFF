// Sync engine — moves changes between the local offline store and the Django
// sync API (GET /api/sync/pull/, POST /api/sync/push/).
//
// Order of operations in a full sync: PUSH first (so local edits reach the
// server), then PULL (so we receive the server's truth, including the winning
// side of any last-write-wins conflict). See docs/OFFLINE_FIRST_ARCHITECTURE.md.

import api from '../utils/api'
import {
  MODELS, bulkPut, getMeta, setMeta, getOutbox, removeOutboxItems, updateOutboxItem,
} from './db'
import { pushPhotos } from './photoSync'

const LAST_SYNC = 'lastSync'
const MAX_ATTEMPTS = 5

// Pull every change since our last successful sync into the local store.
export async function pull() {
  const since = await getMeta(LAST_SYNC)
  const { data } = await api.get('/sync/pull/', {
    params: since ? { since } : {},
  })
  const changes = data.changes || {}
  let applied = 0
  for (const model of MODELS) {
    const rows = changes[model]
    if (rows?.length) applied += await bulkPut(model, rows)
  }
  if (data.server_time) await setMeta(LAST_SYNC, data.server_time)
  // Let views backed by the local store refresh after a delta pull applied rows.
  if (applied && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cca:offline-changed', { detail: { model: '*' } }))
  }
  return { applied, serverTime: data.server_time }
}

// Push queued local changes. Groups the outbox by model into the push contract,
// then clears items the server accepted or resolved as conflicts (the server
// won those; the subsequent pull overwrites our local copy with the truth).
export async function push() {
  const outbox = await getOutbox()
  if (!outbox.length) return { pushed: 0, conflicts: 0, errors: 0 }

  const changes = {}
  for (const item of outbox) {
    ;(changes[item.model] ||= []).push(item.row)
  }

  const { data } = await api.post('/sync/push/', { changes })
  const results = data.results || {}

  // Map uuid -> outbox item id so we know which queue entries to clear.
  const idByUuid = {}
  for (const item of outbox) {
    ;(idByUuid[item.model] ||= {})[item.row?.uuid] = item.id
  }

  const toRemove = []
  let conflicts = 0
  let errors = 0
  for (const [model, res] of Object.entries(results)) {
    if (res?.error) { errors += 1; continue }
    for (const uuid of res.accepted || []) {
      const id = idByUuid[model]?.[uuid]
      if (id != null) toRemove.push(id)
    }
    for (const uuid of res.conflicts || []) {
      const id = idByUuid[model]?.[uuid]
      if (id != null) toRemove.push(id)
      conflicts += 1
    }
    // Errored rows: bump attempts; drop after MAX_ATTEMPTS to avoid a poison
    // item blocking the queue forever.
    for (const errObj of res.errors || []) {
      const id = idByUuid[model]?.[errObj.uuid]
      const item = outbox.find((o) => o.id === id)
      errors += 1
      if (!item) continue
      const attempts = (item.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) toRemove.push(id)
      else await updateOutboxItem({ ...item, attempts, lastError: errObj.error })
    }
  }
  await removeOutboxItems(toRemove)
  return { pushed: toRemove.length, conflicts, errors }
}

// Force the next pull to be a *full* one by dropping the high-water mark, then
// sync. Used as a one-time self-heal for devices whose local store predates
// server-side changes that didn't bump updated_at (e.g. photos/signatures
// attached out-of-band): a normal delta pull would never re-fetch those rows.
export async function forceFullResync() {
  await setMeta(LAST_SYNC, '')
  return sync()
}

let _syncing = false

// Full bidirectional sync. Guards against overlapping runs.
export async function sync() {
  if (_syncing) return { skipped: true }
  _syncing = true
  try {
    const pushed = await push()
    // Upload queued images after the data push (so their staff rows exist
    // server-side), before pulling so the new URLs come back in the same cycle.
    const photos = await pushPhotos()
    const pulled = await pull()
    return { pushed, photos, pulled }
  } finally {
    _syncing = false
  }
}
