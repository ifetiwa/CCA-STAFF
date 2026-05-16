from datetime import datetime

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


def _visible_to(user):
    """Notifications the given user is allowed to see.

    A row is visible if its ``recipient_role`` matches the user's role or is
    the wildcard ``"*"``. Superusers see everything.
    """
    qs = Notification.objects.select_related("staff_member")
    if user.is_superuser:
        return qs
    user_role = getattr(user, "role", None) or ""
    return qs.filter(recipient_role__in=[Notification.ROLE_ALL, user_role])


class _DefaultPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    """List notifications visible to the current user.

    Query params:
      * ``type``       — filter by notification type
      * ``is_read``    — "true" / "false"
      * ``date_from``  — YYYY-MM-DD inclusive lower bound on created_at
      * ``date_to``    — YYYY-MM-DD inclusive upper bound on created_at
      * ``limit``      — when set, returns ``{"results": [...], "unread": N}``
                         instead of paginating (used by the bell dropdown).
    """
    qs = _visible_to(request.user)

    type_ = (request.GET.get("type") or "").strip()
    if type_:
        qs = qs.filter(type=type_)

    is_read = (request.GET.get("is_read") or "").strip().lower()
    if is_read in ("true", "1", "yes"):
        qs = qs.filter(is_read=True)
    elif is_read in ("false", "0", "no"):
        qs = qs.filter(is_read=False)

    date_from = parse_date(request.GET.get("date_from") or "")
    date_to = parse_date(request.GET.get("date_to") or "")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    limit_raw = (request.GET.get("limit") or "").strip()
    if limit_raw.isdigit():
        limit = max(1, min(int(limit_raw), 50))
        rows = list(qs.order_by("-created_at")[:limit])
        unread = _visible_to(request.user).filter(is_read=False).count()
        return Response({
            "results": NotificationSerializer(rows, many=True).data,
            "unread": unread,
        })

    paginator = _DefaultPagination()
    page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
    serializer = NotificationSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_count(request):
    n = _visible_to(request.user).filter(is_read=False).count()
    return Response({"unread": n})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_as_read(request, pk):
    notification = get_object_or_404(_visible_to(request.user), pk=pk)
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read"])
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_as_read(request):
    updated = _visible_to(request.user).filter(is_read=False).update(is_read=True)
    return Response({"updated": updated})
