# Offline-First + Sync Architecture — CCA Staff Biodata System

Status: **in progress** · Owner: Tiwa Elegbeleye · Last updated: 2026-07-03

## Goal

Ship an **installable desktop app (`.exe`)** for multiple PCs that:
- works **fully offline for days** (local read + write),
- **syncs two-way** with an online authoritative database when internet is available,
- imports and manages ~2000 staff records,
- can run on **free-tier infrastructure** for the pilot.

## Chosen architecture

```
Each PC:  Tauri .exe  ->  local SQLite  (full app, works offline for days)
                             ^ reads          | writes
                 pull changes since last sync | queued in an "outbox",
                             |                 | pushed on reconnect
                             v                 v
Cloud:   Django API (Render, kept awake by ping)  ->  Postgres (Neon, durable free)
                 + permissions + validation + audit + Staff.save() auto-calc
```

### Key decisions (and why)

1. **Django stays the write authority.** `Staff.save()` auto-calculates retirement dates,
   years of service, step increments, etc. Clients must not write straight to the DB or that
   logic (plus permissions and audit) is bypassed. All writes flow through the Django sync API.

2. **Sync identity is an added `uuid` column, NOT a primary-key swap.** Swapping integer PKs to
   UUIDs would break every foreign key, route, and existing API call. Instead each synced row
   gets a stable, globally-unique `uuid` used for cross-device identity. Much lower risk.

3. **Custom sync on Django, not PowerSync/ElectricSQL.** For a $0/free-friendly stack, a sync
   platform needs an always-on service to host. Custom sync rides the Django API we already run,
   adding no new service. Conflict policy: **last-write-wins per record by `updated_at`**, with the
   audit trail as the safety net (real edit collisions are rare at this scale).

4. **Deletes are soft (tombstones).** Hard deletes can't propagate; a `is_deleted` + `deleted_at`
   tombstone syncs the deletion to other devices.

5. **`accounts.User` is the canonical auth model.** The `users` app is dead code (not installed)
   and must be removed from the code paths that still reference it (notably the bulk importer).

6. **Hosting: Render (API, kept awake by 5-min ping) + Neon (durable Postgres).** Render's own
   free Postgres expires and must not hold durable data. Neon free tier is durable.

7. **Offline auth.** On first successful online login, cache the user's hashed credential +
   resolved permissions locally so login and permission checks work offline for days.

8. **Photos sync out-of-band.** Passport photos/signatures are binary blobs; they are stored
   locally and synced separately from the main record stream (lazy), not inline.

## Implementation phases

- **Phase 0** — Foundations: Neon DB, this doc, remove dead `users` app usage / fix importer.
- **Phase 1** — Add sync fields (`uuid`, `is_deleted`, `deleted_at`) to synced models (additive).
- **Phase 2** — Django sync API: `GET /sync/pull/?since=` and `POST /sync/push/`; bulk-import 2000 staff.
- **Phase 3** — Client: retire mock `users.js`, API-driven auth + offline cache, local SQLite + outbox + sync worker.
- **Phase 4** — Package with Tauri into an installable `.exe` with configurable backend URL.
- **Phase 5** — Pilot on 2-3 PCs (test days-offline -> reconnect merge), then roll out.

## Synced models

`staff.Staff`, `staff.StaffTransfer`, `staff.StaffPromotion`, `staff.Notification`,
`departments.*`, `accounts.User`. Each gets `uuid` + tombstone fields; `updated_at` already
exists on `Staff` and is added where missing.
