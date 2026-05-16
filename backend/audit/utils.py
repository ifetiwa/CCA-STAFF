"""Helpers for writing structured AuditLog entries.

The custom ``AuditLog`` model stores the username as a CharField (not a FK),
along with rich request context. This helper keeps callers from having to
remember every field.
"""
from __future__ import annotations

from typing import Any, Iterable, Mapping

from .models import AuditLog


def get_client_ip(request) -> str | None:
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _jsonable(value: Any) -> Any:
    """Convert a value into something safe to drop into a JSONField."""
    from datetime import date, datetime
    from decimal import Decimal
    from django.db.models import Model
    from django.core.files import File

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Model):
        return str(value)
    if isinstance(value, File):
        return getattr(value, "name", None)
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if isinstance(value, Mapping):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return str(value)


def serialize_for_audit(data: Mapping[str, Any]) -> dict:
    """JSON-safe copy of ``data`` (drops file uploads to filename strings)."""
    return {k: _jsonable(v) for k, v in data.items()}


def _actor(request):
    user = getattr(request, "user", None) if request is not None else None
    if user and user.is_authenticated:
        return user.username, (user.email or None)
    return "anonymous", None


def _request_meta(request) -> dict:
    if request is None:
        return {
            "ip_address": None,
            "user_agent": "",
            "request_method": "",
            "request_path": "",
        }
    return {
        "ip_address": get_client_ip(request),
        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:1024],
        "request_method": request.method or "",
        "request_path": (request.path or "")[:500],
    }


def log_action(
    request,
    *,
    action: str,
    instance,
    new_values: Mapping[str, Any] | None = None,
    old_values: Mapping[str, Any] | None = None,
    changed_fields: Iterable[str] | None = None,
    remarks: str = "",
    status: str = "SUCCESS",
    error_message: str = "",
) -> AuditLog:
    """Append a single AuditLog entry tied to a model instance."""
    username, email = _actor(request)
    return AuditLog.objects.create(
        user=username,
        user_email=email,
        action=action,
        model_name=f"{instance._meta.app_label}.{instance._meta.model_name}",
        record_id=str(instance.pk),
        record_identifier=str(instance)[:500],
        old_values=serialize_for_audit(old_values or {}),
        new_values=serialize_for_audit(new_values or {}),
        changed_fields=list(changed_fields or []),
        remarks=remarks,
        status=status,
        error_message=error_message,
        **_request_meta(request),
    )


# ---------------------------------------------------------------------------
# Manual logging primitives (no model instance required)
# ---------------------------------------------------------------------------

def _log_raw(
    request,
    *,
    action: str,
    model_name: str,
    record_id: str = "-",
    record_identifier: str = "",
    new_values: Mapping[str, Any] | None = None,
    old_values: Mapping[str, Any] | None = None,
    remarks: str = "",
    status: str = "SUCCESS",
    error_message: str = "",
    username_override: str | None = None,
    email_override: str | None = None,
) -> AuditLog:
    if username_override is not None:
        username, email = username_override, email_override
    else:
        username, email = _actor(request)
    return AuditLog.objects.create(
        user=username,
        user_email=email,
        action=action,
        model_name=model_name,
        record_id=str(record_id),
        record_identifier=record_identifier[:500],
        old_values=serialize_for_audit(old_values or {}),
        new_values=serialize_for_audit(new_values or {}),
        remarks=remarks,
        status=status,
        error_message=error_message,
        **_request_meta(request),
    )


def log_login(request, user) -> AuditLog:
    return _log_raw(
        request,
        action="LOGIN",
        model_name="accounts.user",
        record_id=str(user.pk),
        record_identifier=user.username,
        username_override=user.username,
        email_override=user.email or None,
        new_values={"role": getattr(user, "role", None)},
        remarks="User signed in.",
    )


def log_logout(request, user) -> AuditLog:
    pk = getattr(user, "pk", None) or "-"
    return _log_raw(
        request,
        action="LOGOUT",
        model_name="accounts.user",
        record_id=str(pk),
        record_identifier=getattr(user, "username", "anonymous"),
        username_override=getattr(user, "username", "anonymous"),
        email_override=getattr(user, "email", None) or None,
        remarks="User signed out.",
    )


def log_failed_login(request, *, username_tried: str, reason: str = "") -> AuditLog:
    return _log_raw(
        request,
        action="LOGIN_FAILED",
        model_name="accounts.user",
        record_id="-",
        record_identifier=username_tried,
        username_override=username_tried or "anonymous",
        new_values={"reason": reason} if reason else None,
        remarks=reason or "Invalid credentials.",
        status="FAILURE",
        error_message=reason,
    )


def log_view(request, instance, *, remarks: str = "") -> AuditLog:
    """Record a record-view. Used to drive the >50-views/hr threshold."""
    return log_action(
        request,
        action="VIEW",
        instance=instance,
        remarks=remarks or "Record viewed.",
    )


def log_search(
    request, *, model_name: str, query: str, result_count: int, filters: Mapping | None = None,
) -> AuditLog:
    return _log_raw(
        request,
        action="SEARCH",
        model_name=model_name,
        record_id="-",
        record_identifier=(query or "")[:200] or "(empty)",
        new_values={"query": query, "filters": dict(filters or {}), "results": result_count},
        remarks=f"Search returned {result_count} record(s).",
    )


def log_download(
    request,
    *,
    label: str,
    file_kind: str,
    record_id: str = "-",
    extra: Mapping | None = None,
) -> AuditLog:
    """Record a file or report download (CSV/PDF/Excel/image/etc.)."""
    return _log_raw(
        request,
        action="DOWNLOAD",
        model_name="report" if file_kind in {"pdf", "xlsx", "csv"} else "file",
        record_id=str(record_id),
        record_identifier=label[:500],
        new_values={"file_kind": file_kind, **(dict(extra) if extra else {})},
        remarks=f"Downloaded {label} ({file_kind}).",
    )


def log_bulk_import(
    request,
    *,
    model_name: str,
    total: int,
    imported: int,
    failed: int,
    source: str = "",
    extra: Mapping | None = None,
) -> AuditLog:
    status = "SUCCESS" if failed == 0 else ("PARTIAL" if imported > 0 else "FAILURE")
    return _log_raw(
        request,
        action="BULK_IMPORT",
        model_name=model_name,
        record_id="-",
        record_identifier=f"Bulk import: {imported}/{total} rows",
        new_values={
            "source": source,
            "total": total,
            "imported": imported,
            "failed": failed,
            **(dict(extra) if extra else {}),
        },
        remarks=f"Bulk import {imported}/{total} (failed {failed}).",
        status=status,
    )
