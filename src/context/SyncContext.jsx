// Background sync provider.
//
// Runs a full sync (push then pull) when the app is authenticated and online:
//   - once on start,
//   - whenever the browser regains connectivity ('online' event),
//   - on a periodic interval while online.
// It exposes live status (online, syncing, last sync time, pending outbox
// count) for a status indicator, and a manual syncNow() trigger.
//
// All syncs are best-effort: failures (offline / cold start) are swallowed so
// the app keeps working on local data. See docs/OFFLINE_FIRST_ARCHITECTURE.md.

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { sync, forceFullResync } from '../offline/syncClient'
import { getOutbox, getMeta } from '../offline/db'

const SyncContext = createContext()
const INTERVAL_MS = 60_000
// Bump this token to force every device to do one clean full resync on next
// login. v1: heal local stores that cached the roster before passport photos /
// signatures were attached out-of-band. v2: also drop rows the server no longer
// returns (hard-deleted test records with no tombstone) that inflated counts.
// v3: re-mirror after the 2026-07 duplicate cleanup on the server (hard deletes
// don't propagate via delta sync, so devices that already ran v2 were stuck a
// couple of records high until another clean resync).
const RESYNC_TOKEN = 'cca.resync.v3'

export const SyncProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [pending, setPending] = useState(0)
  const timer = useRef(null)

  const refreshStatus = useCallback(async () => {
    try {
      setPending((await getOutbox()).length)
      setLastSync(await getMeta('lastSync'))
    } catch (_) { /* store not ready */ }
  }, [])

  const syncNow = useCallback(async () => {
    if (!isAuthenticated || !navigator.onLine) return
    setSyncing(true)
    try {
      // One-time self-heal: if this device hasn't run the current full-resync
      // token yet, drop the high-water mark so we re-pull the whole roster once
      // (picks up photos/signatures attached without an updated_at bump).
      let needFull = false
      try { needFull = localStorage.getItem(RESYNC_TOKEN) !== '1' } catch (_) { /* no storage */ }
      if (needFull) {
        await forceFullResync()
        try { localStorage.setItem(RESYNC_TOKEN, '1') } catch (_) { /* no storage */ }
      } else {
        await sync()
      }
    } catch (_) {
      /* offline / transient — keep local data */
    } finally {
      setSyncing(false)
      refreshStatus()
    }
  }, [isAuthenticated, refreshStatus])

  // Connectivity listeners.
  useEffect(() => {
    const goOnline = () => { setOnline(true); syncNow() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncNow])

  // Refresh pending count when local data changes.
  useEffect(() => {
    const onChanged = () => refreshStatus()
    window.addEventListener('cca:offline-changed', onChanged)
    return () => window.removeEventListener('cca:offline-changed', onChanged)
  }, [refreshStatus])

  // Start / stop the periodic sync loop with the auth session.
  useEffect(() => {
    if (!isAuthenticated) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    syncNow()
    timer.current = setInterval(syncNow, INTERVAL_MS)
    refreshStatus()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [isAuthenticated, syncNow, refreshStatus])

  return (
    <SyncContext.Provider value={{ online, syncing, lastSync, pending, syncNow }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = () => {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
