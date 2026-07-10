// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/api', () => ({ default: { post: vi.fn() } }))
import api from '../utils/api'
import { queuePhoto, pushPhotos } from './photoSync'
import { getPhotos } from './db'

const file = (name) => new File(['imgdata'], name, { type: 'image/png' })

beforeEach(() => { api.post.mockReset() })

describe('photoSync', () => {
  it('queues an image keyed by staff+kind', async () => {
    await queuePhoto('u1', 'passport_photo', file('p.png'))
    const q = await getPhotos()
    const mine = q.find((p) => p.key === 'u1:passport_photo')
    expect(mine).toBeTruthy()
    expect(mine.staff_uuid).toBe('u1')
    expect(mine.kind).toBe('passport_photo')
  })

  it('uploads pending images and clears them on success', async () => {
    await queuePhoto('u2', 'signature', file('s.png'))
    api.post.mockResolvedValue({ data: { url: 'https://cdn/x.png' } })
    const res = await pushPhotos()
    expect(res.uploaded).toBeGreaterThanOrEqual(1)
    expect(api.post).toHaveBeenCalledWith('/sync/photo/', expect.any(FormData))
    expect((await getPhotos()).some((p) => p.key === 'u2:signature')).toBe(false)
  })

  it('keeps a photo queued when the staff row is not on the server yet (404)', async () => {
    await queuePhoto('u3', 'passport_photo', file('p.png'))
    api.post.mockRejectedValue({ response: { status: 404 } })
    const res = await pushPhotos()
    expect(res.uploaded).toBe(0)
    expect((await getPhotos()).some((p) => p.key === 'u3:passport_photo')).toBe(true)
  })
})
