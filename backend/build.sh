#!/usr/bin/env bash
# Render build hook — installs deps, collects static, applies migrations,
# and (optionally) seeds a super-admin account.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Create the DatabaseCache table on first deploy. Safe to run every time —
# it's a no-op if the table already exists.
python manage.py createcachetable 2>/dev/null || true

# Idempotent super-admin bootstrap. Runs only if SEED_ADMIN_PASSWORD is set
# in the Render dashboard, so accidental redeploys don't reset the password
# once you've unset that env var. The command is safe to re-run: it resets
# the password to the supplied value and clears any lockout cache.
if [ -n "${SEED_ADMIN_PASSWORD}" ]; then
    echo "==> Seeding super-admin user…"
    python manage.py seed_super_admin
fi

# Optional demo-staff seed (8 mock rows). Toggle with SEED_DEMO_STAFF=1 in
# the Render dashboard. Safe to re-run — rows are keyed by staff_id and
# updated in place rather than duplicated.
if [ "${SEED_DEMO_STAFF}" = "1" ]; then
    echo "==> Seeding demo staff rows…"
    python manage.py seed_demo_staff
fi
