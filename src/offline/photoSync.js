// Out-of-band image sync (Phase E). Passport photos / signatures are binary
// blobs, so they don't ride the row stream. On save they're queued locally
// (IndexedDB `photos` store) and uploaded to POST /api/sync/photo/ once the
// staff row itself exists on the server; the next pull then carries the
// resulting URL so every device shows the image.
//
// See docs/OFFLINE_FIRST_PHASE3_PLAN.md.

import api from '../utils/api'
import { putPhoto, getPhotos, deletePhoto } from './db'

const MAX_ATTEMPTS = 5

// Queue an image for a staff row (replaces any pending upload for that field).
// The bytes are stored as an ArrayBuffer (not a Blob) so they structured-clone
// cleanly into IndexedDB across environments; the Blob is rebuilt at upload.
export async function queuePhoto(staffUuid, kind, file) {
  if (!staffUuid || !file) return
  const buffer = await file.arrayBuffer()
  await putPhoto({
    key: `${staffUuid}:${kind}`,
    staff_uuid: staffUuid,
    kind,                                    // 'passport_photo' | 'signature'
    buffer,
    type: file.type || 'image/jpeg',
    filename: file.name || `${kind}.jpg`,
    attempts: 0,
  })
}

// Upload all pending images. Called from the sync loop (after the data push,
// so the staff rows exist server-side). Best-effort: a 404 means the row
// hasn't been pushed yet, so we keep it for the next cycle.
export async function pushPhotos() {
  const pending = await getPhotos()
  if (!pending.length) return { uploaded: 0, pending: 0 }

  let uploaded = 0
  for (const p of pending) {
    const fd = new FormData()
    fd.append('uuid', p.staff_uuid)
    fd.append('kind', p.kind)
    fd.append('file', new Blob([p.buffer], { type: p.type || 'image/jpeg' }), p.filename)
    try {
      await api.post('/sync/photo/', fd)
      await deletePhoto(p.key)
      uploaded += 1
    } catch (err) {
      const st = err?.response?.status
      if (st === 404) continue                // row not pushed yet — retry later
      if (!st) continue                        // offline / network — retry later
      // Server rejected it (bad type/size). Bump attempts; drop a poison item.
      const attempts = (p.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) await deletePhoto(p.key)
      else await putPhoto({ ...p, attempts })
    }
  }
  const remaining = (await getPhotos()).length
  return { uploaded, pending: remaining }
}
