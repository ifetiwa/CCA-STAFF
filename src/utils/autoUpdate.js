// Tauri auto-update.
//
// No-op in the browser/web build; only runs inside the packaged desktop app.
// On launch it checks the GitHub Releases endpoint configured in
// src-tauri/tauri.conf.json. If a newer *signed* version exists, it prompts the
// user, downloads + installs it, then relaunches. Updates you can't sign with
// the matching private key are rejected by the client, so this is safe.
//
// See docs/AUTO_UPDATE.md for how to publish a new version.

const inTauri = () =>
  typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

export async function checkForUpdates({ silent = true } = {}) {
  if (!inTauri()) return { checked: false }
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) return { checked: true, available: false }

    const proceed = window.confirm(
      `A new version (${update.version}) of CCA Staff Biodata is available.\n\n` +
      `${update.body ? update.body + '\n\n' : ''}` +
      `Update now? Your work is already saved; the app will restart when finished.`,
    )
    if (!proceed) return { checked: true, available: true, installed: false }

    await update.downloadAndInstall()
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
    return { checked: true, available: true, installed: true }
  } catch (err) {
    if (!silent) console.warn('Update check failed:', err)
    return { checked: true, error: String(err) }
  }
}
