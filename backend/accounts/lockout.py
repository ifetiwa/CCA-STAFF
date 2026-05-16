"""Cache-backed account lockout.

Tracks failed login attempts per (username, client IP). After
``MAX_FAILED_ATTEMPTS`` failures within the tracking window, the
identifier is locked out for ``LOCKOUT_DURATION_SECONDS`` seconds.

Cache is used (not DB) so this works on any Django-supported cache
backend without an extra migration. With the default LocMem cache
the lockout is per-process; for multi-worker production deployments,
configure a shared cache (Redis / Memcached).
"""
from __future__ import annotations

from django.conf import settings
from django.core.cache import cache

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 30 * 60  # 30 minutes
ATTEMPT_WINDOW_SECONDS = 30 * 60    # match lockout window so attempts age out


def _key(identifier: str, ip: str | None) -> str:
    ident = (identifier or "").strip().lower()
    ip_part = ip or "unknown"
    return f"login_attempts:{ident}:{ip_part}"


def _lock_key(identifier: str, ip: str | None) -> str:
    ident = (identifier or "").strip().lower()
    ip_part = ip or "unknown"
    return f"login_locked:{ident}:{ip_part}"


def client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def is_locked(identifier: str, ip: str) -> bool:
    return bool(cache.get(_lock_key(identifier, ip)))


def lockout_remaining(identifier: str, ip: str) -> int:
    """Return seconds remaining on a lockout, or 0 if not locked."""
    ttl = cache.ttl(_lock_key(identifier, ip)) if hasattr(cache, "ttl") else None
    if ttl is None:
        # Most cache backends don't expose ttl; fall back to a fixed advert.
        return LOCKOUT_DURATION_SECONDS if is_locked(identifier, ip) else 0
    return max(0, int(ttl))


def record_failure(identifier: str, ip: str) -> int:
    """Increment failure counter; lock account on threshold. Returns new count."""
    key = _key(identifier, ip)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, ATTEMPT_WINDOW_SECONDS)
        count = 1
    if count >= MAX_FAILED_ATTEMPTS:
        cache.set(_lock_key(identifier, ip), True, LOCKOUT_DURATION_SECONDS)
        cache.delete(key)
    return count


def clear(identifier: str, ip: str) -> None:
    cache.delete(_key(identifier, ip))
    cache.delete(_lock_key(identifier, ip))


def attempts_remaining(identifier: str, ip: str) -> int:
    count = cache.get(_key(identifier, ip), 0) or 0
    return max(0, MAX_FAILED_ATTEMPTS - count)
