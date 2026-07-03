"""Apply step increments to all staff whose scheduled date has arrived.

Rule (Nigerian civil-service Step-Increment):
  * Step rises by 1 once a year.
  * The increment falls on 1 January or 1 July, picked from each staff's
    "present post" anchor date (last_promotion_date, else
    first_appointment_date):
      - anchor month in Jan–Jun  → increment month = January
      - anchor month in Jul–Dec → increment month = July
  * The step caps at the grade's number_of_steps (default 15).

Run daily (idempotent — a staff who already passed today's increment
window is skipped):

    python manage.py apply_step_increments               # process all
    python manage.py apply_step_increments --dry-run     # show what'd change
    python manage.py apply_step_increments --as-of 2027-01-01

The ``--as-of`` flag lets you simulate a future run (useful in tests).
"""
from __future__ import annotations

from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from audit.models import AuditLog
from staff.models import Staff


class Command(BaseCommand):
    help = "Advance Step by 1 for staff whose next_increment_date has been reached."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Print the rows that would change without saving.",
        )
        parser.add_argument(
            "--as-of", metavar="YYYY-MM-DD",
            help="Override 'today' (useful in tests).",
        )

    def handle(self, *args, **opts):
        if opts["as_of"]:
            try:
                today = date.fromisoformat(opts["as_of"])
            except ValueError as exc:
                raise CommandError(f"--as-of must be YYYY-MM-DD: {exc}") from exc
        else:
            today = date.today()

        # Eligible: scheduled date reached, still active.
        eligible = (
            Staff.objects
            .select_related("grade_level")
            .filter(
                is_active=True,
                next_increment_date__isnull=False,
                next_increment_date__lte=today,
            )
        )

        applied = 0
        capped = 0
        rows = []
        with transaction.atomic():
            for staff in eligible:
                old_step = staff.grade_step or 1
                max_step = staff.max_step()
                if old_step >= max_step:
                    capped += 1
                    rows.append(
                        (staff.staff_id, staff.get_full_name(), old_step, old_step,
                         "capped (already at max)")
                    )
                    # Still bump the scheduled date so we don't re-evaluate
                    # this row every day until manual intervention.
                    staff.last_increment_date = today
                    staff.next_increment_date = staff.calculate_next_increment_date(reference=today)
                    if not opts["dry_run"]:
                        staff.save(update_fields=["last_increment_date", "next_increment_date"])
                    continue

                new_step = old_step + 1
                rows.append(
                    (staff.staff_id, staff.get_full_name(), old_step, new_step, "ok")
                )
                if opts["dry_run"]:
                    continue

                staff.grade_step = new_step
                staff.last_increment_date = today
                staff.next_increment_date = staff.calculate_next_increment_date(reference=today)
                staff.updated_by = "apply_step_increments"
                staff.save(update_fields=[
                    "grade_step", "last_increment_date", "next_increment_date", "updated_by",
                ])
                # Audit trail for traceability.
                try:
                    AuditLog.objects.create(
                        user="apply_step_increments",
                        action="UPDATE",
                        model_name="Staff",
                        record_id=str(staff.pk),
                        record_identifier=f"{staff.staff_id} — {staff.get_full_name()}",
                        old_values={"grade_step": old_step},
                        new_values={"grade_step": new_step,
                                    "next_increment_date": staff.next_increment_date.isoformat()
                                    if staff.next_increment_date else None},
                        changed_fields=["grade_step", "next_increment_date"],
                        status="SUCCESS",
                        remarks=f"Annual step increment as-of {today.isoformat()}.",
                    )
                except Exception:
                    pass
                applied += 1

        # Reporting.
        for row in rows:
            sid, name, old, new, note = row
            arrow = "→" if old != new else "·"
            self.stdout.write(f"  {sid:18} {name:30} step {old} {arrow} {new}  ({note})")

        msg = (
            f"Done. as-of={today.isoformat()}  eligible={len(rows)}  "
            f"applied={applied}  capped={capped}"
        )
        if opts["dry_run"]:
            msg = "[DRY-RUN] " + msg
        self.stdout.write(self.style.SUCCESS(msg))
