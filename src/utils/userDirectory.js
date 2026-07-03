// Lightweight, API-backed directory of system users, used where the UI needs
// to show or pick users (e.g. task assignees). Replaces the old mock
// src/data/users.js store.
//
// Users are fetched from the real UserViewSet and cached in localStorage so the
// directory is available offline too. `listUsers`/`getUserById` are synchronous
// reads of the cache; call `loadUsers()` to refresh from the server.

import { userAPI } from './api'

const KEY = 'cca.userDirectory.v1'

const shape = (u) => ({
  id: u.id,
  name:
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(' ') ||
    u.username ||
    u.email,
  email: u.email,
  role: u.role_display || u.role,
  username: u.username,
  active: u.is_active !== false,
})

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

let cache = readCache()

const writeCache = (list) => {
  cache = list
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('cca:users-changed'))
}

export const listUsers = () => cache

export const getUserById = (id) =>
  cache.find((u) => String(u.id) === String(id)) || null

// Refresh from the server. Falls back to the cached list when offline.
export const loadUsers = async () => {
  try {
    const { data } = await userAPI.list({ page_size: 200 })
    const list = (Array.isArray(data) ? data : data?.results || []).map(shape)
    writeCache(list)
    return list
  } catch (_) {
    return cache
  }
}
