// LocalStorage-backed user store for the CCA Staff Biodata system.
//
// This is the source of truth for login credentials, roles and permissions
// in the front-end demo. The Super Administrator can mutate every record
// except their own role (which is always "Super Administrator").

import { ROLE_PRESETS, PERMISSION_KEYS } from './permissions';

const STORAGE_KEY = 'cca.users.v1';

// Seed accounts used to bootstrap the store on first run. Passwords here are
// for testing only — the demo is a closed evaluation environment.
const SEED_USERS = [
  {
    id: 'u-teeco',
    name: 'Teeco Enterprise LTD',
    email: 'teeco@cca.gov.ng',
    password: 'Jitowabs47#',
    role: 'Super Administrator',
    department: 'Executive',
    permissions: [...ROLE_PRESETS['Super Administrator']],
    active: true,
    createdAt: '2026-05-18',
    bootstrap: true,
  },
  {
    id: 'u-president',
    name: 'President of the Court',
    email: 'president@cca.gov.ng',
    password: 'Tower382#',
    role: 'Department Head',
    department: 'Office of the President',
    permissions: [...ROLE_PRESETS['Department Head']],
    active: true,
    createdAt: '2026-05-18',
    bootstrap: true,
  },
  {
    id: 'u-chief-registrar',
    name: 'Chief Registrar',
    email: 'chief.registrar@cca.gov.ng',
    password: 'Maple917!',
    role: 'Department Head',
    department: 'Registry',
    permissions: [...ROLE_PRESETS['Department Head']],
    active: true,
    createdAt: '2026-05-18',
    bootstrap: true,
  },
  {
    id: 'u-director-admin',
    name: 'Director of Administration',
    email: 'director.admin@cca.gov.ng',
    password: 'River254#',
    role: 'Department Head',
    department: 'Administration',
    permissions: [...ROLE_PRESETS['Department Head']],
    active: true,
    createdAt: '2026-05-18',
    bootstrap: true,
  },
  {
    id: 'u-deputy-director',
    name: 'Deputy Director',
    email: 'deputy.director@cca.gov.ng',
    password: 'Cedar638!',
    role: 'Department Head',
    department: 'Administration',
    permissions: [...ROLE_PRESETS['Department Head']],
    active: true,
    createdAt: '2026-05-18',
    bootstrap: true,
  },
  {
    id: 'u-super',
    name: 'Super Administrator',
    email: 'superadmin@cca.gov.ng',
    password: 'SuperAdmin@123',
    role: 'Super Administrator',
    department: 'Executive',
    permissions: [...ROLE_PRESETS['Super Administrator']],
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'u-admin',
    name: 'Aminu Bello',
    email: 'admin@cca.gov.ng',
    password: 'Admin@1234567',
    role: 'Administrator',
    department: 'Administration',
    permissions: [...ROLE_PRESETS['Administrator']],
    active: true,
    createdAt: '2026-01-02',
  },
  {
    id: 'u-hr',
    name: 'Chinyere Okafor',
    email: 'hr@cca.gov.ng',
    password: 'Hr@12345678',
    role: 'HR Officer',
    department: 'Human Resources',
    permissions: [...ROLE_PRESETS['HR Officer']],
    active: true,
    createdAt: '2026-01-03',
  },
  {
    id: 'u-head',
    name: 'Ibrahim Musa',
    email: 'head@cca.gov.ng',
    password: 'Head@1234567',
    role: 'Department Head',
    department: 'Registry',
    permissions: [...ROLE_PRESETS['Department Head']],
    active: true,
    createdAt: '2026-01-04',
  },
  {
    id: 'u-audit',
    name: 'Folake Adeyemi',
    email: 'auditor@cca.gov.ng',
    password: 'Audit@1234567',
    role: 'Auditor',
    department: 'Internal Audit',
    permissions: [...ROLE_PRESETS['Auditor']],
    active: true,
    createdAt: '2026-01-05',
  },
  {
    id: 'u-staff',
    name: 'Tunde Eze',
    email: 'staff@cca.gov.ng',
    password: 'Staff@1234567',
    role: 'Staff',
    department: 'Finance',
    permissions: [...ROLE_PRESETS['Staff']],
    active: true,
    createdAt: '2026-01-06',
  },
];

// Tracks which `bootstrap: true` seed emails have already been merged into
// an existing localStorage store. Once an email is in this set we never
// re-add it — so deleting a bootstrapped account stays deleted.
const BOOTSTRAP_LOG_KEY = 'cca.users.bootstrapped.v1';
// Legacy single-account flag, migrated into the new log on first run.
const LEGACY_TEECO_KEY = 'cca.users.teeco.bootstrapped';

const readBootstrapLog = () => {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) return new Set(list.map((e) => e.toLowerCase()));
  } catch (_) { /* ignore */ }
  return new Set();
};

const writeBootstrapLog = (set) => {
  localStorage.setItem(BOOTSTRAP_LOG_KEY, JSON.stringify([...set]));
};

const ensureBootstrapAccounts = (users) => {
  const log = readBootstrapLog();
  if (localStorage.getItem(LEGACY_TEECO_KEY) === '1') {
    log.add('teeco@cca.gov.ng');
    localStorage.removeItem(LEGACY_TEECO_KEY);
  }

  const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));
  let merged = users;
  let mutated = false;

  for (const seed of SEED_USERS) {
    if (!seed.bootstrap) continue;
    const email = seed.email.toLowerCase();
    if (log.has(email)) continue;
    log.add(email);
    if (!existingEmails.has(email)) {
      merged = [seed, ...merged];
      mutated = true;
    }
  }

  writeBootstrapLog(log);
  if (mutated) localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return ensureBootstrapAccounts(JSON.parse(raw));
  } catch (_) { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_USERS));
  return [...SEED_USERS];
};

const write = (users) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event('cca:users-changed'));
};

export const listUsers = () => read();

export const getUserById = (id) => read().find((u) => u.id === id) || null;

export const findByEmail = (email) =>
  read().find((u) => u.email.toLowerCase() === String(email || '').toLowerCase()) || null;

export const authenticate = (identifier, password) => {
  const user = findByEmail(identifier);
  if (!user) return { ok: false, reason: 'No account matches that email.' };
  if (!user.active) return { ok: false, reason: 'This account has been deactivated.' };
  if (user.password !== password) return { ok: false, reason: 'Incorrect password.' };
  // Strip the password before returning so it never reaches the auth context.
  const { password: _omit, ...safe } = user;
  return { ok: true, user: safe };
};

export const createUser = (data) => {
  const users = read();
  const id = 'u-' + Math.random().toString(36).slice(2, 9);
  const role = data.role || 'Staff';
  const permissions = data.permissions || ROLE_PRESETS[role] || [];
  const user = {
    id,
    name: data.name || data.email,
    email: data.email,
    password: data.password || 'ChangeMe@123',
    role,
    department: data.department || '',
    permissions: [...new Set(permissions)],
    active: data.active !== false,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  users.push(user);
  write(users);
  return user;
};

export const updateUser = (id, patch) => {
  const users = read();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  // The Super Administrator's role is locked.
  if (users[idx].role === 'Super Administrator' && patch.role && patch.role !== 'Super Administrator') {
    delete patch.role;
  }
  users[idx] = { ...users[idx], ...patch };
  if (users[idx].role === 'Super Administrator') {
    users[idx].permissions = [...PERMISSION_KEYS];
  }
  write(users);
  return users[idx];
};

export const deleteUser = (id) => {
  const users = read();
  const target = users.find((u) => u.id === id);
  if (!target || target.role === 'Super Administrator') return false;
  write(users.filter((u) => u.id !== id));
  return true;
};

export const resetPassword = (id, newPassword) => {
  return updateUser(id, { password: newPassword });
};

export const setPermissions = (id, permissions) => {
  return updateUser(id, { permissions: [...new Set(permissions)] });
};

export const applyRolePreset = (id, role) => {
  return updateUser(id, { role, permissions: [...(ROLE_PRESETS[role] || [])] });
};
