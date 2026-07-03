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
import { sync } from '../offline/syncClient'
import { getOutbox, getMeta } from '../offline/db'

const SyncContext = createContext()
const INTERVAL_MS = 60_000

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
      await sync()
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
