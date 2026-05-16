#!/usr/bin/env bash
# 03 — clone repo, build venv, install deps, render .env, migrate,
#      collectstatic, optionally createsuperuser.

# shellcheck source=_lib.sh
source "$(dirname "$0")/_lib.sh"
require_root
require_cmd git
require_cmd openssl

# --- Clone or pull ------------------------------------------------------------
if [[ ! -d "${APP_DIR}/.git" ]]; then
    log "Cloning ${REPO_URL} into ${APP_DIR}"
    sudo -u "${APP_USER}" git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
    log "Updating existing checkout"
    sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all --prune
    sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
    sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
fi

[[ -d "${PROJECT_DIR}" ]] || die "Expected ${PROJECT_DIR} (backend/) inside the repo."

# --- virtualenv ---------------------------------------------------------------
if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
    log "Creating virtualenv at ${VENV_DIR}"
    sudo -u "${APP_USER}" python3.11 -m venv "${VENV_DIR}"
fi

log "Installing Python requirements (this may take a few minutes)"
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install --upgrade pip wheel
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -r "${PROJECT_DIR}/requirements.txt"
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install gunicorn

# --- .env rendering -----------------------------------------------------------
ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
    warn ".env already exists at ${ENV_FILE} — leaving it alone."
else
    log "Rendering ${ENV_FILE} from template"
    SECRET_KEY=$(openssl rand -base64 60 | tr -d '\n/=+')
    if [[ -z "${DB_PASSWORD}" ]]; then
        warn "DB_PASSWORD is empty in env.deploy.sh."
        warn "Re-run 02_postgres_setup.sh and copy the password into ${ENV_FILE} manually,"
        warn "or set DB_PASSWORD before running this script."
    fi
    install -m 0640 -o "${APP_USER}" -g "${APP_GROUP}" /dev/null "${ENV_FILE}"
    sed \
        -e "s|__SECRET_KEY__|${SECRET_KEY}|g" \
        -e "s|__DOMAIN__|${DOMAIN}|g" \
        -e "s|__DB_NAME__|${DB_NAME}|g" \
        -e "s|__DB_USER__|${DB_USER}|g" \
        -e "s|__DB_PASSWORD__|${DB_PASSWORD}|g" \
        -e "s|__DB_HOST__|${DB_HOST}|g" \
        -e "s|__DB_PORT__|${DB_PORT}|g" \
        "${SCRIPT_DIR}/env.production.template" > "${ENV_FILE}"
    chown "${APP_USER}:${APP_GROUP}" "${ENV_FILE}"
    chmod 0640 "${ENV_FILE}"
fi

# --- Django bootstrap ---------------------------------------------------------
run_manage() {
    sudo -u "${APP_USER}" \
        env PATH="${VENV_DIR}/bin:$PATH" \
        "${VENV_DIR}/bin/python" "${PROJECT_DIR}/manage.py" "$@"
}

log "Running migrations"
run_manage migrate --noinput

log "Collecting static files"
run_manage collectstatic --noinput

# --- Superuser prompt ---------------------------------------------------------
if [[ -t 0 ]]; then
    read -r -p "Create a Django superuser now? [y/N] " ans
    if [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]; then
        run_manage createsuperuser
    fi
else
    warn "Non-interactive shell — skipping createsuperuser."
    warn "Run later with:  sudo -u ${APP_USER} ${VENV_DIR}/bin/python ${PROJECT_DIR}/manage.py createsuperuser"
fi

# --- Permissions sanity -------------------------------------------------------
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
find "${PROJECT_DIR}/media" -type d -exec chmod 0750 {} + 2>/dev/null || true

log "Application deployed at ${APP_DIR}."
log "Next: install Gunicorn under Supervisor (see DEPLOYMENT.md §4)."
