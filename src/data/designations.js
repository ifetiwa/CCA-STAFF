// Backend-backed designation store with a localStorage cache.
//
// Reads (`listDesignations`) return the cached list synchronously so the
// staff form and Settings pane can render without awaiting. Writes
// (`addDesignation`, `renameDesignation`, `removeDesignation`) are async
// and hit the Django API; on success the cache is updated and the
// `cca:designations-changed` event fires.
//
// `hydrateDesignations()` should be called once on app start to pull the
// server's authoritative list into the cache. If the backend is
// unreachable, callers still see the last cached list (offline-friendly).
//
// The cache stores objects `{ id, name }` so writes can target server
// records by id, but `listDesignations()` returns plain strings for
// backwards compatibility with every existing consumer.

import { designationAPI } from '../utils/api';

const STORAGE_KEY = 'cca.designations.v2';

const SEED_DESIGNATIONS = [
  'Court Clerk',
  'Court Registrar',
  'Senior Registrar',
  'Legal Officer',
  'Legal Counsel',
  'Administrative Officer',
  'Human Resources Officer',
  'IT Support Officer',
  'Finance Officer',
  'Accountant',
  'Driver',
  'Secretary',
];

const seedCache = () => SEED_DESIGNATIONS.map((name, i) => ({ id: `seed-${i}`, name }));

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((d) => d && typeof d.name === 'string')
          .map((d) => ({ id: d.id ?? null, name: d.name }));
      }
    }
  } catch (_) { /* ignore */ }
  const seeded = seedCache();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
};

const writeCache = (designations) => {
  const sorted = [...designations].sort((a, b) => a.name.localeCompare(b.name));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new Event('cca:designations-changed'));
};

const findByName = (cache, name) =>
  cache.find((d) => d.name.toLowerCase() === String(name || '').toLowerCase()) || null;

const normalizeResponse = (data) => {
  // DRF may return a paginated envelope or a bare array (pagination is
  // disabled on this ViewSet, but stay defensive).
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const apiErrorReason = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return data.detail;
  if (Array.isArray(data?.name) && data.name.length) return data.name[0];
  return fallback;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const listDesignations = () => readCache().map((d) => d.name);

export const hydrateDesignations = async () => {
  try {
    const { data } = await designationAPI.list();
    const rows = normalizeResponse(data).map((d) => ({ id: d.id, name: d.name }));
    writeCache(rows);
    return { ok: true, designations: rows.map((d) => d.name) };
  } catch (error) {
    // Offline / unauthenticated — keep showing the cached list.
    return { ok: false, reason: apiErrorReason(error, 'Could not load designations from server.') };
  }
};

export const addDesignation = async (name) => {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, reason: 'Designation name is required.' };
  const cache = readCache();
  if (findByName(cache, clean)) {
    return { ok: false, reason: 'A designation with that name already exists.' };
  }
  try {
    const { data } = await designationAPI.create(clean);
    const next = [...cache, { id: data.id, name: data.name }];
    writeCache(next);
    return { ok: true, designation: data.name };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not add designation.') };
  }
};

export const renameDesignation = async (oldName, newName) => {
  const clean = String(newName || '').trim();
  if (!clean) return { ok: false, reason: 'Designation name is required.' };
  const cache = readCache();
  const target = findByName(cache, oldName);
  if (!target || target.id == null || String(target.id).startsWith('seed-')) {
    // Seed-only entry (cache not yet hydrated against the server) — refuse
    // rather than silently desync.
    return { ok: false, reason: 'Designation list is not synced with the server yet. Please refresh and try again.' };
  }
  if (cache.some((d) => d.name.toLowerCase() === clean.toLowerCase() && d.id !== target.id)) {
    return { ok: false, reason: 'A designation with that name already exists.' };
  }
  try {
    const { data } = await designationAPI.update(target.id, clean);
    const next = cache.map((d) => (d.id === target.id ? { id: data.id, name: data.name } : d));
    writeCache(next);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not rename designation.') };
  }
};

export const removeDesignation = async (name) => {
  const cache = readCache();
  const target = findByName(cache, name);
  if (!target || target.id == null || String(target.id).startsWith('seed-')) {
    return { ok: false, reason: 'Designation list is not synced with the server yet. Please refresh and try again.' };
  }
  try {
    await designationAPI.delete(target.id);
    writeCache(cache.filter((d) => d.id !== target.id));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not remove designation.') };
  }
};

export const subscribeDesignations = (fn) => {
  const handler = () => fn(listDesignations());
  window.addEventListener('cca:designations-changed', handler);
  return () => window.removeEventListener('cca:designations-changed', handler);
};
