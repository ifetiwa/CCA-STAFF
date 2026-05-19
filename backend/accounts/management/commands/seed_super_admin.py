"""Idempotent super-admin bootstrapper.

Run this once after deploy to guarantee a known login exists:

    python manage.py seed_super_admin

Defaults to username ``teeco`` / password ``Teeco@2026!`` and a fixed email.
Override via flags or environment variables:

    python manage.py seed_super_admin \\
        --username teeco --email tiwa@example.com --password 'StrongPass@2026'

    # or via env:
    SEED_ADMIN_USERNAME=teeco \\
    SEED_ADMIN_EMAIL=tiwa@example.com \\
    SEED_ADMIN_PASSWORD='StrongPass@2026' \\
    python manage.py seed_super_admin

Behaviour:
 - Creates the user if missing, with is_superuser=True, is_staff=True,
   role='super_admin', force_password_change=False.
 - If the user already exists, the password is reset to the supplied one
   and the role/superuser flags are restored. Use this to rescue locked or
   misconfigured accounts.
 - The lockout cache (cache.clear) is wiped so any 5-failed-attempt lock
   on this account is lifted immediately.
"""
from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create or reset a super-admin account (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default=os.environ.get("SEED_ADMIN_USERNAME", "teeco"),
        )
        parser.add_argument(
            "--email",
            default=os.environ.get("SEED_ADMIN_EMAIL", "teeco@cca.gov.ng"),
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("SEED_ADMIN_PASSWORD", "Teeco@2026!"),
        )
        parser.add_argument(
            "--first-name",
            default=os.environ.get("SEED_ADMIN_FIRST_NAME", "Tiwa"),
        )
        parser.add_argument(
            "--last-name",
            default=os.environ.get("SEED_ADMIN_LAST_NAME", "Elegbeleye"),
        )

    def handle(self, *args, **opts):
        username = opts["username"].strip()
        email = opts["email"].strip()
        password = opts["password"]
        first_name = opts["first_name"]
        last_name = opts["last_name"]

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

        user.email = email or user.email
        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        if hasattr(user, "role"):
            user.role = "super_admin"
        if hasattr(user, "force_password_change"):
            user.force_password_change = False
        user.set_password(password)
        user.save()

        # Wipe any lockout/failed-attempt counters left over from earlier
        # bad password guesses against this account.
        cache.clear()

        action = "Created" if created else "Reset"
        self.stdout.write(self.style.SUCCESS(
            f"{action} super-admin '{username}' "
            f"(role=super_admin, is_superuser=True). Lockout cache cleared."
        ))
        self.stdout.write(f"  email:    {user.email}")
        self.stdout.write(f"  password: (use the one you just supplied)")
