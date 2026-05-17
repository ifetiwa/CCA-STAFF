# Free-tier Deployment Guide

Stack: **Vercel** (frontend) + **Render free** (Django backend) + **Neon** (Postgres) + **Cloudinary** (media) + **UptimeRobot** (keep-alive).

Total cost: **$0/month** (subject to provider free-tier limits — see "Limits & risks" at the bottom).

> ⚠️ Render's free web service sleeps after 15 minutes of inactivity. UptimeRobot pings `/health/` every 5 minutes to keep it warm.

---

## 1. Neon — create the Postgres database

1. Sign up at https://neon.tech (free, no card).
2. Create a project — pick the region closest to where Render will host (Render free runs in **Oregon (US-West)** or **Frankfurt**; pick a Neon region in the same continent for low latency).
3. Copy the **pooled connection string** (looks like `postgresql://user:pass@ep-xxx-pooler.region.neon.tech/dbname?sslmode=require`).
4. Save it — this becomes `DATABASE_URL` later.

---

## 2. Cloudinary — create the media bucket

1. Sign up at https://cloudinary.com (free, no card).
2. From the dashboard, copy the **API Environment Variable** value:
   `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>`
3. Save it — this becomes `CLOUDINARY_URL` later.

---

## 3. Render — deploy the Django backend

1. Sign up at https://render.com with GitHub.
2. New → **Web Service** → connect this GitHub repo.
3. Render auto-detects `render.yaml` at the repo root. Confirm:
   - Root directory: `backend`
   - Build command: `./build.sh`
   - Start command: `gunicorn biodata_system.wsgi:application --workers 2 --threads 4 --timeout 60`
   - Plan: **Free**
4. Set the env vars marked `sync: false` in `render.yaml`:

| Variable | Value |
|---|---|
| `DJANGO_ALLOWED_HOSTS` | `cca-staff-backend.onrender.com` (use your actual Render subdomain) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://cca-staff-backend.onrender.com,https://<your-app>.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` |
| `DATABASE_URL` | Neon connection string from step 1 |
| `CLOUDINARY_URL` | Cloudinary URL from step 2 |

5. Click **Create Web Service**. First build takes ~5 minutes (installs deps, runs `collectstatic`, runs `migrate` against Neon).
6. Once deployed, visit `https://<your-render-subdomain>.onrender.com/health/` → should return `{"status":"ok"}`.
7. Create a Django superuser via Render's **Shell** tab:
   ```bash
   python manage.py createsuperuser
   ```

---

## 4. Migrate existing SQLite data → Neon

Run this **locally** (your machine has the SQLite file). Requires the same Python env you've been using for dev.

### 4a. Export from SQLite

```bash
cd backend
python manage.py dumpdata \
  --natural-foreign --natural-primary \
  --exclude contenttypes --exclude auth.permission \
  --exclude admin.logentry --exclude sessions \
  --indent 2 \
  -o /tmp/cca_dump.json
```

### 4b. Load into Neon

Point your local Django at Neon temporarily (just for this import):

```bash
# Set env vars in your current shell:
$env:DATABASE_URL = "postgresql://user:pass@ep-xxx-pooler.region.neon.tech/dbname?sslmode=require"
$env:USE_SQLITE = "0"

# Tables must exist first — run migrations against Neon:
python manage.py migrate

# Then load the dump:
python manage.py loaddata /tmp/cca_dump.json
```

> If `loaddata` errors on duplicate rows (because `migrate` seeded some), wipe those tables in Neon first (e.g. via `python manage.py flush --no-input`) and re-migrate before loading.

### 4c. Re-upload media (staff photos)

Local SQLite stored photos under `backend/media/`. Cloudinary doesn't have them. Either:
- Re-upload from the admin UI (small datasets), OR
- Use a one-off script that iterates `Staff.objects.filter(photo__isnull=False)` and re-saves the `photo` field — Cloudinary storage will upload on save. Ask if you want this script.

---

## 5. Vercel — deploy the frontend

1. Sign up at https://vercel.com with GitHub.
2. Add New → **Project** → import this repo.
3. Vercel auto-detects Vite via `vercel.json`. Confirm:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Environment Variables** — add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-render-subdomain>.onrender.com/api` |

5. Deploy. Visit the generated `.vercel.app` URL.
6. ⚠️ If login/CORS fails: go back to Render and confirm `CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS` include the exact Vercel URL (with `https://`, no trailing slash).

---

## 6. UptimeRobot — prevent Render sleep

1. Sign up at https://uptimerobot.com (free, 50 monitors, 5-minute interval).
2. Add New Monitor:
   - Type: **HTTPS**
   - URL: `https://<your-render-subdomain>.onrender.com/health/`
   - Interval: **5 minutes** (free tier minimum)
3. Save. The first ping warms the dyno; subsequent pings keep it awake.

> Render's sleep timer is 15 min of inactivity. A 5-min ping cycle keeps it always-on.

---

## Limits & risks (read this)

| Resource | Free-tier limit | What happens at limit |
|---|---|---|
| Render web service | 750 hours/month (one always-on app fits) | Service stops until next month |
| Render bandwidth | 100 GB/month outbound | Throttled / extra cost |
| Neon storage | 0.5 GB | Writes fail; need to upgrade or prune |
| Neon compute | 191.9 compute-hours/month | DB auto-suspends when idle; first query after suspend takes ~1s |
| Cloudinary | 25 GB storage + 25 GB bandwidth | Uploads/downloads blocked |
| Vercel bandwidth | 100 GB/month | Site throttled |
| UptimeRobot | 50 monitors, 5-min interval | Fine for our needs |

### Known limitations of this setup

- **Cold first request after long idle** — Neon may suspend its compute; expect ~1s delay on the first query of the day. The UptimeRobot ping prevents this most of the time.
- **No long-running tasks** — Render free has no background workers. The bulk import endpoint must complete within gunicorn's request timeout (currently 60s). Very large imports may need chunking.
- **Logs are ephemeral** — Render free keeps ~7 days of logs. Use external log aggregation if you need longer retention.
- **No staging environment** — git push → main deploys directly to prod. Use a `staging` branch + a second Render service if you need a buffer.

---

## Updating after deploy

Push to `main`. Render rebuilds the backend, Vercel rebuilds the frontend. Both auto-deploy on push.

For Django migrations: `migrate` runs automatically as part of `build.sh` on each deploy.
