#!/usr/bin/env bash
# Render build hook — installs deps, collects static, applies migrations,
# and (optionally) seeds a super-admin account.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Idempotent super-admin bootstrap. Runs only if SEED_ADMIN_PASSWORD is set
# in the Render dashboard, so accidental redeploys don't reset the password
# once you've unset that env var. The command is safe to re-run: it resets
# the password to the supplied value and clears any lockout cache.
if [ -n "${SEED_ADMIN_PASSWORD}" ]; then
    echo "==> Seeding super-admin user…"
    python manage.py seed_super_admin
fi
