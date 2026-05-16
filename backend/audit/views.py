"""Audit trail API.

Endpoints (all gated to Admin Staff + Chief Registrar via ``IsAuditViewer``):

* ``GET  /api/audit/entries/``                — paginated list with filters
* ``GET  /api/audit/entries/<id>/``           — full detail (expandable panel)
* ``GET  /api/audit/entries/export.csv``      — CSV export of the filtered set
* ``GET  /api/audit/activity/me/``            — current user's activity summary
* ``GET  /api/audit/activity/user/<name>/``   — single-user activity summary
* ``GET  /api/audit/activity/users/``         — most-recently-active users panel
* ``GET  /api/audit/suspicious/``             — open suspicious-activity alerts
* ``POST /api/audit/suspicious/<id>/ack/``    — acknowledge an alert
* ``GET  /api/audit/login-attempts/``         — recent login attempts
* ``GET  /api/audit/filters/``                — distinct values for filter UI

Filtering on the list endpoint:
    ?user=<username>
    ?action=<CREATE|UPDATE|...>           (repeat for multiple)
    ?date_from=YYYY-MM-DD
    ?date_to=YYYY-MM-DD
    ?staff_id=<staff_pk>                  (matches model=staff.staff & record)
    ?model=<app.model>
    ?ip=<ip>
    ?q=<free text>                        (matches user/record_identifier)
    ?ordering=<field|-field>              (default: -timestamp)
"""
from __future__ import annotations

import csv
from datetime import datetime, time, timedelta
from typing import Iterable

from django.http import HttpResponse, Http404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    AuditLog,
    LoginAttempt,
    SuspiciousActivity,
)
from .permissions import IsAuditViewer
from .serializers import (
    AuditLogDetailSerializer,
    AuditLogListSerializer,
    LoginAttemptSerializer,
    SuspiciousActivitySerializer,
)
from .services import all_users_activity_summary, user_activity_summary


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

ORDERING_WHITELIST = {
    "timestamp", "-timestamp",
    "user", "-user",
    "action", "-action",
    "model_name", "-model_name",
}


def _parse_date(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def _apply_filters(qs, request):
    user = request.query_params.get("user")
    if user:
        qs = qs.filter(user__iexact=user)

    actions = request.query_params.getlist("action")
    if actions:
        qs = qs.filter(action__in=[a.upper() for a in actions if a])

    date_from = _parse_date(request.query_params.get("date_from"))
    if date_from:
        qs = qs.filter(timestamp__gte=datetime.combine(date_from, time.min))
    date_to = _parse_date(request.query_params.get("date_to"))
    if date_to:
        # inclusive end-of-day
        qs = qs.filter(timestamp__lte=datetime.combine(date_to, time.max))

    staff_id = request.query_params.get("staff_id")
    if staff_id:
        qs = qs.filter(model_name__iendswith="staff", record_id=str(staff_id))

    model_name = request.query_params.get("model")
    if model_name:
        qs = qs.filter(model_name__iexact=model_name)

    ip = request.query_params.get("ip")
    if ip:
        qs = qs.filter(ip_address=ip)

    q = (request.query_params.get("q") or "").strip()
    if q:
        from django.db.models import Q
        qs = qs.filter(
            Q(user__icontains=q)
            | Q(record_identifier__icontains=q)
            | Q(model_name__icontains=q)
        )

    ordering = request.query_params.get("ordering") or "-timestamp"
    if ordering not in ORDERING_WHITELIST:
        ordering = "-timestamp"
    return qs.order_by(ordering)


# ---------------------------------------------------------------------------
# Audit log viewer
# ---------------------------------------------------------------------------

class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only access to audit entries. Append-only by design — no mutation
    endpoints are exposed."""

    permission_classes = [IsAuthenticated, IsAuditViewer]
    queryset = AuditLog.objects.all()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AuditLogDetailSerializer
        return AuditLogListSerializer

    def filter_queryset(self, queryset):
        return _apply_filters(queryset, self.request)

    @action(detail=False, methods=["get"], url_path="export.csv")
    def export_csv(self, request):
        """Stream the filtered set as CSV. The download itself is logged."""
        qs = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type="text/csv")
        ts = timezone.now().strftime("%Y%m%d_%H%M")
        response["Content-Disposition"] = (
            f'attachment; filename="audit_log_{ts}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            "Timestamp", "User", "Email", "Action", "Model", "Record ID",
            "Record", "IP", "Status", "Old Values", "New Values",
            "Changed Fields", "Request Method", "Request Path", "Remarks",
        ])
        count = 0
        for row in qs.iterator(chunk_size=500):
            writer.writerow([
                row.timestamp.isoformat() if row.timestamp else "",
                row.user,
                row.user_email or "",
                row.get_action_display(),
                row.model_name,
                row.record_id,
                row.record_identifier or "",
                row.ip_address or "",
                row.status,
                _flatten_json(row.old_values),
                _flatten_json(row.new_values),
                ", ".join(row.changed_fields or []),
                row.request_method or "",
                row.request_path or "",
                row.remarks or "",
            ])
            count += 1

        # Log the download itself — best-effort, never break the response.
        try:
            from .utils import log_download
            log_download(
                request,
                label=f"Audit log export ({count} rows)",
                file_kind="csv",
                extra={"rows": count, "filters": dict(request.query_params.lists())},
            )
        except Exception:
            pass

        return response

    @action(detail=False, methods=["get"], url_path="filters")
    def filter_options(self, request):
        """Distinct values used by the viewer UI to populate filter dropdowns."""
        users = list(
            AuditLog.objects.order_by("user")
            .values_list("user", flat=True)
            .distinct()[:500]
        )
        models = list(
            AuditLog.objects.order_by("model_name")
            .values_list("model_name", flat=True)
            .distinct()[:200]
        )
        return Response({
            "users": users,
            "models": models,
            "actions": [
                {"value": key, "label": label}
                for key, label in AuditLog.ACTION_CHOICES
            ],
        })


def _flatten_json(value) -> str:
    """Compact one-line representation for CSV cells."""
    if not value:
        return ""
    if isinstance(value, dict):
        return "; ".join(f"{k}={v}" for k, v in value.items())
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value)


# ---------------------------------------------------------------------------
# User activity summary
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_activity(request):
    """Any authenticated user can see their own activity summary."""
    return Response(_jsonify_summary(user_activity_summary(request.user)))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAuditViewer])
def user_activity(request, username: str):
    return Response(_jsonify_summary(user_activity_summary(username)))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAuditViewer])
def users_activity_panel(request):
    try:
        limit = int(request.query_params.get("limit") or 25)
    except ValueError:
        limit = 25
    limit = max(1, min(limit, 200))
    rows = all_users_activity_summary(limit=limit)
    return Response([_jsonify_summary(r) for r in rows])


def _jsonify_summary(summary: dict) -> dict:
    """Convert datetimes to isoformat for the API response."""
    out = dict(summary)
    if out.get("last_login"):
        out["last_login"] = out["last_login"].isoformat()
    if out.get("recent_actions"):
        out["recent_actions"] = [
            {**r, "timestamp": r["timestamp"].isoformat() if r.get("timestamp") else None}
            for r in out["recent_actions"]
        ]
    return out


# ---------------------------------------------------------------------------
# Suspicious activity
# ---------------------------------------------------------------------------

class SuspiciousActivityViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAuditViewer]
    serializer_class = SuspiciousActivitySerializer
    queryset = SuspiciousActivity.objects.all()

    def get_queryset(self):
        qs = SuspiciousActivity.objects.all()
        status_param = (self.request.query_params.get("status") or "open").lower()
        if status_param == "open":
            qs = qs.filter(is_acknowledged=False)
        elif status_param == "ack":
            qs = qs.filter(is_acknowledged=True)
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)
        return qs.order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="ack")
    def acknowledge(self, request, pk=None):
        try:
            obj = SuspiciousActivity.objects.get(pk=pk)
        except SuspiciousActivity.DoesNotExist:
            raise Http404
        if not obj.is_acknowledged:
            obj.is_acknowledged = True
            obj.acknowledged_by = request.user.username
            obj.acknowledged_at = timezone.now()
            obj.save(update_fields=["is_acknowledged", "acknowledged_by", "acknowledged_at"])
        return Response(SuspiciousActivitySerializer(obj).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Recent login attempts (raw)
# ---------------------------------------------------------------------------

class LoginAttemptViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAuditViewer]
    serializer_class = LoginAttemptSerializer

    def get_queryset(self):
        qs = LoginAttempt.objects.all().order_by("-timestamp")
        only = self.request.query_params.get("only")
        if only == "failed":
            qs = qs.filter(success=False)
        elif only == "success":
            qs = qs.filter(success=True)
        since_h = self.request.query_params.get("since_hours")
        if since_h and since_h.isdigit():
            qs = qs.filter(timestamp__gte=timezone.now() - timedelta(hours=int(since_h)))
        username = self.request.query_params.get("username")
        if username:
            qs = qs.filter(username_tried__iexact=username)
        return qs
