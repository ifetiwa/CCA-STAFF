"""Single-active-session enforcement.

On successful login we delete every other session row belonging to the
authenticated user. This is done by scanning ``django_session`` directly
because Django doesn't index by user out of the box, but the table is
small (one row per active session) so the cost is negligible.

DRF tokens are intentionally untouched — they identify a device, not a
browser session. The concurrent-session rule applies to interactive
session-cookie auth (admin + SPA cookie flows).
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.utils import timezone

User = get_user_model()


def terminate_other_sessions(user, keep_session_key: str | None) -> int:
    """Delete every active session for ``user`` except ``keep_session_key``.

    Returns the number of sessions removed.
    """
    if user is None or not user.is_authenticated:
        return 0
    user_id_str = str(user.pk)
    removed = 0
    qs = Session.objects.filter(expire_date__gt=timezone.now())
    for sess in qs.iterator():
        if sess.session_key == keep_session_key:
            continue
        data = sess.get_decoded()
        if data.get("_auth_user_id") == user_id_str:
            sess.delete()
            removed += 1
    return removed
