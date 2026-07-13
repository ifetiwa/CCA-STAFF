// Phase 3 (offline-first) — bridge the local sync-row shape to the shape the UI
// already understands.
//
// A staff row in the local store (populated by /api/sync/pull/) uses the Django
// model field names (snake_case) and carries foreign keys as `<fk>_uuid` rather
// than resolved names. The SPA, however, expects the enriched camelCase shape
// that `mapApiStaff` produces from the /api/staff/ serializer.
//
// Rather than duplicate that (tested) mapping, we convert a sync row into the
// *same* object `mapApiStaff` consumes — resolving FK uuids to the display
// names via the local lookup stores — and let data/staff.js run it through
// `mapApiStaff` + `enrich`. This guarantees shape parity with the online path
// by construction. This file deliberately imports nothing from data/staff.js
// (avoids a circular import).
//
// See docs/OFFLINE_FIRST_PHASE3_PLAN.md.

// Build uuid -> row lookup maps from the local lookup stores. Pass the arrays
// straight from getAll('department') etc.
export const buildStaffLookups = ({
  department = [], designation = [], gradelevel = [], postinglocation = [],
} = {}) => {
  const index = (rows) => {
    const m = new Map();
    for (const r of rows) if (r && r.uuid) m.set(r.uuid, r);
    return m;
  };
  return {
    department: index(department),
    designation: index(designation),
    gradelevel: index(gradelevel),
    postinglocation: index(postinglocation),
  };
};

// Only surface an image path the browser can actually load. Sync stores the
// storage *path* (e.g. "staff_photos/x.jpg"); a bare path would 404 as a
// relative URL, so until out-of-band photo sync lands (Phase E) we only pass
// through values that are already absolute URLs and drop the rest (the avatar
// then falls back to initials).
const displayableImage = (value) => {
  const s = String(value || '');
  return /^https?:\/\//i.test(s) ? s : null;
};

// Convert one local sync staff row into the object mapApiStaff expects.
export const syncRowToApiLike = (row, lookups) => {
  if (!row) return null;
  const dept = lookups?.department?.get(row.department_uuid) || null;
  const desig = lookups?.designation?.get(row.designation_uuid) || null;
  const grade = lookups?.gradelevel?.get(row.grade_level_uuid) || null;
  const loc = lookups?.postinglocation?.get(row.posting_location_uuid) || null;

  return {
    ...row,
    // Use the cross-device uuid as the record id so getStaff(id) is stable
    // whether the row came from the API or the local store.
    id: row.uuid,
    // Resolve the four foreign keys the list/detail views render. mapApiStaff
    // reads *_name / *_title first and falls back to the raw id.
    department: row.department_uuid || null,
    department_name: dept?.name || '',
    designation: row.designation_uuid || null,
    designation_title: desig?.title || desig?.name || '',
    grade_level: row.grade_level_uuid || null,
    grade_level_name: grade?.grade_level || grade?.name || '',
    posting_location: row.posting_location_uuid || null,
    posting_location_name: loc?.name || '',
    // HQ flag from the resolved posting location (organizational_role rides
    // along via the `...row` spread above).
    posting_location_is_hq: !!loc?.is_headquarters,
    // Photos/signatures sync out-of-band; only pass absolute URLs for now.
    passport_photo: displayableImage(row.passport_photo),
    signature: displayableImage(row.signature),
  };
};
