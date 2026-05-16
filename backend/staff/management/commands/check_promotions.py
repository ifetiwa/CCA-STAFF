"""
Scan active staff whose next_promotion_date falls within the configured
horizon (default: 90 days) and emit one Notification per eligible staff
member. The (staff, type, related_date) uniqueness constraint on
Notification keeps this idempotent — safe to run daily via cron or
Celery Beat.

Examples:
    # Daily run, default 90-day window.
    python manage.py check_promotions

    # Custom horizon, also flag overdue records.
    python manage.py check_promotions --days 120 --include-overdue

    # Dry run — count what would be created without writing anything.
    python manage.py check_promotions --dry-run
"""

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from staff.models import Notification, Staff


class Command(BaseCommand):
    help = "Create promotion-due notifications for staff approaching their next promotion date."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Look-ahead window in days (default: 90).",
        )
        parser.add_argument(
            "--include-overdue",
            action="store_true",
            help="Also create PROMOTION_OVERDUE notifications for past-due staff.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would happen without writing to the database.",
        )

    def handle(self, *args, **options):
        horizon = options["days"]
        include_overdue = options["include_overdue"]
        dry_run = options["dry_run"]

        today = date.today()
        cutoff = today + timedelta(days=horizon)

        due_qs = (
            Staff.objects.filter(
                is_active=True,
                next_promotion_date__isnull=False,
                next_promotion_date__gte=today,
                next_promotion_date__lte=cutoff,
            )
            .select_related("department", "designation")
            .only(
                "id", "staff_id", "first_name", "last_name",
                "next_promotion_date",
                "department__name", "designation__title",
            )
        )

        overdue_qs = Staff.objects.none()
        if include_overdue:
            overdue_qs = (
                Staff.objects.filter(
                    is_active=True,
                    next_promotion_date__isnull=False,
                    next_promotion_date__lt=today,
                )
                .select_related("department", "designation")
                .only(
                    "id", "staff_id", "first_name", "last_name",
                    "next_promotion_date",
                    "department__name", "designation__title",
                )
            )

        created_due = 0
        created_overdue = 0
        skipped = 0

        with transaction.atomic():
            for staff in due_qs:
                days_left = (staff.next_promotion_date - today).days
                severity = "danger" if days_left <= 30 else "warning"
                title = f"Promotion due in {days_left} day(s)"
                message = (
                    f"{staff.get_full_name()} ({staff.staff_id}) — "
                    f"{staff.designation.title if staff.designation_id else 'unknown role'} — "
                    f"is due for promotion on {staff.next_promotion_date.isoformat()}."
                )

                if dry_run:
                    self.stdout.write(f"  DUE: {staff.staff_id} → {staff.next_promotion_date}")
                    created_due += 1
                    continue

                _, was_created = Notification.objects.get_or_create(
                    staff=staff,
                    type="PROMOTION_DUE",
                    related_date=staff.next_promotion_date,
                    defaults={
                        "severity": severity,
                        "title": title,
                        "message": message,
                    },
                )
                if was_created:
                    created_due += 1
                else:
                    skipped += 1

            for staff in overdue_qs:
                days_over = (today - staff.next_promotion_date).days
                title = f"Promotion overdue by {days_over} day(s)"
                message = (
                    f"{staff.get_full_name()} ({staff.staff_id}) was due for promotion "
                    f"on {staff.next_promotion_date.isoformat()} and has not been confirmed."
                )

                if dry_run:
                    self.stdout.write(f"  OVERDUE: {staff.staff_id} → {staff.next_promotion_date}")
                    created_overdue += 1
                    continue

                _, was_created = Notification.objects.get_or_create(
                    staff=staff,
                    type="PROMOTION_OVERDUE",
                    related_date=staff.next_promotion_date,
                    defaults={
                        "severity": "danger",
                        "title": title,
                        "message": message,
                    },
                )
                if was_created:
                    created_overdue += 1
                else:
                    skipped += 1

            if dry_run:
                transaction.set_rollback(True)

        verb = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {created_due} due notification(s)"
            + (f" and {created_overdue} overdue notification(s)" if include_overdue else "")
            + (f"; {skipped} already existed (skipped)." if not dry_run else ".")
        ))
