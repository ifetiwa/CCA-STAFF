"""Register domain models with django-auditlog.

django-auditlog observes ``post_save`` / ``post_delete`` on each registered
model and writes a ``LogEntry`` row capturing field-level diffs. Our own
mirror signal (audit.signals._mirror_logentry) then copies each LogEntry
into the custom ``AuditLog`` model.

Fields that should never appear in change diffs (passwords, raw tokens,
internal counters) are listed in ``exclude_fields``.
"""
from __future__ import annotations


def register_all():
    try:
        from auditlog.registry import auditlog
    except Exception:
        return

    # --- accounts ----------------------------------------------------------
    try:
        from accounts.models import User
        auditlog.register(
            User,
            exclude_fields=[
                "password", "last_login", "date_joined",
            ],
        )
    except Exception:
        pass

    # --- staff -------------------------------------------------------------
    try:
        from staff.models import Notification, Staff, StaffPromotion, StaffTransfer
        auditlog.register(
            Staff,
            exclude_fields=[
                # auto-derived snapshot fields — noisy without adding signal
                "updated_at",
                "years_of_service",
                "retirement_date",
                "retirement_date_age_60",
                "retirement_date_service_35",
                "retirement_basis",
                "years_remaining_to_retirement",
                "months_remaining_to_retirement",
                "next_promotion_date",
            ],
        )
        auditlog.register(StaffPromotion)
        auditlog.register(StaffTransfer)
        auditlog.register(Notification, exclude_fields=["is_read"])
    except Exception:
        pass

    # --- departments -------------------------------------------------------
    try:
        from departments.models import (
            Department,
            Designation,
            GradeLevel,
            PostingLocation,
        )
        for m in (Department, Designation, GradeLevel, PostingLocation):
            auditlog.register(m)
    except Exception:
        pass
