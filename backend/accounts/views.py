"""Authentication endpoints and the 403 access-denied page."""
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from rest_framework.decorators import action

from . import lockout
from .models import LoginActivity, User
from .permissions import IsSuperAdmin
from .serializers import UserCreateSerializer, UserSerializer
from .sessions import terminate_other_sessions


def _record_login_activity(request, user, *, success: bool, reason: str = "") -> None:
    """Persist a row used by the Super Admin Login Activity tab."""
    if user is None:
        return
    try:
        LoginActivity.objects.create(
            user=user,
            ip_address=lockout.client_ip(request) or None,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:1024],
            success=success,
            failure_reason=reason[:255],
        )
    except Exception:
        # Logging the login should never break the login flow.
        pass


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name(),
        "role": user.role,
        "role_display": user.get_role_display(),
        "is_active": user.is_active,
        "permissions": user.resolved_permissions(),
        "permissions_override": user.permissions_override or {},
        "force_password_change": getattr(user, "force_password_change", False),
    }


@csrf_exempt
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Authenticate with username (or email) + password.

    Returns the DRF auth token, user profile, and resolved role permissions
    so the React client can mount role-aware UI immediately.
    """
    identifier = request.data.get("username") or request.data.get("email")
    password = request.data.get("password")
    if not identifier or not password:
        return Response(
            {"detail": "Username/email and password are required."}, status=400
        )

    ip = lockout.client_ip(request)
    if lockout.is_locked(identifier, ip):
        remaining = lockout.lockout_remaining(identifier, ip)
        minutes = max(1, remaining // 60)
        return Response(
            {
                "detail": (
                    f"Account temporarily locked due to repeated failed logins. "
                    f"Try again in {minutes} minute(s)."
                )
            },
            status=423,
        )

    user = authenticate(request, username=identifier, password=password)
    if user is None:
        # Fall back to email lookup → re-authenticate by resolved username.
        try:
            candidate = User.objects.get(email__iexact=identifier)
        except User.DoesNotExist:
            candidate = None
        if candidate is not None:
            user = authenticate(
                request, username=candidate.username, password=password
            )

    if user is None or not user.is_active:
        lockout.record_failure(identifier, ip)
        remaining = lockout.attempts_remaining(identifier, ip)
        detail = "Invalid credentials."
        if remaining and remaining <= 2:
            detail = (
                f"Invalid credentials. {remaining} attempt(s) remaining before "
                "the account is locked."
            )
        # Record the failure when we can match it to an existing user.
        target = user
        if target is None:
            target = (
                User.objects.filter(username__iexact=identifier).first()
                or User.objects.filter(email__iexact=identifier).first()
            )
        _record_login_activity(
            request,
            target,
            success=False,
            reason="inactive account" if (target and not target.is_active) else "invalid credentials",
        )
        return Response({"detail": detail}, status=401)

    # Successful auth: clear the failure counter and rotate to a single session.
    lockout.clear(identifier, ip)
    _record_login_activity(request, user, success=True)

    # Drop any existing DRF tokens so an earlier device is signed out.
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)

    login(request, user)  # rotates the session key
    request.session["last_activity"] = timezone.now().isoformat()
    terminate_other_sessions(user, keep_session_key=request.session.session_key)

    return Response({"token": token.key, "user": _user_payload(user)})


@api_view(["POST"])
def logout_view(request):
    """Invalidate the DRF token and tear down the Django session."""
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
        logout(request)
    return Response({"detail": "Signed out."})


@api_view(["GET"])
def me_view(request):
    """Return the current user's profile + resolved capabilities."""
    return Response(_user_payload(request.user))


def access_denied_view(request, exception=None):
    """403 handler. JSON for API paths, branded HTML otherwise."""
    accepts_json = (
        request.path.startswith("/api/")
        or "application/json" in request.META.get("HTTP_ACCEPT", "")
    )
    if accepts_json:
        return Response(
            {"detail": "Access denied. You do not have permission for this action."},
            status=403,
        ).render()
    return render(
        request,
        "accounts/access_denied.html",
        {"user": request.user if request.user.is_authenticated else None},
        status=403,
    )


class UserViewSet(viewsets.ModelViewSet):
    """Super-Admin user management.

    * GET    /api/accounts/users/                 — list
    * POST   /api/accounts/users/                 — create (returns initial_password)
    * GET    /api/accounts/users/{id}/            — retrieve
    * PATCH  /api/accounts/users/{id}/            — update fields (role, permissions_override, is_active, …)
    * DELETE /api/accounts/users/{id}/            — delete
    * POST   /api/accounts/users/{id}/reset-password/ — issue a new random password
    """

    queryset = User.objects.all().order_by("username")
    permission_classes = [IsSuperAdmin]
    search_fields = ["username", "email", "first_name", "last_name"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        from .serializers import make_password_meeting_policy
        user = self.get_object()
        new_password = make_password_meeting_policy(12)
        user.set_password(new_password)
        user.force_password_change = True
        user.save(update_fields=["password", "force_password_change"])
        # Invalidate any existing DRF token.
        Token.objects.filter(user=user).delete()
        return Response({"detail": "Password reset.", "new_password": new_password})
