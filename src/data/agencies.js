// LocalStorage-backed agency store.
//
// Agencies are the parent bodies a staff member can belong to (e.g. the
// Customary Court of Appeal itself, or an affiliated / seconding agency).
// The list is intentionally lightweight — just distinct names — and grows
// automatically as Bulk Import encounters agencies it hasn't seen before,
// mirroring how departments/units accumulate. Anything that consumes this
// store stays in sync via the `cca:agencies-changed` event.

const STORAGE_KEY = 'cca.agencies.v1';

const SEED_AGENCIES = [
  'Customary Court of Appeal',
];

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((n) => typeof n === 'string');
    }
  } catch { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_AGENCIES));
  return [...SEED_AGENCIES];
};

const write = (agencies) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agencies));
  window.dispatchEvent(new Event('cca:agencies-changed'));
};

export const listAgencies = () => read();

export const getAgency = (name) =>
  read().find((a) => a.toLowerCase() === String(name || '').toLowerCase()) || null;

// Add an agency if it isn't already present (case-insensitive). Returns the
// canonical stored name so callers can normalise casing.
export const addAgency = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, reason: 'Agency name is required.' };
  const existing = read();
  const match = existing.find((a) => a.toLowerCase() === clean.toLowerCase());
  if (match) return { ok: true, agency: match, created: false };
  const next = [...existing, clean];
  write(next);
  return { ok: true, agency: clean, created: true };
};

export const removeAgency = (name) => {
  write(read().filter((a) => a.toLowerCase() !== String(name || '').toLowerCase()));
};

export const subscribeAgencies = (fn) => {
  const handler = () => fn(read());
  window.addEventListener('cca:agencies-changed', handler);
  return () => window.removeEventListener('cca:agencies-changed', handler);
};
