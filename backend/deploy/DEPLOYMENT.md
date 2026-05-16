# CCA Biodata — Production Deployment (Ubuntu 22.04, on-prem)

End-to-end runbook for deploying the Staff Biodata Management System on a
court-network Ubuntu 22.04 LTS server. The stack is:

```
   Browser
     ↓ HTTPS (self-signed)
   Nginx  ───── static / media files
     ↓ UNIX socket
   Gunicorn (4 workers, managed by Supervisor)
     ↓
   Django (biodata_system)
     ↓
   PostgreSQL 15
```

> **Convention used everywhere below.** Adjust by editing
> `deploy/env.deploy.sh` (sourced by every script).
>
> | Variable          | Default                       |
> |-------------------|-------------------------------|
> | App user          | `biodata`                     |
> | App directory     | `/opt/biodata`                |
> | Git repo URL      | `https://example.invalid/cca-staff.git` |
> | Domain (cert CN)  | `biodata.cca.local`           |
> | DB name           | `biodata_prod`                |
> | DB user           | `biodata_app`                 |
> | Court LAN CIDRs   | `192.168.0.0/16, 10.0.0.0/8`  |
> | Gunicorn socket   | `/run/gunicorn/biodata.sock`  |
> | Backup directory  | `/var/backups/biodata`        |

---

## 0. Before you start

1. SSH to the server as a sudo-capable user. **Never run anything as root
   directly** — every script uses `sudo` where required.
2. Confirm the box has internet during install (apt repos + pip).
3. Decide your court LAN CIDR(s). The default `192.168.0.0/16, 10.0.0.0/8`
   covers most private ranges — narrow it if you can.
4. Copy `deploy/env.deploy.sh.example` to `deploy/env.deploy.sh` and edit it
   to match your environment.

```bash
cp deploy/env.deploy.sh.example deploy/env.deploy.sh
nano deploy/env.deploy.sh        # set DOMAIN, COURT_LAN, REPO_URL, etc.
```

---

## 1. System packages

Installs Python 3.11 (deadsnakes PPA), PostgreSQL 15 (PGDG repo), Nginx,
Supervisor, UFW, and creates the unprivileged `biodata` system user.

```bash
sudo bash deploy/01_system_setup.sh
```

What it does:
- Adds the `deadsnakes` PPA for Python 3.11.
- Adds the official PostgreSQL APT repo and installs PG 15.
- Installs Nginx, Supervisor, UFW, build deps for psycopg2 / Pillow / ReportLab.
- Creates the system user `biodata` (no shell, owns `/opt/biodata`).

---

## 2. PostgreSQL database & role

Creates the production database, a role with **only the privileges this app
needs** (no SUPERUSER, no CREATEDB, no CREATEROLE), and schedules the daily
backup via cron.

```bash
sudo bash deploy/02_postgres_setup.sh
```

What it does:
- Creates role `biodata_app` with a random 32-char password (printed once
  — copy it into `/opt/biodata/backend/.env`).
- Creates database `biodata_prod` owned by `biodata_app`.
- Grants only `CONNECT`, `USAGE`, and per-table `SELECT/INSERT/UPDATE/DELETE`
  privileges. **No** `DROP`, `TRUNCATE`, schema-level changes.
- Installs `/usr/local/bin/biodata-backup.sh` (pg_dump → gzip → 30-day
  rotation in `/var/backups/biodata`).
- Adds a root cron entry: nightly at 02:15.

> ⚠️ The role password is shown **once** and never stored on disk. Paste it
> straight into `.env` before the script exits.

---

## 3. Application deployment

Clones the repo, builds the venv, installs requirements, runs migrations,
collects static files, and prompts to create the first superuser.

```bash
sudo bash deploy/03_app_deploy.sh
```

What it does (all as the `biodata` user):
- `git clone $REPO_URL /opt/biodata`
- `python3.11 -m venv /opt/biodata/venv`
- `pip install -r backend/requirements.txt gunicorn`
- Renders `backend/.env` from `deploy/env.production.template` (placeholders
  for SECRET_KEY auto-generated; you fill in the DB password from step 2).
- `python manage.py migrate`
- `python manage.py collectstatic --noinput`
- Optional interactive `createsuperuser`.

After this step, edit `/opt/biodata/backend/.env` if anything else needs
tuning (email settings, court branding, etc.), then run:

```bash
sudo systemctl reload supervisor
```

---

## 4. Gunicorn + Supervisor

```bash
sudo cp deploy/gunicorn.conf.py /opt/biodata/deploy/gunicorn.conf.py
sudo cp deploy/supervisor-biodata.conf /etc/supervisor/conf.d/biodata.conf
sudo mkdir -p /run/gunicorn && sudo chown biodata:www-data /run/gunicorn
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status biodata
```

You should see `biodata RUNNING`. Gunicorn runs 4 sync workers bound to a
UNIX socket, restarts automatically if it crashes (`autorestart=true`,
`startretries=5`).

Logs: `/var/log/biodata/gunicorn.{out,err}.log` (rotated weekly by
logrotate — config dropped in by step 1).

---

## 5. Nginx + self-signed TLS

```bash
sudo bash deploy/04_ssl_selfsigned.sh        # generates cert for $DOMAIN
sudo cp deploy/nginx-biodata.conf /etc/nginx/sites-available/biodata
sudo ln -sf /etc/nginx/sites-available/biodata /etc/nginx/sites-enabled/biodata
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

The template `nginx-biodata.conf`:
- Listens on **80** (redirects to HTTPS) and **443** (TLS).
- Serves `/static/` and `/media/` directly from disk (with `expires 30d`
  on static).
- Proxies everything else to Gunicorn over the UNIX socket.
- Drops a request that doesn't originate from the court LAN (`allow`/`deny`
  block — edit the CIDRs to match your network).
- Adds standard hardening headers: HSTS, X-Frame-Options DENY,
  X-Content-Type-Options nosniff, Referrer-Policy strict-origin.

The self-signed cert is valid for 825 days and stored in
`/etc/ssl/biodata/`. Trust it on each client machine to silence browser
warnings, or replace with your internal CA cert later by overwriting the
two files.

---

## 6. Firewall (UFW)

```bash
sudo bash deploy/05_firewall.sh
```

What it does:
- `ufw default deny incoming` / `ufw default allow outgoing`.
- Allows **22, 80, 443** **only from the court LAN CIDRs**.
- Refuses everything else, including direct PostgreSQL (5432) and
  Gunicorn socket — those are reachable only on the loopback / via Nginx.
- Enables UFW non-interactively.

Verify with:

```bash
sudo ufw status verbose
```

---

## 7. Smoke test

From a machine on the court LAN:

```bash
curl -k https://biodata.cca.local/api/accounts/login/ -d username=...&password=...
```

In a browser, visit `https://biodata.cca.local/` and sign in as the
superuser created in step 3.

Confirm:
- Static assets load (CSS, photos).
- `/admin/` reachable; audit log writes appear when you create/edit a staff
  record.
- A backup file appears in `/var/backups/biodata/` the morning after.

---

## 8. Operational basics

| Task                          | Command                                          |
|-------------------------------|--------------------------------------------------|
| Restart app after code change | `sudo supervisorctl restart biodata`             |
| Tail application logs         | `sudo tail -f /var/log/biodata/gunicorn.err.log` |
| Tail nginx access log         | `sudo tail -f /var/log/nginx/biodata.access.log` |
| Manual backup now             | `sudo /usr/local/bin/biodata-backup.sh`          |
| Restore a backup              | `gunzip -c /var/backups/biodata/<file>.sql.gz \| sudo -u postgres psql biodata_prod` |
| Update code (after git pull)  | `sudo bash deploy/06_update.sh`                  |

---

## 9. Disaster checklist

1. Service down → `sudo supervisorctl status biodata` → check
   `/var/log/biodata/gunicorn.err.log`.
2. 502 from Nginx → socket not present → `ls -l /run/gunicorn/`; reapply
   step 4 if `/run/gunicorn` got wiped (it's a tmpfs).
3. DB connection refused → `sudo systemctl status postgresql@15-main`.
4. Disk full from backups → adjust `RETENTION_DAYS` in
   `/usr/local/bin/biodata-backup.sh` (default 30).
