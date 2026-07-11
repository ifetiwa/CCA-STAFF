"""Scan active staff and create promotion_due / retirement_soon notifications.

Idempotent: each (staff, type, related_date) gets a unique ``dedupe_key``, so
re-running the command does not produce duplicates.

Examples:
    # Run daily via cron / Celery Beat.
    python manage.py generate_notifications

    # Custom windows.
    python manage.py generate_notifications --promotion-days 90 --retirement-days 183

    # Preview only.
    python manage.py generate_notifications --dry-run
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction

from staff.models import Staff

from notifications.models import Notification


def _dedupe_key(kind: str, staff_id: int, related: date) -> str:
    return f"{kind}:{staff_id}:{related.isoformat()}"


class Command(BaseCommand):
    help = (
        "Create in-app notifications for staff whose promotion is due soon "
        "or who are retiring soon."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--promotion-days",
            type=int,
            default=90,
            help="Look-ahead window for promotion_due (default: 90).",
        )
        parser.add_argument(
            "--retirement-days",
            type=int,
            default=183,
            help="Look-ahead window for retirement_soon (default: 183 ≈ 6 months).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing.",
        )

    def handle(self, *args, **options):
        today = date.today()
        promo_cutoff = today + timedelta(days=options["promotion_days"])
        retire_cutoff = today + timedelta(days=options["retirement_days"])
        dry_run = options["dry_run"]

        promo_qs = Staff.objects.filter(
            is_deleted=False,
            is_active=True,
            next_promotion_date__isnull=False,
            next_promotion_date__gte=today,
            next_promotion_date__lte=promo_cutoff,
        ).only("id", "staff_id", "first_name", "last_name", "next_promotion_date")

        retire_qs = Staff.objects.filter(
            is_deleted=False,
            is_active=True,
            retirement_date__isnull=False,
            retirement_date__gte=today,
            retirement_date__lte=retire_cutoff,
        ).only("id", "staff_id", "first_name", "last_name", "retirement_date")

        created_promo = created_retire = skipped = 0

        with transaction.atomic():
            for staff in promo_qs:
                key = _dedupe_key("promotion_due", staff.id, staff.next_promotion_date)
                days_left = (staff.next_promotion_date - today).days
                msg = (
                    f"{staff.get_full_name()} ({staff.staff_id}) is due for "
                    f"promotion on {staff.next_promotion_date.isoformat()} "
                    f"({days_left} day(s) away)."
                )
                if dry_run:
                    self.stdout.write(f"  PROMO: {key}")
                    created_promo += 1
                    continue
                try:
                    with transaction.atomic():
                        Notification.objects.create(
                            recipient_role=Notification.ROLE_ALL,
                            type=Notification.Type.PROMOTION_DUE,
                            staff_member=staff,
                            message=msg,
                            dedupe_key=key,
                        )
                        created_promo += 1
                except IntegrityError:
                    skipped += 1

            for staff in retire_qs:
                key = _dedupe_key("retirement_soon", staff.id, staff.retirement_date)
                days_left = (staff.retirement_date - today).days
                msg = (
                    f"{staff.get_full_name()} ({staff.staff_id}) is due for "
                    f"retirement on {staff.retirement_date.isoformat()} "
                    f"({days_left} day(s) away)."
                )
                if dry_run:
                    self.stdout.write(f"  RETIRE: {key}")
                    created_retire += 1
                    continue
                try:
                    with transaction.atomic():
                        Notification.objects.create(
                            recipient_role=Notification.ROLE_ALL,
                            type=Notification.Type.RETIREMENT_SOON,
                            staff_member=staff,
                            message=msg,
                            dedupe_key=key,
                        )
                        created_retire += 1
                except IntegrityError:
                    skipped += 1

            if dry_run:
                transaction.set_rollback(True)

        verb = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {created_promo} promotion_due + {created_retire} "
            f"retirement_soon notification(s); skipped {skipped} duplicate(s)."
        ))
