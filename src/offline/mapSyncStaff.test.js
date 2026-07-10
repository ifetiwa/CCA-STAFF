import { describe, it, expect } from 'vitest'
import { buildStaffLookups, syncRowToApiLike } from './mapSyncStaff'

const lookups = buildStaffLookups({
  department: [{ uuid: 'd1', name: 'Litigation Department' }],
  designation: [{ uuid: 'g1', title: 'Legal Officer' }],
  gradelevel: [{ uuid: 'gl1', grade_level: '12' }],
  postinglocation: [{ uuid: 'p1', name: 'CCA Headquarters, Abuja' }],
})

const row = {
  uuid: 's1', first_name: 'Chisom', last_name: 'Adiala',
  department_uuid: 'd1', designation_uuid: 'g1',
  grade_level_uuid: 'gl1', posting_location_uuid: 'p1',
  grade_step: 4, passport_photo: 'staff_photos/x.jpg',
  signature: 'https://res.cloudinary.com/abc/sig.png',
}

describe('syncRowToApiLike', () => {
  it('resolves FK uuids to display names', () => {
    const api = syncRowToApiLike(row, lookups)
    expect(api.department_name).toBe('Litigation Department')
    expect(api.designation_title).toBe('Legal Officer')
    expect(api.grade_level_name).toBe('12')
    expect(api.posting_location_name).toBe('CCA Headquarters, Abuja')
  })

  it('uses the uuid as the record id', () => {
    expect(syncRowToApiLike(row, lookups).id).toBe('s1')
  })

  it('drops non-URL photo paths but keeps absolute URLs', () => {
    const api = syncRowToApiLike(row, lookups)
    expect(api.passport_photo).toBeNull()
    expect(api.signature).toBe('https://res.cloudinary.com/abc/sig.png')
  })

  it('does not crash on unknown/missing FK uuids', () => {
    const api = syncRowToApiLike({ uuid: 's2', department_uuid: 'nope' }, lookups)
    expect(api.department_name).toBe('')
    expect(api.designation_title).toBe('')
    expect(api.id).toBe('s2')
  })

  it('returns null for a null row', () => {
    expect(syncRowToApiLike(null, lookups)).toBeNull()
  })

  it('falls back to name/grade_level when title fields are absent', () => {
    const alt = buildStaffLookups({
      designation: [{ uuid: 'g1', name: 'Registrar' }],
      gradelevel: [{ uuid: 'gl1', name: 'GL14' }],
    })
    const api = syncRowToApiLike({ uuid: 's3', designation_uuid: 'g1', grade_level_uuid: 'gl1' }, alt)
    expect(api.designation_title).toBe('Registrar')
    expect(api.grade_level_name).toBe('GL14')
  })
})

describe('buildStaffLookups', () => {
  it('builds empty maps when given nothing', () => {
    const l = buildStaffLookups()
    expect(l.department.size).toBe(0)
    expect(l.designation.size).toBe(0)
  })
  it('ignores rows without a uuid', () => {
    const l = buildStaffLookups({ department: [{ name: 'no uuid' }, { uuid: 'd1', name: 'ok' }] })
    expect(l.department.size).toBe(1)
    expect(l.department.get('d1').name).toBe('ok')
  })
})
