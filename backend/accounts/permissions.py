"""Role-based access control primitives.

Provides three integration points:

* ``RoleRequiredMixin``  — for class-based Django views
* ``require_role``       — decorator for function-based views (Django or DRF)
* DRF ``BasePermission`` subclasses — for ViewSets / APIViews
"""
from __future__ import annotations

from functools import wraps
from typing import Iterable

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from rest_framework import permissions as drf_permissions

# ---------------------------------------------------------------------------
# Aliases — let callers write @require_role(['admin', 'registrar']) cleanly.
# ---------------------------------------------------------------------------
ROLE_ALIASES = {
    "super_admin": "super_admin",
    "super": "super_admin",
    "admin": "admin_staff",
    "admin_staff": "admin_staff",
    "director": "director",
    "registrar": "chief_registrar",
    "chief_registrar": "chief_registrar",
    "president": "president",
}


def normalize_roles(roles: Iterable[str]) -> set[str]:
    """Resolve role aliases to canonical role keys."""
    return {ROLE_ALIASES.get(str(r), str(r)) for r in roles}


# ---------------------------------------------------------------------------
# Deny helpers
# ---------------------------------------------------------------------------
def _wants_json(request) -> bool:
    if request.path.startswith("/api/"):
        return True
    return "application/json" in request.META.get("HTTP_ACCEPT", "")


def deny_response(request, message: str = "Access denied."):
    """Return a 403 — JSON for API requests, HTML redirect otherwise."""
    if _wants_json(request):
        return JsonResponse({"detail": message}, status=403)
    return redirect(reverse("accounts:access-denied"))


def _user_in_roles(user, allowed: set[str]) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return getattr(user, "role", None) in allowed


# ---------------------------------------------------------------------------
# Function-based view decorator
# ---------------------------------------------------------------------------
def require_role(roles: Iterable[str]):
    """Restrict a view to users with one of ``roles``.

    Usage::

        @require_role(['admin', 'registrar'])
        def export_payroll(request): ...
    """
    allowed = normalize_roles(roles)

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            user = getattr(request, "user", None)
            if not user or not user.is_authenticated:
                if _wants_json(request):
                    return JsonResponse(
                        {"detail": "Authentication required."}, status=401
                    )
                login_url = getattr(settings, "LOGIN_URL", "/api/accounts/login/")
                return redirect(login_url)
            if _user_in_roles(user, allowed):
                return view_func(request, *args, **kwargs)
            return deny_response(request)

        return _wrapped

    return decorator


# ---------------------------------------------------------------------------
# Class-based view mixin
# ---------------------------------------------------------------------------
class RoleRequiredMixin:
    """CBV mixin enforcing :pyattr:`required_roles` on dispatch.

    Set ``required_roles`` on the view class (list of role keys/aliases).
    Anonymous users are sent to the login URL; authenticated-but-unauthorised
    users get a 403 response (JSON for API paths, HTML redirect otherwise).
    """

    required_roles: list[str] = []

    def get_required_roles(self) -> set[str]:
        return normalize_roles(self.required_roles)

    def dispatch(self, request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            if _wants_json(request):
                return JsonResponse(
                    {"detail": "Authentication required."}, status=401
                )
            return redirect(getattr(settings, "LOGIN_URL", "/api/accounts/login/"))
        if not _user_in_roles(user, self.get_required_roles()):
            return deny_response(request)
        return super().dispatch(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# DRF permission classes
# ---------------------------------------------------------------------------
class _RolePermission(drf_permissions.BasePermission):
    allowed_roles: set[str] = set()
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        return _user_in_roles(request.user, self.allowed_roles)


class IsSuperAdmin(_RolePermission):
    allowed_roles = {"super_admin"}
    message = "Only the Super Admin may perform this action."


class IsAdminStaff(_RolePermission):
    allowed_roles = {"super_admin", "admin_staff"}


class IsDirector(_RolePermission):
    allowed_roles = {"director"}


class IsChiefRegistrar(_RolePermission):
    allowed_roles = {"chief_registrar"}


class IsPresident(_RolePermission):
    allowed_roles = {"president"}


class CanExport(_RolePermission):
    """Admin Staff or Chief Registrar."""

    allowed_roles = {"admin_staff", "chief_registrar"}
    message = "Your role is not permitted to export records."


class CanViewDashboard(_RolePermission):
    """All four operational roles see the dashboard."""

    allowed_roles = {"admin_staff", "director", "chief_registrar", "president"}


class RoleBasedReadWrite(drf_permissions.BasePermission):
    """Safe methods open to all authenticated users; writes require Admin Staff.

    Apply on most ViewSets; combine with ``IsAuthenticated`` in DEFAULT
    permissions or list explicitly on the ViewSet.
    """

    message = "Only Admin Staff may modify records."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in drf_permissions.SAFE_METHODS:
            return True
        if user.is_superuser:
            return True
        return getattr(user, "role", None) == "admin_staff"


def has_role(roles: Iterable[str]):
    """Factory: build a DRF permission class for an arbitrary role set.

    ``permission_classes = [has_role(['admin', 'registrar'])]``
    """
    resolved = normalize_roles(roles)

    class _Dyn(_RolePermission):
        allowed_roles = resolved

    _Dyn.__name__ = f"HasRole_{'_'.join(sorted(resolved))}"
    return _Dyn
