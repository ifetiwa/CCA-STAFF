# Neon Postgres Setup — durable free database

Status: ready to execute · See also: [OFFLINE_FIRST_ARCHITECTURE.md](OFFLINE_FIRST_ARCHITECTURE.md)

## Why

Render's **free** Postgres expires (it is deleted after a limited period) and must
not hold durable data. **Neon** free tier is durable (~0.5 GB, always available
with autosuspend). We keep the Render **web service** (kept awake by your 5-min
ping) as the API host, and point its `DATABASE_URL` at Neon for storage.

```
Render web service (API, kept awake by ping)  ->  Neon Postgres (durable, authoritative)
```

## Good news: no code changes required

`biodata_system/settings.py` already uses `DATABASE_URL` as the top-priority
database (with SSL required), and `render.yaml` already has the `DATABASE_URL`
slot. `build.sh` runs `migrate` on every deploy. So switching to Neon is purely
configuration + running migrations.

---

## Step 1 — Create the Neon project

1. Sign up at <https://neon.tech> (free tier).
2. Create a project (region closest to your Render region — check your Render
   service's region and match it to minimise latency).
3. In the project's **Connection Details**, copy the **Pooled connection**
   string. It looks like:
   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```
   - Use the **pooled** endpoint (host contains `-pooler`) — it handles Render's
     short-lived connections better.
   - Make sure it ends with `?sslmode=require`. If Neon gives you
     `channel_binding=require` too, that's fine to keep.

## Step 2 — Point production at Neon

In the **Render dashboard → cca-staff-backend → Environment**:

1. Set `DATABASE_URL` to the Neon pooled string from Step 1.
2. Trigger a deploy (or push a commit). `build.sh` will run
   `python manage.py migrate` against Neon, creating **all** tables including
   the new sync fields (uuid / is_deleted / deleted_at / updated_at).
3. To create the super admin on Neon, set `SEED_ADMIN_PASSWORD` (and confirm
   `SEED_ADMIN_USERNAME` / `SEED_ADMIN_EMAIL`) in the dashboard for that one
   deploy, then unset `SEED_ADMIN_PASSWORD` afterwards so later deploys don't
   keep resetting it.

## Step 3 — (Optional) Test against Neon locally first

Before switching production, you can validate the connection from your machine.
In PowerShell, from `backend/`:

```powershell
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require"
python manage.py migrate
python manage.py createcachetable
python manage.py seed_super_admin   # uses SEED_ADMIN_* env defaults or flags
python manage.py shell -c "from accounts.models import User; print(User.objects.count(), 'users on Neon')"
```

`DATABASE_URL` takes priority over `USE_SQLITE`, so setting it in the shell is
enough — no code edits. Unset it (`Remove-Item Env:DATABASE_URL`) to go back to
local SQLite.

## Step 4 — Load your data

Pick ONE of the following.

### Option A (recommended) — start fresh + import 2000 staff
Neon starts empty. After migrating (Step 2/3):
1. Seed the super admin (Step 2.3 or 3).
2. Seed reference data (departments, designations, grade levels) — via the app
   or a seed command.
3. Use the **bulk Excel import** (`/staff/import/`, admin-only) to load the 2000
   staff. Do it in batches (e.g. 500/file) to stay within the Render free
   instance's memory and request-time limits.

### Option B — transfer the existing rows from local SQLite
From `backend/` with local SQLite active (no `DATABASE_URL` set):

```powershell
# Dump app data only; skip tables that migrate recreates.
python manage.py dumpdata `
  --natural-foreign --natural-primary `
  --exclude contenttypes --exclude auth.permission `
  --exclude admin.logentry --exclude sessions `
  --indent 2 -o transfer.json
```

Then load into Neon:

```powershell
$env:DATABASE_URL = "postgresql://...?sslmode=require"
python manage.py migrate
python manage.py loaddata transfer.json
Remove-Item Env:DATABASE_URL
```

Delete `transfer.json` afterwards — it contains hashed credentials.

## Step 5 — Verify

```powershell
$env:DATABASE_URL = "postgresql://...?sslmode=require"
python manage.py shell -c "from staff.models import Staff; from accounts.models import User; print('staff', Staff.objects.count(), 'users', User.objects.count())"
Remove-Item Env:DATABASE_URL
```
Also hit the live API health check and a sync pull from the deployed service:
`GET https://cca-staff-backend.onrender.com/api/sync/pull/` (with a valid token).

## Safety / rollback

- Keep your local `db.sqlite3` untouched during the switch — it's your fallback.
- Neon has branching + point-in-time restore on the free tier; take a branch
  before large imports.
- Set up an independent backup (e.g. a scheduled `pg_dump` of Neon) once real
  data lands — cloud durability is not a substitute for your own backups.

## Note on `DB_SSL_REQUIRE`

Settings default `DB_SSL_REQUIRE=True`, which makes `dj_database_url` enforce
`sslmode=require`. Neon requires SSL, so leave this at the default.
