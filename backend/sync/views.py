"""Offline-sync API endpoints.

    GET  /api/sync/pull/?since=<iso8601>   -> rows changed since `since` (incl. tombstones)
    POST /api/sync/push/                   -> apply client changes (LWW, through save())

See docs/OFFLINE_FIRST_ARCHITECTURE.md.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .engine import apply_row, serialize_row, _parse_dt
from .registry import SPECS, SPECS_BY_KEY

# Roles allowed to push writes (mirrors RoleBasedReadWrite write rule).
WRITE_ROLES = {"super_admin", "admin_staff"}


def _can_write(user) -> bool:
    return bool(user and (user.is_superuser or getattr(user, "role", None) in WRITE_ROLES))


class SyncPullView(APIView):
    """Return every synced row changed since the client's last sync.

    ``since`` is the ``server_time`` the client received on its previous pull.
    Omit it for a full initial hydration. Tombstoned rows are included so the
    client can delete them locally.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since = _parse_dt(request.query_params.get("since"))
        server_time = timezone.now()

        changes = {}
        for spec in SPECS:
            qs = spec.model.objects.all()
            # serialize_row reads every FK (as <fk>_uuid); without select_related
            # that's one extra query per FK per row (~4 x N for staff), which
            # over the network to Neon times the request out on any sizeable
            # result set (full initial pull, or a busy day's delta) -> 502.
            if spec.fk_fields:
                qs = qs.select_related(*spec.fk_fields.keys())
            if since:
                qs = qs.filter(updated_at__gt=since)
            changes[spec.key] = [serialize_row(spec, obj) for obj in qs.iterator()]

        return Response({"server_time": server_time, "changes": changes})


class SyncPushView(APIView):
    """Apply a batch of client changes.

    Body: ``{"changes": {"<model_key>": [ {uuid, updated_at, ...fields, _deleted?}, ... ]}}``
    Each row is applied in its own transaction so one bad row doesn't abort the
    batch. Returns per-model ``accepted`` / ``conflicts`` / ``errors`` uuid lists.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _can_write(request.user):
            return Response(
                {"detail": "Your role is not permitted to push changes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payload = request.data.get("changes") or {}
        if not isinstance(payload, dict):
            return Response(
                {"detail": "'changes' must be an object keyed by model."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = {}
        for key, rows in payload.items():
            spec = SPECS_BY_KEY.get(key)
            if spec is None:
                results[key] = {"error": "unknown model"}
                continue
            if not spec.writable:
                results[key] = {"error": "model is read-only"}
                continue
            if not isinstance(rows, list):
                results[key] = {"error": "expected a list of rows"}
                continue

            accepted, conflicts, errors = [], [], []
            for row in rows:
                row_uuid = row.get("uuid") if isinstance(row, dict) else None
                try:
                    with transaction.atomic():
                        outcome = apply_row(spec, row, request.user)
                    (accepted if outcome == "applied" else conflicts).append(row_uuid)
                except Exception as exc:  # report, keep processing the batch
                    errors.append({"uuid": row_uuid, "error": str(exc)})
            results[key] = {"accepted": accepted, "conflicts": conflicts, "errors": errors}

        return Response({"server_time": timezone.now(), "results": results})
