# deploy/

Production deployment kit for the CCA Biodata Management System on an
on-premises Ubuntu 22.04 server.

Read [DEPLOYMENT.md](./DEPLOYMENT.md) for the step-by-step runbook.

## File index

| File                          | Purpose                                                    |
|-------------------------------|------------------------------------------------------------|
| `DEPLOYMENT.md`               | End-to-end runbook                                         |
| `env.deploy.sh.example`       | Shared shell config for all `*.sh` scripts                 |
| `env.production.template`     | `.env` template rendered by `03_app_deploy.sh`             |
| `_lib.sh`                     | Common bootstrap sourced by every script                   |
| `01_system_setup.sh`          | apt packages, Python 3.11, PostgreSQL 15, Nginx, Supervisor |
| `02_postgres_setup.sh`        | DB + least-privilege role + nightly pg_dump cron           |
| `03_app_deploy.sh`            | git clone, venv, install, migrate, collectstatic           |
| `04_ssl_selfsigned.sh`        | Self-signed TLS cert (RSA 2048, SAN, 825 days)             |
| `05_firewall.sh`              | UFW rules — only court LAN may reach 22/80/443             |
| `06_update.sh`                | Pull + migrate + restart, for code updates                 |
| `gunicorn.conf.py`            | Gunicorn settings (UNIX socket, 4 workers)                 |
| `supervisor-biodata.conf`     | Supervisor program: keep Gunicorn alive                    |
| `tmpfiles-biodata.conf`       | systemd-tmpfiles rule for `/run/gunicorn`                  |
| `nginx-biodata.conf`          | TLS vhost, static/media + LAN allow-list                   |

## Quick start

```bash
cp deploy/env.deploy.sh.example deploy/env.deploy.sh
nano deploy/env.deploy.sh                   # set DOMAIN, REPO_URL, LAN CIDRs
sudo bash deploy/01_system_setup.sh
sudo bash deploy/02_postgres_setup.sh       # copy the printed DB password
nano deploy/env.deploy.sh                   # paste DB_PASSWORD
sudo bash deploy/03_app_deploy.sh
sudo cp deploy/supervisor-biodata.conf /etc/supervisor/conf.d/biodata.conf
sudo cp deploy/tmpfiles-biodata.conf  /etc/tmpfiles.d/biodata.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/biodata.conf
sudo supervisorctl reread && sudo supervisorctl update
sudo bash deploy/04_ssl_selfsigned.sh
sudo cp deploy/nginx-biodata.conf /etc/nginx/sites-available/biodata
sudo ln -sf /etc/nginx/sites-available/biodata /etc/nginx/sites-enabled/biodata
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo bash deploy/05_firewall.sh
```

The full explanations and post-install verification live in `DEPLOYMENT.md`.
