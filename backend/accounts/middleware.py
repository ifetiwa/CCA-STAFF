"""Security middleware: inactivity timeout + Content-Security-Policy.

For session-authenticated requests (Django admin, DRF SessionAuthentication
used by the SPA when cookies are sent), ``SessionTimeoutMiddleware`` tracks
the last activity timestamp on the session and signs the user out if the
gap exceeds ``SESSION_INACTIVITY_TIMEOUT``.

Pure token-authenticated requests do not maintain a session and are not
affected here — that case should be handled client-side (the React
``AuthProvider`` already manages its own token lifecycle).

``ContentSecurityPolicyMiddleware`` attaches a CSP header to every response,
along with a few other defensive headers that Django doesn't ship enabled.
"""
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth import logout
from django.http import JsonResponse
from django.utils import timezone

SESSION_KEY = "last_activity"


def _get_timeout() -> timedelta:
    raw = getattr(settings, "SESSION_INACTIVITY_TIMEOUT", timedelta(minutes=30))
    if isinstance(raw, (int, float)):
        return timedelta(seconds=raw)
    return raw


def _parse(stamp: str):
    try:
        return datetime.fromisoformat(stamp)
    except (TypeError, ValueError):
        return None


class SessionTimeoutMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.timeout = _get_timeout()

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and hasattr(request, "session"):
            now = timezone.now()
            last_seen = _parse(request.session.get(SESSION_KEY, ""))
            if last_seen is not None and (now - last_seen) > self.timeout:
                logout(request)
                if request.path.startswith("/api/"):
                    return JsonResponse(
                        {"detail": "Session expired due to inactivity."}, status=401
                    )
            else:
                # First request or still within the window — refresh the stamp.
                request.session[SESSION_KEY] = now.isoformat()
        return self.get_response(request)


DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none';"
)


class ContentSecurityPolicyMiddleware:
    """Adds a Content-Security-Policy plus a few related headers.

    Override the policy by setting ``CONTENT_SECURITY_POLICY`` in settings.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.policy = getattr(settings, "CONTENT_SECURITY_POLICY", DEFAULT_CSP)

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.policy)
        response.setdefault("Referrer-Policy", "same-origin")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        return response
