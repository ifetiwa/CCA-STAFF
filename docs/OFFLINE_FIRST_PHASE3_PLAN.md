# Plan — Point the desktop UI at the local store (offline-first Phase 3/4)

Status: **in progress** · Owner: Tiwa Elegbeleye · Companion to `OFFLINE_FIRST_ARCHITECTURE.md`

## Goal
Make the app read from the on-device store and sync **deltas** (`/api/sync/pull/?since=`)
instead of re-pulling the full ~1,913-row roster from `/api/staff/` every launch.
Payoff: instant + fully offline UI, and the backend load collapses (the repeated
full-roster pulls are what OOM-killed the 512 MB instance) — enabling a downgrade
back to the cheaper Starter plan.

## What already exists ✅
- Backend `/api/sync/pull/?since=` + `/api/sync/push/` — `backend/sync/` (LWW + tombstones).
- Local IndexedDB store — `src/offline/db.js`; high-level `list/save/remove` — `src/offline/store.js`.
- Background sync loop (start / reconnect / every 60s) — `src/context/SyncContext.jsx`.
- `uuid` / `is_deleted` / `deleted_at` / `updated_at` fields migrated **and backfilled**
  for existing rows — `staff/migrations/0008_sync_fields.py`.

## The only gap
Pages read from `src/data/staff.js`, which hydrates from the heavy `/api/staff/` endpoint.
The synced IndexedDB store runs but nothing reads from it.

## Key design decision (the de-risker)
Keep `data/staff.js`'s **public API identical** (`getAllStaff`, `subscribeStaff`,
`createStaffFromForm`, `updateStaffFromForm`, `bulkDeleteStaff`) and re-implement its
*internals* to be backed by the offline store. No page/component changes — `useStaff()`
and every screen keep working unchanged. Two mapping helpers do the real work:

- **`syncRowToApiLike(row, lookups)`** — converts a local sync row (snake_case, FKs as
  `department_uuid` etc.) into the API-shaped object `mapApiStaff` already consumes,
  resolving FK uuids → names via the local lookup stores. We then reuse the tested
  `mapApiStaff` + `enrich`, which **guarantees shape parity** by construction.
- **`formToSyncRow(form, lookups)`** (Phase C) — resolves department/designation/grade
  name → uuid, assigns a `uuid` for new rows, stamps `updated_at`, hands off to
  `store.save('staff', row)` (optimistic local write + outbox).

## Phases

| Phase | What | Deliverable | Risk |
|-------|------|-------------|------|
| **A. Read path (flagged)** | `syncRowToApiLike` + lookup joins; `hydrateStaffFromOffline()` reads local store → map → feed the existing `_staff`; refresh on `cca:offline-changed`. Behind a flag (default OFF). | App can read from local store on demand | Low — legacy path untouched |
| **B. Default reads to local** | Flip the flag; legacy = first-run fallback until initial pull finishes; "syncing…" state; make background pull refresh the UI. | UI runs off local store; count = 1,913 | Low |
| **C. Write path via sync** | Re-point `createStaffFromForm` / `updateStaffFromForm` / `bulkDeleteStaff` to `formToSyncRow` → `store.save/remove` (outbox). Same signatures. | Edits apply instantly locally, sync to server, appear on other devices | Medium |
| **D. Retire heavy path** | Disable `hydrateStaffFromApi` (fat `/api/staff/` pulls). App only delta-syncs. | Backend load drops; downgrade to Starter | Low once A–C proven |
| **E. Exe polish** | Offline-auth cache, out-of-band photo caching, configurable backend URL, sync-status badge. | "Works offline for days" | Separate sub-tasks |

## Feature flag (Phase A/B)
`offlineReadsEnabled()` = `localStorage['cca.offlineReads'] === '1'` OR
`import.meta.env.VITE_OFFLINE_READS === '1'`. Default OFF. Toggle at runtime from the
browser console to test without a rebuild. Flipping back to OFF restores the legacy
`/api/staff/` read path instantly (rollback).

## Risks & mitigations
- **Shape parity** — reuse `mapApiStaff` via `syncRowToApiLike`, so offline output equals
  the online-hydrated shape by construction; add a comparison spot-check.
- **Two write queues** (legacy `cca.staff.pending` vs the outbox) — drain/disable the
  legacy queue in Phase C so writes don't double.
- **Initial pull** (1,913 + lookups) — one-time; server streams via `.iterator()`;
  subsequent syncs are tiny deltas.
- **Photos** — sync carries a path, not a URL; handled out-of-band (Phase E). Until then
  avatars fall back to initials when the path isn't an absolute URL.
- **Prod check** — confirm migration `0008` is applied on the 2 GB service and a token
  auths against `/api/sync/pull/`.

## Rollback
The Phase-A/B flag flips reads back to the legacy path instantly; the write cutover (C)
is a separate switch. Each stage is independently reversible.

## Effort
~2–3 focused days for A–D (core); E (offline auth, photo caching) as follow-on. Verify
with `/verify` at each phase (drive create→sync→read on two profiles, plus an offline test).
