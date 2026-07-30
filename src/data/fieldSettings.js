// Admin-configurable staff-form field definitions, backed by the Django
// FieldDefinition API with a localStorage cache (mirrors data/designations.js).
//
// `listFieldSettings()` returns the cached array of field objects synchronously
// so the staff form and Settings pane render without awaiting.
// `hydrateFieldSettings()` pulls the authoritative list on app start.
// Writes hit the API and update the cache, firing `cca:field-settings-changed`.

import { fieldSettingAPI } from '../utils/api';

const STORAGE_KEY = 'cca.fieldSettings.v1';

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) { /* ignore */ }
  return [];
};

const writeCache = (rows) => {
  const sorted = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new Event('cca:field-settings-changed'));
};

const normalizeResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const apiErrorReason = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return data.detail;
  for (const k of ['key', 'label', 'non_field_errors']) {
    if (Array.isArray(data?.[k]) && data[k].length) return data[k][0];
  }
  return fallback;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Full array of field-definition objects (cached, synchronous).
export const listFieldSettings = () => readCache();

// { key: fieldDef } map for O(1) lookups from the form.
export const fieldSettingsMap = () => {
  const map = {};
  for (const f of readCache()) map[f.key] = f;
  return map;
};

export const hydrateFieldSettings = async () => {
  try {
    const { data } = await fieldSettingAPI.list();
    const rows = normalizeResponse(data);
    writeCache(rows);
    return { ok: true, fields: rows };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not load field settings from server.') };
  }
};

export const updateFieldSetting = async (id, patch) => {
  const cache = readCache();
  try {
    const { data } = await fieldSettingAPI.update(id, patch);
    writeCache(cache.map((f) => (f.id === id ? { ...f, ...data } : f)));
    return { ok: true, field: data };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not update field.') };
  }
};

export const addCustomField = async ({ label, section, field_type, options = [], required = false }) => {
  const clean = String(label || '').trim();
  if (!clean) return { ok: false, reason: 'Field label is required.' };
  try {
    const { data } = await fieldSettingAPI.create({
      label: clean,
      section: section || 'Additional Information',
      field_type: field_type || 'text',
      options: Array.isArray(options) ? options : [],
      required: !!required,
      enabled: true,
    });
    writeCache([...readCache(), data]);
    return { ok: true, field: data };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not add field.') };
  }
};

export const removeCustomField = async (id) => {
  try {
    await fieldSettingAPI.delete(id);
    writeCache(readCache().filter((f) => f.id !== id));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: apiErrorReason(error, 'Could not remove field.') };
  }
};

export const subscribeFieldSettings = (fn) => {
  const handler = () => fn(listFieldSettings());
  window.addEventListener('cca:field-settings-changed', handler);
  return () => window.removeEventListener('cca:field-settings-changed', handler);
};
