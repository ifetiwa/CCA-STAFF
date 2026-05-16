"""Force-password-change support.

When ``user.force_password_change`` is True the middleware bounces the
session-authenticated user to ``accounts:password_change_required`` on
every page load, except for the change form itself and a small allow-list
(logout, the change endpoint, static assets, API endpoints which use
token auth and are out of scope for this gate).
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import resolve, reverse

from .management_forms import ChangePasswordOnFirstLoginForm


ALLOW_PATH_PREFIXES = (
    "/static/",
    "/media/",
    "/api/",
    "/admin/",
)


class ForcePasswordChangeMiddleware:
    """Redirect users with ``force_password_change=True`` to the change form."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        if (
            user is not None
            and user.is_authenticated
            and getattr(user, "force_password_change", False)
        ):
            path = request.path
            if not any(path.startswith(p) for p in ALLOW_PATH_PREFIXES):
                try:
                    match = resolve(path)
                except Exception:
                    match = None
                allowed_names = {"password_change_required", "logout"}
                current_name = getattr(match, "url_name", None) if match else None
                if current_name not in allowed_names:
                    return redirect("accounts_html:password_change_required")
        return self.get_response(request)


@login_required
def password_change_required(request: HttpRequest) -> HttpResponse:
    """Force-password-change form shown after first login or admin reset."""
    if not request.user.force_password_change:
        return redirect("/")

    if request.method == "POST":
        form = ChangePasswordOnFirstLoginForm(request.POST, user=request.user)
        if form.is_valid():
            request.user.set_password(form.cleaned_data["new_password"])
            request.user.force_password_change = False
            request.user.save(update_fields=["password", "force_password_change"])
            # Keep the session valid after a password change.
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, request.user)
            return redirect("/")
    else:
        form = ChangePasswordOnFirstLoginForm(user=request.user)

    return render(
        request, "accounts/management/password_change_required.html", {"form": form}
    )
