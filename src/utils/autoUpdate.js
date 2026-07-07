// Tauri auto-update.
//
// No-op in the browser/web build; only runs inside the packaged desktop app.
// It checks the GitHub Releases endpoint configured in
// src-tauri/tauri.conf.json. If a newer *signed* version exists it can be
// downloaded + installed, then the app relaunches. Updates that can't be
// verified against the matching public key are rejected by the client, so this
// is safe. The updater plugin is already compiled into the shipped exe, so the
// UI around it (Settings → App Updates) ships as a normal frontend release.
//
// See docs/AUTO_UPDATE.md for how to publish a new version.

export const inTauri = () =>
  typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

/** Currently-running app version (e.g. "0.3.1"), or "" outside the desktop app. */
export async function getAppVersion() {
  if (!inTauri()) return ''
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return ''
  }
}

/**
 * Check the release endpoint WITHOUT prompting. Returns a plain object the UI
 * can render:
 *   { checked, available, version, notes, date, update }
 * `update` is the raw handle used by installUpdate(); null when none.
 */
export async function inspectUpdate() {
  if (!inTauri()) return { checked: false, available: false }
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return { checked: true, available: false }
  return {
    checked: true,
    available: true,
    version: update.version,
    notes: update.body || '',
    date: update.date || '',
    update,
  }
}

/**
 * Download + install a previously-found update, then relaunch. `onProgress` is
 * called with { phase, downloaded, total, pct } as bytes stream in.
 * Call only after the user has approved.
 */
export async function installUpdate(update, onProgress = () => {}) {
  if (!update) throw new Error('No update to install')
  let total = 0
  let downloaded = 0
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data?.contentLength || 0
        onProgress({ phase: 'downloading', downloaded: 0, total, pct: 0 })
        break
      case 'Progress':
        downloaded += event.data?.chunkLength || 0
        onProgress({
          phase: 'downloading',
          downloaded,
          total,
          pct: total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0,
        })
        break
      case 'Finished':
        onProgress({ phase: 'installing', downloaded: total, total, pct: 100 })
        break
      default:
        break
    }
  })
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

/**
 * Silent launch-time check (used from main.jsx). Prompts with the built-in
 * confirm dialog; the richer flow lives in Settings → App Updates.
 */
export async function checkForUpdates({ silent = true } = {}) {
  if (!inTauri()) return { checked: false }
  try {
    const info = await inspectUpdate()
    if (!info.available) return { checked: true, available: false }

    const proceed = window.confirm(
      `A new version (${info.version}) of CCA Staff Biodata is available.\n\n` +
      `${info.notes ? info.notes + '\n\n' : ''}` +
      `Update now? Your work is already saved; the app will restart when finished.`,
    )
    if (!proceed) return { checked: true, available: true, installed: false }

    await installUpdate(info.update)
    return { checked: true, available: true, installed: true }
  } catch (err) {
    if (!silent) console.warn('Update check failed:', err)
    return { checked: true, error: String(err) }
  }
}
