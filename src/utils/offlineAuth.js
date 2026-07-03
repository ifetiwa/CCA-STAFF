// Offline authentication cache.
//
// See docs/OFFLINE_FIRST_ARCHITECTURE.md. On a successful ONLINE login we store,
// per email, a PBKDF2 hash of the password (with a random salt), plus the
// user profile and auth token. When the backend is unreachable, the user can
// still sign in: we re-derive the hash from the entered password and compare.
//
// We never store the plaintext password. The token is cached so the app can
// operate against its local data offline; it is re-validated against the
// server automatically on the next online session.

const KEY = 'cca.offlineAuth.v1'
const ITERATIONS = 100_000

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex) =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16)))

async function derive(password, saltBytes) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256,
  )
  return toHex(bits)
}

const readStore = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
const writeStore = (store) => localStorage.setItem(KEY, JSON.stringify(store))

// Timing-safe-ish string compare (both are fixed-length hex here anyway).
const equalHex = (a, b) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function cacheCredential(email, password, user, token) {
  if (!email || !password) return
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt)
  const store = readStore()
  store[String(email).toLowerCase()] = {
    salt: toHex(salt),
    hash,
    user,
    token,
    cachedAt: new Date().toISOString(),
  }
  writeStore(store)
}

export async function verifyOffline(email, password) {
  const entry = readStore()[String(email || '').toLowerCase()]
  if (!entry) {
    return {
      ok: false,
      reason: 'You appear to be offline and this device has no saved sign-in for that account. Connect to the internet to sign in the first time.',
    }
  }
  const hash = await derive(password, fromHex(entry.salt))
  if (!equalHex(hash, entry.hash)) {
    return { ok: false, reason: 'Incorrect password (offline sign-in).' }
  }
  return { ok: true, user: entry.user, token: entry.token }
}

// Keep the cached profile fresh after an online session refresh.
export function updateCachedUser(email, user) {
  const key = String(email || '').toLowerCase()
  const store = readStore()
  if (store[key]) {
    store[key].user = user
    writeStore(store)
  }
}

export function clearOfflineCredential(email) {
  const store = readStore()
  delete store[String(email || '').toLowerCase()]
  writeStore(store)
}
