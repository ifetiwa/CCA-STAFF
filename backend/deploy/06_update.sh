#!/usr/bin/env bash
# 06 — pull latest code, install new deps, migrate, collectstatic, restart.
#      Use this after a code change instead of re-running 03_app_deploy.sh.

# shellcheck source=_lib.sh
source "$(dirname "$0")/_lib.sh"
require_root

log "Fetching latest code from ${REPO_BRANCH}"
sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all --prune
sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only

log "Updating Python dependencies"
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -r "${PROJECT_DIR}/requirements.txt"

run_manage() {
    sudo -u "${APP_USER}" \
        env PATH="${VENV_DIR}/bin:$PATH" \
        "${VENV_DIR}/bin/python" "${PROJECT_DIR}/manage.py" "$@"
}

log "Running migrations"
run_manage migrate --noinput

log "Collecting static files"
run_manage collectstatic --noinput

log "Restarting Gunicorn"
supervisorctl restart biodata
supervisorctl status biodata

log "Reloading Nginx (in case proxy config changed)"
nginx -t && systemctl reload nginx

log "Update complete."
