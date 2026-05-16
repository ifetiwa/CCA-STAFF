"""Signal handlers for the audit app.

We do three things:

1. Listen to Django's ``user_logged_in`` / ``user_logged_out`` /
   ``user_login_failed`` and write structured AuditLog + LoginAttempt rows.
   We also raise SuspiciousActivity entries for new-IP logins and repeated
   failed attempts.

2. Mirror django-auditlog ``LogEntry`` writes (the automatic create/update/
   delete tracker on registered models) into our custom ``AuditLog`` so the
   viewer has a single source of truth.

3. After every VIEW entry, check the views-per-hour threshold and flag
   excessive activity.
"""
from __future__ import annotations

from django.contrib.auth.signals import (
    user_logged_in,
    user_logged_out,
    user_login_failed,
)
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AuditLog, LoginAttempt
from .services import (
    flag_excessive_views,
    flag_failed_logins,
    flag_new_ip_login,
    record_user_ip,
)
from .utils import (
    get_client_ip,
    log_failed_login,
    log_login,
    log_logout,
)


# ---------------------------------------------------------------------------
# Auth signals
# ---------------------------------------------------------------------------

@receiver(user_logged_in)
def _on_user_logged_in(sender, request, user, **kwargs):
    ip = get_client_ip(request)
    ua = request.META.get("HTTP_USER_AGENT", "") if request is not None else ""

    LoginAttempt.objects.create(
        username_tried=user.username,
        user=user,
        success=True,
        ip_address=ip,
        user_agent=ua,
    )

    # Order matters: flag *before* recording — flag fires only when this IP
    # is not yet known.
    flag_new_ip_login(user, ip)
    record_user_ip(user, ip)

    log_login(request, user)


@receiver(user_logged_out)
def _on_user_logged_out(sender, request, user, **kwargs):
    if user is None:
        return
    log_logout(request, user)


@receiver(user_login_failed)
def _on_user_login_failed(sender, credentials, request=None, **kwargs):
    """Django emits this with the credentials dict the user submitted."""
    username_tried = (
        credentials.get("username")
        or credentials.get("email")
        or "anonymous"
    )
    ip = get_client_ip(request) if request is not None else None
    ua = request.META.get("HTTP_USER_AGENT", "") if request is not None else ""

    LoginAttempt.objects.create(
        username_tried=str(username_tried)[:200],
        success=False,
        failure_reason="Invalid credentials",
        ip_address=ip,
        user_agent=ua,
    )

    log_failed_login(request, username_tried=str(username_tried), reason="Invalid credentials")
    flag_failed_logins(username_tried=str(username_tried), ip=ip)


# ---------------------------------------------------------------------------
# django-auditlog mirror
# ---------------------------------------------------------------------------

def _mirror_logentry(sender, instance, created, **kwargs):
    """Copy a django-auditlog ``LogEntry`` row into our custom ``AuditLog``.

    Runs only on creation (LogEntry rows are immutable) and skips entries we
    already mirrored (the ``remarks`` field carries the source LogEntry id).
    """
    if not created:
        return

    ACTION_MAP = {0: "CREATE", 1: "UPDATE", 2: "DELETE"}
    action = ACTION_MAP.get(instance.action, "OTHER")

    raw_changes = instance.changes or {}
    if isinstance(raw_changes, str):
        try:
            import json
            raw_changes = json.loads(raw_changes)
        except Exception:
            raw_changes = {}

    old_values, new_values, changed_fields = {}, {}, []
    if isinstance(raw_changes, dict):
        for field, vals in raw_changes.items():
            changed_fields.append(field)
            if isinstance(vals, (list, tuple)) and len(vals) == 2:
                old_values[field] = vals[0]
                new_values[field] = vals[1]

    user = instance.actor
    AuditLog.objects.create(
        user=user.username if user else "system",
        user_email=getattr(user, "email", None) or None,
        action=action,
        model_name=(
            f"{instance.content_type.app_label}.{instance.content_type.model}"
            if instance.content_type_id else "unknown"
        ),
        record_id=str(instance.object_pk or instance.object_id or "-"),
        record_identifier=(instance.object_repr or "")[:500],
        old_values=old_values,
        new_values=new_values,
        changed_fields=changed_fields,
        ip_address=instance.remote_addr,
        remarks=f"auditlog#{instance.pk}",
        status="SUCCESS",
    )


def connect_auditlog_mirror():
    """Hook ``_mirror_logentry`` to django-auditlog's LogEntry post_save."""
    try:
        from auditlog.models import LogEntry
    except Exception:
        return
    post_save.connect(
        _mirror_logentry, sender=LogEntry,
        dispatch_uid="audit.mirror_auditlog_logentry",
    )


# ---------------------------------------------------------------------------
# Excessive-views trigger
# ---------------------------------------------------------------------------

@receiver(post_save, sender=AuditLog, dispatch_uid="audit.check_excessive_views")
def _check_excessive_views(sender, instance, created, **kwargs):
    if not created or instance.action != "VIEW":
        return
    # Cheap by design — single COUNT query against an indexed (user, timestamp)
    flag_excessive_views(user_or_username=instance.user)
