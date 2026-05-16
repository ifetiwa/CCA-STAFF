"""Suspicious activity detection and per-user activity summary.

Thresholds (configurable via Django settings, all optional):

    AUDIT_VIEWS_PER_HOUR_THRESHOLD   default 50
    AUDIT_FAILED_LOGIN_THRESHOLD     default 5   (within FAILED_LOGIN_WINDOW)
    AUDIT_FAILED_LOGIN_WINDOW_MIN    default 15
"""
from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.utils import timezone

from .models import (
    AuditLog,
    LoginAttempt,
    SuspiciousActivity,
    UserKnownIP,
)


def _setting(name: str, default):
    return getattr(settings, name, default)


# ---------------------------------------------------------------------------
# IP tracking
# ---------------------------------------------------------------------------

def record_user_ip(user, ip: str | None) -> tuple[UserKnownIP, bool]:
    """Record a successful login from ``ip``. Returns (row, was_new)."""
    if not ip or user is None or not user.is_authenticated:
        return None, False
    obj, created = UserKnownIP.objects.get_or_create(
        user=user, ip_address=ip,
    )
    if not created:
        # Touch last_seen + bump counter without a second query.
        UserKnownIP.objects.filter(pk=obj.pk).update(
            last_seen=timezone.now(),
            login_count=obj.login_count + 1,
        )
    return obj, created


# ---------------------------------------------------------------------------
# Suspicious activity detectors — each returns the row created (or None)
# ---------------------------------------------------------------------------

def flag_new_ip_login(user, ip: str | None) -> SuspiciousActivity | None:
    """Raise an alert when a user logs in from an IP we've not seen before.

    Only fires once the user has at least one *prior* known IP, so the very
    first login of a brand-new account doesn't trip every time.
    """
    if not ip or user is None or not user.is_authenticated:
        return None

    prior_count = UserKnownIP.objects.filter(user=user).exclude(ip_address=ip).count()
    is_known = UserKnownIP.objects.filter(user=user, ip_address=ip).exists()
    if is_known or prior_count == 0:
        return None

    return SuspiciousActivity.objects.create(
        kind=SuspiciousActivity.Kind.NEW_IP_LOGIN,
        severity=SuspiciousActivity.Severity.MEDIUM,
        user=user,
        username=user.username,
        ip_address=ip,
        description=f"{user.username} logged in from a new IP ({ip}).",
        details={
            "ip_address": ip,
            "prior_known_ip_count": prior_count,
        },
    )


def flag_excessive_views(
    *,
    user_or_username,
    threshold: int | None = None,
    window: timedelta = timedelta(hours=1),
) -> SuspiciousActivity | None:
    """Raise an alert if a user generated more than ``threshold`` VIEW entries
    within ``window``. Idempotent within the window — if an open alert already
    exists, no new one is created."""
    threshold = threshold or _setting("AUDIT_VIEWS_PER_HOUR_THRESHOLD", 50)
    if user_or_username is None:
        return None

    if hasattr(user_or_username, "username"):
        username = user_or_username.username
        user = user_or_username
    else:
        username = str(user_or_username)
        user = None

    now = timezone.now()
    since = now - window
    count = AuditLog.objects.filter(
        user=username, action="VIEW", timestamp__gte=since,
    ).count()
    if count < threshold:
        return None

    if SuspiciousActivity.objects.filter(
        kind=SuspiciousActivity.Kind.EXCESSIVE_VIEWS,
        username=username,
        is_acknowledged=False,
        created_at__gte=since,
    ).exists():
        return None

    return SuspiciousActivity.objects.create(
        kind=SuspiciousActivity.Kind.EXCESSIVE_VIEWS,
        severity=SuspiciousActivity.Severity.HIGH,
        user=user if user and getattr(user, "is_authenticated", False) else None,
        username=username,
        description=(
            f"{username} viewed {count} record(s) in the last "
            f"{int(window.total_seconds() // 60)} minute(s)."
        ),
        details={
            "view_count": count,
            "window_minutes": int(window.total_seconds() // 60),
            "threshold": threshold,
        },
    )


def flag_failed_logins(*, username_tried: str, ip: str | None) -> SuspiciousActivity | None:
    threshold = _setting("AUDIT_FAILED_LOGIN_THRESHOLD", 5)
    window_min = _setting("AUDIT_FAILED_LOGIN_WINDOW_MIN", 15)
    window = timedelta(minutes=window_min)
    if not username_tried:
        return None

    now = timezone.now()
    since = now - window
    count = LoginAttempt.objects.filter(
        username_tried__iexact=username_tried,
        success=False,
        timestamp__gte=since,
    ).count()
    if count < threshold:
        return None

    if SuspiciousActivity.objects.filter(
        kind=SuspiciousActivity.Kind.FAILED_LOGINS,
        username=username_tried,
        is_acknowledged=False,
        created_at__gte=since,
    ).exists():
        return None

    User = get_user_model()
    user = User.objects.filter(username__iexact=username_tried).first()

    return SuspiciousActivity.objects.create(
        kind=SuspiciousActivity.Kind.FAILED_LOGINS,
        severity=SuspiciousActivity.Severity.HIGH,
        user=user,
        username=username_tried,
        ip_address=ip,
        description=(
            f"{count} failed login(s) for '{username_tried}' in the last "
            f"{window_min} minutes."
        ),
        details={
            "failed_count": count,
            "window_minutes": window_min,
            "threshold": threshold,
        },
    )


# ---------------------------------------------------------------------------
# User activity summary
# ---------------------------------------------------------------------------

def user_activity_summary(user_or_username, *, recent_limit: int = 5) -> dict:
    """Per-user snapshot used by the audit dashboard widget."""
    if hasattr(user_or_username, "username"):
        username = user_or_username.username
        user = user_or_username
    else:
        username = str(user_or_username)
        User = get_user_model()
        user = User.objects.filter(username__iexact=username).first()

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    base = AuditLog.objects.filter(user=username)

    last_login_row = base.filter(action="LOGIN").order_by("-timestamp").first()
    actions_today = base.filter(timestamp__gte=today_start).count()
    recent = list(
        base.order_by("-timestamp")
        .values("id", "action", "model_name", "record_id",
                "record_identifier", "timestamp")[:recent_limit]
    )
    by_action_today = dict(
        base.filter(timestamp__gte=today_start)
        .values_list("action")
        .annotate(c=Count("id"))
        .values_list("action", "c")
    )
    open_alerts = SuspiciousActivity.objects.filter(
        Q(username=username) | Q(user=user),
        is_acknowledged=False,
    ).count()

    return {
        "username": username,
        "full_name": (user.get_full_name() if user else "") or username,
        "role": getattr(user, "role", None) if user else None,
        "last_login": last_login_row.timestamp if last_login_row else None,
        "last_login_ip": last_login_row.ip_address if last_login_row else None,
        "actions_today": actions_today,
        "actions_today_by_type": by_action_today,
        "recent_actions": recent,
        "open_alerts": open_alerts,
    }


def all_users_activity_summary(*, limit: int = 100) -> list[dict]:
    """Used by the admin activity panel — returns most recently active users
    (capped) with their summary."""
    rows = (
        AuditLog.objects.values("user")
        .annotate(last_seen=Max("timestamp"))
        .order_by("-last_seen")[:limit]
    )
    return [user_activity_summary(r["user"]) for r in rows]
