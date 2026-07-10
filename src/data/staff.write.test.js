// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { bulkPut, getOutbox, getAll, getPhotos } from '../offline/db'
import {
  createStaffFromForm, updateStaffFromForm, bulkDeleteStaff,
  getAllStaff, getStaff, hydrateStaffFromOffline,
} from './staff'

// Enable offline reads+writes for this suite.
beforeAll(async () => {
  localStorage.setItem('cca.offlineReads', '1')
  await bulkPut('department', [{ uuid: 'd1', name: 'Litigation Department' }])
  await bulkPut('designation', [{ uuid: 'g1', title: 'Legal Officer' }])
  await bulkPut('gradelevel', [{ uuid: 'gl1', grade_level: '12' }])
  await bulkPut('postinglocation', [{ uuid: 'p1', name: 'CCA Headquarters, Abuja' }])
  await hydrateStaffFromOffline()
})

const baseForm = {
  firstName: 'New', lastName: 'Officer', gender: 'Male', dateOfBirth: '1990-01-01',
  department: 'Litigation Department', designation: 'Legal Officer', gradeLevel: '12',
  postingLocation: 'CCA Headquarters, Abuja', step: '3',
  firstAppointmentDate: '2021-01-01', status: 'Active',
}

const outboxFor = async (model) => (await getOutbox()).filter((o) => o.model === model)

describe('createStaffFromForm (sync path)', () => {
  it('creates a uuid-keyed record with resolved FK names, and queues it', async () => {
    const rec = await createStaffFromForm({ ...baseForm, staffId: 'CCA/2026/9001' })
    expect(rec).toBeTruthy()
    expect(rec.id).toBeTruthy()
    expect(rec.fullName).toBe('New Officer')
    expect(rec.department).toBe('Litigation Department')
    expect(rec.designation).toBe('Legal Officer')
    expect(String(rec.gradeLevel)).toBe('12')
    expect(rec.gender).toBe('Male')

    // It is now in the roster and findable by its uuid.
    expect(getStaff(rec.id)?.lastName).toBe('Officer')
    expect(getAllStaff().some((s) => s.id === rec.id)).toBe(true)

    // It was queued to the outbox as a staff row keyed by the same uuid.
    const q = await outboxFor('staff')
    const mine = q.find((o) => o.row?.uuid === rec.id)
    expect(mine).toBeTruthy()
    expect(mine.row.first_name).toBe('New')
    expect(mine.row.department_uuid).toBe('d1')
    expect(mine.row.grade_step).toBe(3)
  })

  it('auto-creates an unknown department (local + outbox) and links it', async () => {
    const rec = await createStaffFromForm({
      ...baseForm, staffId: 'CCA/2026/9002', department: 'Brand New Unit',
    })
    const depts = await getAll('department')
    const created = depts.find((d) => d.name === 'Brand New Unit')
    expect(created).toBeTruthy()
    expect(rec.department).toBe('Brand New Unit')
    // The new department is also queued for the server.
    const dq = await outboxFor('department')
    expect(dq.some((o) => o.row?.name === 'Brand New Unit')).toBe(true)
  })

  it('auto-generates a staff_id when the form leaves it blank', async () => {
    const rec = await createStaffFromForm({ ...baseForm, staffId: '' })
    const q = await outboxFor('staff')
    const mine = q.find((o) => o.row?.uuid === rec.id)
    expect(mine.row.staff_id).toMatch(/^CCA\//)
  })

  it('queues an attached passport photo for out-of-band upload (Phase E)', async () => {
    const photo = new File(['imgdata'], 'passport.png', { type: 'image/png' })
    const rec = await createStaffFromForm({ ...baseForm, staffId: 'CCA/2026/9005' }, { passportPhoto: photo })
    const queued = (await getPhotos()).find((p) => p.staff_uuid === rec.id && p.kind === 'passport_photo')
    expect(queued).toBeTruthy()
    expect(queued.filename).toBe('passport.png')
  })
})

describe('updateStaffFromForm (sync path)', () => {
  it('updates a field and keeps the uuid stable (full-form edit, as the UI sends)', async () => {
    const created = await createStaffFromForm({ ...baseForm, staffId: 'CCA/2026/9003', nin: '11122233344' })
    // The Edit form is pre-populated with the whole record, so unchanged fields
    // (nin) are still present alongside the change (lastName).
    const updated = await updateStaffFromForm(created.id, {
      ...baseForm, staffId: 'CCA/2026/9003', nin: '11122233344', lastName: 'Renamed',
    })
    expect(updated.id).toBe(created.id)          // uuid stable
    expect(updated.lastName).toBe('Renamed')
    expect(getStaff(created.id)?.lastName).toBe('Renamed')

    const q = await outboxFor('staff')
    const mine = q.filter((o) => o.row?.uuid === created.id).pop()
    expect(mine.row.last_name).toBe('Renamed')
    expect(mine.row.nin).toBe('11122233344')
  })
})

describe('bulkDeleteStaff (sync path)', () => {
  it('tombstones the row, removes it from reads, and queues the deletion', async () => {
    const created = await createStaffFromForm({ ...baseForm, staffId: 'CCA/2026/9004' })
    const res = await bulkDeleteStaff([created.id])
    expect(res.deleted).toBe(1)
    expect(getStaff(created.id)).toBeUndefined()             // gone from reads
    const withDeleted = await getAll('staff', { includeDeleted: true })
    expect(withDeleted.find((r) => r.uuid === created.id)?.is_deleted).toBe(true)  // tombstone kept
    const q = await getOutbox()
    expect(q.some((o) => o.model === 'staff' && o.row?.uuid === created.id && o.row?._deleted)).toBe(true)
  })
})
