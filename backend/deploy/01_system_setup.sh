#!/usr/bin/env bash
# 01 — base OS packages, Python 3.11, PostgreSQL 15, Nginx, Supervisor, UFW
#      + create the unprivileged `biodata` system user and standard dirs.
#
# Idempotent: safe to re-run after a partial failure.

# shellcheck source=_lib.sh
source "$(dirname "$0")/_lib.sh"
require_root

export DEBIAN_FRONTEND=noninteractive

log "Updating apt cache and base packages"
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg lsb-release software-properties-common \
    build-essential pkg-config git acl

# --- Python 3.11 (deadsnakes) -------------------------------------------------
if ! command -v python3.11 >/dev/null 2>&1; then
    log "Adding deadsnakes PPA for Python 3.11"
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -y
fi
apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev

# --- PostgreSQL 15 (PGDG) -----------------------------------------------------
if ! dpkg -s postgresql-15 >/dev/null 2>&1; then
    log "Adding PostgreSQL 15 APT repo (PGDG)"
    install -d -m 0755 /usr/share/keyrings
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -y
fi
apt-get install -y --no-install-recommends postgresql-15 postgresql-client-15

# --- Web stack + image / PDF deps --------------------------------------------
log "Installing nginx, supervisor, UFW and native deps"
apt-get install -y --no-install-recommends \
    nginx supervisor ufw \
    libpq-dev libjpeg-dev zlib1g-dev libfreetype6-dev liblcms2-dev \
    libwebp-dev libharfbuzz-dev libfribidi-dev libxcb1-dev \
    libffi-dev libssl-dev

# --- Application user + standard dirs ----------------------------------------
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    log "Creating system user ${APP_USER}"
    adduser --system --group --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 0755 "${APP_DIR}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 0755 "${LOG_DIR}"
install -d -o "${APP_USER}" -g www-data       -m 0775 "${RUN_DIR}"

# --- logrotate for app logs ---------------------------------------------------
cat > /etc/logrotate.d/biodata <<EOF
${LOG_DIR}/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${APP_USER} ${APP_GROUP}
    sharedscripts
    postrotate
        supervisorctl restart biodata >/dev/null 2>&1 || true
    endscript
}
EOF

# --- enable services ----------------------------------------------------------
systemctl enable --now postgresql nginx supervisor

log "System setup complete."
log "Python:      $(python3.11 --version)"
log "PostgreSQL:  $(sudo -u postgres psql -tAc 'show server_version;')"
log "Nginx:       $(nginx -v 2>&1)"
