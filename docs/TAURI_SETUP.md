# Desktop App (Tauri) — build the installable `.exe`

Status: scaffolded · See also: [OFFLINE_FIRST_ARCHITECTURE.md](OFFLINE_FIRST_ARCHITECTURE.md)

The desktop app is the existing React frontend wrapped in **Tauri v2** (~a few MB,
uses the OS WebView). It talks to the Django backend over HTTP using a
**runtime-configurable server URL**, so the same build works for every PC.

## What's in the repo

```
src-tauri/
  Cargo.toml            Rust crate + Tauri deps
  build.rs              Tauri build hook
  tauri.conf.json       app config (window, bundle targets msi+nsis, icons)
  src/main.rs           desktop entry point
  src/lib.rs            Tauri builder (shell plugin)
  capabilities/default.json   window permissions
  icons/                (you must add these — see below)
vite.config.js          fixed dev port 5173 + ignores src-tauri
package.json            "tauri", "tauri:dev", "tauri:build" scripts
```

The configurable backend URL lives in `src/utils/api.js`
(`getApiBaseUrl` / `setApiBaseUrl`) and there's a **"Server settings"** control on
the login screen so an operator can point the app at your server on first run.
The chosen URL is stored in the WebView's localStorage.

## Prerequisites (on the machine that BUILDS the exe)

1. **Rust toolchain** — install from <https://rustup.rs> (`rustup`, `cargo`).
2. **Microsoft C++ Build Tools** (Windows) — the "Desktop development with C++"
   workload, for the MSVC linker.
3. **WebView2 runtime** — preinstalled on Windows 10/11; Tauri also bundles it.
4. **Node deps** — run `npm install` (installs the newly added `@tauri-apps/cli`
   and `@tauri-apps/api`).

> The React/backend work does not need Rust. Only building the `.exe` does.

## Icons (required before the first build)

Tauri needs app icons. Generate them from any square PNG (≥512×512):

```powershell
npm run tauri icon path\to\cca-logo.png
```

This creates `src-tauri/icons/` with all the sizes referenced in
`tauri.conf.json`. The build will fail until these exist.

## Develop

```powershell
npm run tauri:dev
```

Launches Vite (port 5173) and opens the desktop window with hot reload.

## Build the installer

```powershell
npm run tauri:build
```

Output (Windows):

```
src-tauri/target/release/bundle/
  msi/CCA Staff Biodata_0.1.0_x64_en-US.msi
  nsis/CCA Staff Biodata_0.1.0_x64-setup.exe
```

Distribute either installer. On each client PC, launch the app once and set the
**Backend server URL** (login screen → "Server settings") to your server, e.g.
`https://cca-staff-backend.onrender.com/api`.

## Code signing (optional but recommended)

Unsigned installers trigger a Windows SmartScreen warning ("unknown publisher").
Users can click *More info → Run anyway*. To remove the warning, obtain a
code-signing certificate and set `bundle.windows.certificateThumbprint` (and
related fields) in `tauri.conf.json`. This is a paid certificate (~$100+/yr) and
is not required for internal deployment.

## Notes

- `security.csp` is `null` so the WebView may call whatever backend URL is
  configured. If you fix the server URL, tighten it to a specific `connect-src`.
- The app's offline engine (`src/offline/`) and the staff offline write queue
  work identically inside Tauri — the WebView provides IndexedDB, localStorage
  and Web Crypto.
