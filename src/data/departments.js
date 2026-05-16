// LocalStorage-backed department store.
//
// Both Reports & Analytics and Personnel Records read the canonical
// department list from here. The Settings → Departments tab lets Super
// Admin / Admin add or rename departments and the units inside them;
// everything that consumes this store stays in sync via the
// `cca:departments-changed` event.
//
// Seed list mirrors the official department structure published at
// https://fctcca.gov.ng/structure-department.php. Bump STORAGE_KEY when
// the canonical seed changes so existing browsers pick up the new list.

const STORAGE_KEY = 'cca.departments.v3';

const SEED_DEPARTMENTS = [
  { name: 'Litigation Department',                  color: '#1a3a52', units: [] },
  { name: 'Finance and Supply Department',          color: '#f39c12', units: [] },
  { name: 'Administration Department',              color: '#2d5a7b', units: [] },
  { name: 'Audit Department',                       color: '#c0392b', units: [] },
  { name: 'Inspectorate Department',                color: '#16a085', units: [] },
  { name: 'Training Department',                    color: '#3498db', units: [] },
  { name: 'Library Department',                     color: '#8e44ad', units: [] },
  { name: 'Special Duties Department',              color: '#34495e', units: [] },
  { name: 'Probate Department',                     color: '#d4a574', units: [] },
  { name: 'Planning, Research & Statistics Department', color: '#9b59b6', units: [] },
  { name: 'Oath Department',                        color: '#27ae60', units: [] },
  { name: 'Enforcement Department',                 color: '#e74c3c', units: [] },
];

const PALETTE = [
  '#1a3a52', '#2d5a7b', '#d4a574', '#27ae60', '#3498db',
  '#9b59b6', '#f39c12', '#e74c3c', '#16a085', '#c0392b',
  '#8e44ad', '#2c3e50', '#e67e22', '#34495e',
];

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Defensive: ensure every record has a units array.
      return parsed.map((d) => ({ units: [], ...d }));
    }
  } catch (_) { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DEPARTMENTS));
  return SEED_DEPARTMENTS.map((d) => ({ ...d, units: [...(d.units || [])] }));
};

const write = (departments) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(departments));
  window.dispatchEvent(new Event('cca:departments-changed'));
};

export const listDepartments = () => read();

export const listDepartmentNames = () => read().map((d) => d.name);

export const getDepartment = (name) =>
  read().find((d) => d.name.toLowerCase() === String(name || '').toLowerCase()) || null;

export const listUnits = (departmentName) => {
  const dept = getDepartment(departmentName);
  return dept ? [...(dept.units || [])] : [];
};

export const colorFor = (name) => {
  const match = getDepartment(name);
  if (match) return match.color;
  const hash = String(name || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
};

export const addDepartment = ({ name, color }) => {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, reason: 'Name is required.' };
  const existing = read();
  if (existing.some((d) => d.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, reason: 'A department with that name already exists.' };
  }
  const next = [
    ...existing,
    { name: clean, color: color || PALETTE[existing.length % PALETTE.length], units: [] },
  ];
  write(next);
  return { ok: true, department: next[next.length - 1] };
};

export const renameDepartment = (oldName, newName) => {
  const clean = String(newName || '').trim();
  if (!clean) return { ok: false, reason: 'Name is required.' };
  const existing = read();
  if (existing.some((d) => d.name.toLowerCase() === clean.toLowerCase() && d.name !== oldName)) {
    return { ok: false, reason: 'A department with that name already exists.' };
  }
  const next = existing.map((d) => (d.name === oldName ? { ...d, name: clean } : d));
  write(next);
  return { ok: true };
};

export const removeDepartment = (name) => {
  const next = read().filter((d) => d.name !== name);
  write(next);
};

export const addUnit = (departmentName, unitName) => {
  const clean = String(unitName || '').trim();
  if (!clean) return { ok: false, reason: 'Unit name is required.' };
  const existing = read();
  const idx = existing.findIndex((d) => d.name === departmentName);
  if (idx === -1) return { ok: false, reason: 'Department not found.' };
  const units = existing[idx].units || [];
  if (units.some((u) => u.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, reason: 'A unit with that name already exists in this department.' };
  }
  const next = [...existing];
  next[idx] = { ...next[idx], units: [...units, clean] };
  write(next);
  return { ok: true, unit: clean };
};

export const renameUnit = (departmentName, oldName, newName) => {
  const clean = String(newName || '').trim();
  if (!clean) return { ok: false, reason: 'Unit name is required.' };
  const existing = read();
  const idx = existing.findIndex((d) => d.name === departmentName);
  if (idx === -1) return { ok: false, reason: 'Department not found.' };
  const units = existing[idx].units || [];
  if (units.some((u) => u.toLowerCase() === clean.toLowerCase() && u !== oldName)) {
    return { ok: false, reason: 'A unit with that name already exists in this department.' };
  }
  const next = [...existing];
  next[idx] = { ...next[idx], units: units.map((u) => (u === oldName ? clean : u)) };
  write(next);
  return { ok: true };
};

export const removeUnit = (departmentName, unitName) => {
  const existing = read();
  const idx = existing.findIndex((d) => d.name === departmentName);
  if (idx === -1) return;
  const next = [...existing];
  next[idx] = { ...next[idx], units: (next[idx].units || []).filter((u) => u !== unitName) };
  write(next);
};

export const subscribeDepartments = (fn) => {
  const handler = () => fn(read());
  window.addEventListener('cca:departments-changed', handler);
  return () => window.removeEventListener('cca:departments-changed', handler);
};
