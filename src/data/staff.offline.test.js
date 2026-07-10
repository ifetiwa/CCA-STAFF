// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'
import { bulkPut } from '../offline/db'
import { buildStaffLookups, syncRowToApiLike } from '../offline/mapSyncStaff'
import {
  getAllStaff, getStaff, hydrateStaffFromOffline, mapApiStaff, offlineReadsEnabled,
} from './staff'

// A realistic Staff sync row (Django model field names, FKs as <fk>_uuid).
const staffRow = {
  uuid: 's1', first_name: 'Chisom', middle_name: 'Amaka', last_name: 'Adiala',
  title: 'Mrs.', gender: 'F', date_of_birth: '1989-07-21',
  department_uuid: 'd1', designation_uuid: 'g1',
  grade_level_uuid: 'gl1', posting_location_uuid: 'p1',
  grade_step: 4, first_appointment_date: '2020-03-15', last_promotion_date: '2024-01-01',
  is_active: true, is_deleted: false, pension_administrator: 'ARM Pension Managers',
  next_of_kin_name: 'Ifeanyi Adiala', next_of_kin_relationship: 'Husband',
}
// A tombstoned row that must NOT appear in reads.
const deletedRow = { uuid: 's2', first_name: 'Ghost', last_name: 'Row', is_deleted: true }

beforeAll(async () => {
  await bulkPut('department', [{ uuid: 'd1', name: 'Litigation Department' }])
  await bulkPut('designation', [{ uuid: 'g1', title: 'Legal Officer' }])
  await bulkPut('gradelevel', [{ uuid: 'gl1', grade_level: '12' }])
  await bulkPut('postinglocation', [{ uuid: 'p1', name: 'CCA Headquarters, Abuja' }])
  await bulkPut('staff', [staffRow, deletedRow])
})

describe('hydrateStaffFromOffline (end-to-end read path)', () => {
  it('loads and maps staff from the local IndexedDB store', async () => {
    await hydrateStaffFromOffline()
    const list = getAllStaff()
    expect(list.length).toBe(1) // tombstoned row excluded
    const s = list[0]
    expect(s.fullName).toBe('Mrs. Chisom Amaka Adiala')
    expect(s.department).toBe('Litigation Department')
    expect(s.designation).toBe('Legal Officer')
    expect(String(s.gradeLevel)).toBe('12')
    expect(s.postingLocation).toBe('CCA Headquarters, Abuja')
    expect(s.gender).toBe('Female')     // 'F' -> 'Female'
    expect(s.pfa).toBe('ARM Pension Managers')
    expect(s.step).toBe(4)
  })

  it('computes the derived (enrich) fields', async () => {
    await hydrateStaffFromOffline()
    const s = getAllStaff()[0]
    expect(typeof s.age).toBe('number')
    expect(s.age).toBeGreaterThan(0)
    expect(typeof s.yearsOfService).toBe('number')
    expect(s.retirementDate).toBeTruthy()
    expect(s.nextPromotionDate).toBeTruthy()
    expect(typeof s.nextPromotionInDays).toBe('number')
    expect(s.nextOfKin.name).toBe('Ifeanyi Adiala')
  })

  it('exposes the record by uuid via getStaff', async () => {
    await hydrateStaffFromOffline()
    expect(getStaff('s1')?.lastName).toBe('Adiala')
  })
})

describe('shape parity: offline path == online path', () => {
  it('produces the same user-facing fields as mapApiStaff for equivalent data', () => {
    const lookups = buildStaffLookups({
      department: [{ uuid: 'd1', name: 'Litigation Department' }],
      designation: [{ uuid: 'g1', title: 'Legal Officer' }],
      gradelevel: [{ uuid: 'gl1', grade_level: '12' }],
      postinglocation: [{ uuid: 'p1', name: 'CCA Headquarters, Abuja' }],
    })
    const offline = mapApiStaff(syncRowToApiLike(staffRow, lookups))
    const online = mapApiStaff({
      id: 's1', first_name: 'Chisom', middle_name: 'Amaka', last_name: 'Adiala',
      title: 'Mrs.', gender: 'F', date_of_birth: '1989-07-21',
      department: 'd1', department_name: 'Litigation Department',
      designation: 'g1', designation_title: 'Legal Officer',
      grade_level: 'gl1', grade_level_name: '12',
      posting_location: 'p1', posting_location_name: 'CCA Headquarters, Abuja',
      grade_step: 4, first_appointment_date: '2020-03-15', last_promotion_date: '2024-01-01',
      is_active: true, pension_administrator: 'ARM Pension Managers',
    })
    const fields = [
      'id', 'fullName', 'firstName', 'lastName', 'department', 'designation',
      'gradeLevel', 'postingLocation', 'gender', 'pfa', 'step', 'age',
      'yearsOfService', 'retirementDate', 'nextPromotionDate', 'nextPromotionInDays',
      'status',
    ]
    for (const k of fields) expect(offline[k]).toEqual(online[k])
  })
})

describe('offlineReadsEnabled flag', () => {
  it('defaults ON (Phase 3), with a 0 escape hatch to force the legacy path', () => {
    localStorage.removeItem('cca.offlineReads')
    expect(offlineReadsEnabled()).toBe(true)        // Phase 3 default
    localStorage.setItem('cca.offlineReads', '0')
    expect(offlineReadsEnabled()).toBe(false)       // explicit opt-out
    localStorage.setItem('cca.offlineReads', '1')
    expect(offlineReadsEnabled()).toBe(true)        // explicit opt-in
    localStorage.removeItem('cca.offlineReads')
  })
})
