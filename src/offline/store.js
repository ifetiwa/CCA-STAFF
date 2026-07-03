// High-level offline data access used by the UI.
//
// Reads come from the local store (instant, works offline). Writes apply
// locally immediately (optimistic) AND enqueue an outbox entry that the sync
// engine later pushes to the server. Every record is keyed by `uuid`; new rows
// get a client-generated uuid so two offline devices never collide.
//
// See docs/OFFLINE_FIRST_ARCHITECTURE.md.

import { getAll, get, put, enqueue } from './db'

const newUuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

const nowIso = () => new Date().toISOString()

// Notify the app that local data changed so views can refresh.
const emitChanged = (model) =>
  window.dispatchEvent(new CustomEvent('cca:offline-changed', { detail: { model } }))

export const list = (model, opts) => getAll(model, opts)
export const getOne = (model, uuid) => get(model, uuid)

// Create or update a record. `record.uuid` present => update, else create.
export async function save(model, record) {
  const uuid = record.uuid || newUuid()
  const row = { ...record, uuid, updated_at: nowIso(), is_deleted: false }
  await put(model, row)                       // optimistic local write
  await enqueue({ model, row })               // queue for the server
  emitChanged(model)
  return row
}

// Soft-delete: mark the local row as a tombstone and queue the deletion.
export async function remove(model, uuid) {
  const existing = await get(model, uuid)
  const row = { ...(existing || { uuid }), uuid, is_deleted: true, deleted_at: nowIso(), updated_at: nowIso() }
  await put(model, row)
  await enqueue({ model, row: { uuid, _deleted: true, updated_at: row.updated_at } })
  emitChanged(model)
  return row
}
