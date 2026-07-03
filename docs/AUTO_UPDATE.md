# Desktop Auto-Update

Status: enabled from **v0.2.0** onward · See also: [TAURI_SETUP.md](TAURI_SETUP.md)

The desktop app checks for a newer version on every launch. If one is found it
prompts the user, downloads it, verifies its signature, installs, and restarts.
You publish updates from your machine (or by pushing a git tag) and every
installed PC picks them up automatically — no need to touch the PCs.

## How it works

- On launch the app calls the endpoint in `src-tauri/tauri.conf.json`:
  `https://github.com/ifetiwa/CCA-STAFF/releases/latest/download/latest.json`.
- If `latest.json` lists a version higher than the installed one, the user is
  prompted to update.
- The download is verified against the **public key** baked into the app. Only
  packages signed with your **private key** are accepted — nobody can push a
  malicious update.

### ⚠️ One-time baseline
Auto-update only works for builds that already contain the updater — i.e.
**v0.2.0 and later**. Any PC still on v0.1.0 must be updated **once by hand**
(install the v0.2.0 setup). From v0.2.0 forward, every future release
auto-updates.

## Signing keys

Generated with `tauri signer generate`:
- **Private key:** `src-tauri/.keys/cca-updater.key` — gitignored, **keep it
  safe and backed up**. If you lose it you can't publish updates that existing
  installs will accept (you'd have to re-distribute a new build by hand).
- **Public key:** embedded in `tauri.conf.json` (`plugins.updater.pubkey`).

The key here has **no password**. Keep the file secret; back it up somewhere
private (e.g. a password manager).

---

## Publishing a new version

Bump the version first in **both** `src-tauri/tauri.conf.json` (`version`) and
`src-tauri/Cargo.toml` (`version`) — e.g. `0.2.0` → `0.3.0`.

### Option A — Automated via GitHub Actions (recommended)

One-time setup: in the GitHub repo → **Settings → Secrets and variables →
Actions**, add:
- `TAURI_SIGNING_PRIVATE_KEY` = the full contents of
  `src-tauri/.keys/cca-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = *(leave empty)*

Then, to release:
```bash
git tag v0.3.0
git push origin v0.3.0
```
The workflow ([.github/workflows/release-desktop.yml](../.github/workflows/release-desktop.yml))
builds, signs, creates the GitHub Release, and uploads the installers **and**
`latest.json`. Within a launch or two, every PC prompts to update. That's the
"update from here" flow you wanted.

### Option B — Manual (from your machine)

```powershell
# From the repo root, with the signing key available:
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw src-tauri\.keys\cca-updater.key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri:build
```
This produces, under `src-tauri/target/release/bundle/`:
- `nsis/CCA Staff Biodata_<ver>_x64-setup.exe` and its `.sig`
- `msi/CCA Staff Biodata_<ver>_x64_en-US.msi` and its `.sig`

Then on GitHub:
1. Create a **Release** tagged `v<ver>` (e.g. `v0.3.0`).
2. Upload the `-setup.exe` (and optionally the `.msi`).
3. Create a `latest.json` file (below) and upload it as a release asset named
   exactly `latest.json`.

`latest.json` format:
```json
{
  "version": "0.3.0",
  "notes": "What changed in this release.",
  "pub_date": "2026-07-03T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE THE CONTENTS OF THE .sig FILE HERE",
      "url": "https://github.com/ifetiwa/CCA-STAFF/releases/download/v0.3.0/CCA.Staff.Biodata_0.3.0_x64-setup.exe"
    }
  }
}
```
> Copy the exact asset URL from the uploaded file on the release page (GitHub
> replaces spaces in filenames with `.`). The `signature` value is the *text
> content* of the matching `-setup.exe.sig` file.

Because the endpoint uses `/releases/latest/download/latest.json`, it always
serves the newest release's manifest.

## Testing an update
1. Install the current version on a test PC.
2. Publish a higher version (Option A or B).
3. Relaunch the app → it should prompt to update, install, and restart on the
   new version.
