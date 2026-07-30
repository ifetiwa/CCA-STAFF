// Backend-backed duty-station (posting location) store with a localStorage
// cache — mirrors data/designations.js.
//
// Reads (`listPostingLocations`) return the cached list synchronously so the
// staff form and Settings pane render without awaiting. Writes are async and
// hit /api/staff/posting-locations/; on success the cache updates and the
// `cca:posting-locations-changed` event fires.
//
// `hydratePostingLocations()` runs once on app start to pull the server's
// authoritative list. Offline callers keep seeing the last cached list.
//
// The cache stores `{ id, name }`; `listPostingLocations()` returns plain
// name strings for the form/select consumers.

import { postingLocationAPI } from '../utils/api';

const STORAGE_KEY = 'cca.postingLocations.v1';

const SEED = ['CCA Headquarters, Abuja'];

const seedCache = () => SEED.map((name, i) => ({ id: `seed-${i}`, name }));

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

const writeCache = (rows) => {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new Event('cca:posting-locations-changed'));
};

const findByName = (cache, name) =>
  cache.find((d) => d.name.toLowerCase() === String(name || '').toLowerCase()) || null;

const normalizeResponse = (data) => {
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

export const listPostingLocations = () => readCache().map((d) => d.name);

export const hydratePostingLocations = async () => {
  try {
    const { data } = await postingLocationAPI.list();
    const rows = normalizeResponse(data).map((d) => ({ id: d.id, name: d.name }));
    writeCache(rows);
    return { ok: true, postingLocations: rows.map((d) => d.name) };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not load duty stations from server.') };
  }
};

export const addPostingLocation = async (name) => {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, reason: 'Duty station name is required.' };
  const cache = readCache();
  if (findByName(cache, clean)) {
    return { ok: false, reason: 'A duty station with that name already exists.' };
  }
  try {
    const { data } = await postingLocationAPI.create(clean);
    writeCache([...cache, { id: data.id, name: data.name }]);
    return { ok: true, postingLocation: data.name };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not add duty station.') };
  }
};

export const renamePostingLocation = async (oldName, newName) => {
  const clean = String(newName || '').trim();
  if (!clean) return { ok: false, reason: 'Duty station name is required.' };
  const cache = readCache();
  const target = findByName(cache, oldName);
  if (!target || target.id == null || String(target.id).startsWith('seed-')) {
    return { ok: false, reason: 'Duty station list is not synced with the server yet. Please refresh and try again.' };
  }
  if (cache.some((d) => d.name.toLowerCase() === clean.toLowerCase() && d.id !== target.id)) {
    return { ok: false, reason: 'A duty station with that name already exists.' };
  }
  try {
    const { data } = await postingLocationAPI.update(target.id, clean);
    writeCache(cache.map((d) => (d.id === target.id ? { id: data.id, name: data.name } : d)));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not rename duty station.') };
  }
};

export const removePostingLocation = async (name) => {
  const cache = readCache();
  const target = findByName(cache, name);
  if (!target || target.id == null || String(target.id).startsWith('seed-')) {
    return { ok: false, reason: 'Duty station list is not synced with the server yet. Please refresh and try again.' };
  }
  try {
    await postingLocationAPI.delete(target.id);
    writeCache(cache.filter((d) => d.id !== target.id));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not remove duty station.') };
  }
};

export const subscribePostingLocations = (fn) => {
  const handler = () => fn(listPostingLocations());
  window.addEventListener('cca:posting-locations-changed', handler);
  return () => window.removeEventListener('cca:posting-locations-changed', handler);
};
