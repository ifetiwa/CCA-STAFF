"""Super-admin user management HTML views.

These views serve a small server-rendered panel and are gated behind a
``user_passes_test`` check that only allows superusers in. They are
deliberately kept separate from ``views.py`` (which hosts the JSON
authentication endpoints for the React SPA).
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_http_methods

from .management_forms import (
    CreateUserForm,
    EditUserForm,
    ResetPasswordForm,
    generate_temporary_password,
)
from .models import LoginActivity, User

logger = logging.getLogger(__name__)


def _is_superadmin(user) -> bool:
    return bool(user.is_authenticated and user.is_superuser)


_superadmin_required = user_passes_test(_is_superadmin, login_url="accounts:access-denied")


def _client_ip(request: HttpRequest) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _send_credentials_email(
    request: HttpRequest, user: User, password: str, *, reset: bool = False
) -> bool:
    """Render and send the new-credentials / password-reset email.

    Returns True on success, False on any failure (logged).
    """
    template = (
        "accounts/emails/password_reset.html"
        if reset
        else "accounts/emails/new_user_credentials.html"
    )
    subject = (
        "Your CCA Biodata password has been reset"
        if reset
        else "Your CCA Biodata account has been created"
    )
    try:
        html_body = render_to_string(
            template,
            {
                "user": user,
                "password": password,
                "login_url": request.build_absolute_uri(reverse("accounts:login")),
            },
        )
        plain_body = (
            f"Hello {user.get_full_name() or user.username},\n\n"
            f"{'Your password has been reset.' if reset else 'An account has been created for you.'}\n"
            f"Username: {user.username}\n"
            f"{'New password' if reset else 'Temporary password'}: {password}\n\n"
            "You will be required to change this password the next time you sign in.\n"
        )
        send_mail(
            subject=subject,
            message=plain_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_body,
            fail_silently=False,
        )
        return True
    except Exception as exc:  # noqa: BLE001 - log everything, never crash the view
        logger.error("Failed to send credential email to %s: %s", user.email, exc)
        return False


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------
@login_required
@_superadmin_required
@require_http_methods(["GET"])
def user_list(request: HttpRequest) -> HttpResponse:
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status", "")
    role_filter = request.GET.get("role", "")

    qs = User.objects.all()
    if q:
        qs = qs.filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(email__icontains=q)
        )
    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False)
    if role_filter:
        qs = qs.filter(role=role_filter)

    qs = qs.order_by("-date_joined")
    paginator = Paginator(qs, 25)
    page = paginator.get_page(request.GET.get("page"))

    context = {
        "page_obj": page,
        "q": q,
        "status": status,
        "role_filter": role_filter,
        "role_choices": User.Role.choices,
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "inactive_users": User.objects.filter(is_active=False).count(),
    }
    return render(request, "accounts/management/user_list.html", context)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
@login_required
@_superadmin_required
def user_create(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = CreateUserForm(request.POST)
        if form.is_valid():
            user = form.save()
            temp_password = user.temp_password
            send_email = request.POST.get("send_email") == "on"
            email_sent = False
            if send_email:
                email_sent = _send_credentials_email(request, user, temp_password)

            context = {
                "created_user": user,
                "temp_password": temp_password,
                "email_sent": email_sent,
                "email_requested": send_email,
            }
            return render(request, "accounts/management/user_created.html", context)
    else:
        form = CreateUserForm()

    return render(request, "accounts/management/user_form.html", {"form": form})


# ---------------------------------------------------------------------------
# Edit (with three tabs: profile, password reset, login history)
# ---------------------------------------------------------------------------
@login_required
@_superadmin_required
def user_edit(request: HttpRequest, user_id: int) -> HttpResponse:
    target = get_object_or_404(User, pk=user_id)
    login_history = (
        LoginActivity.objects.filter(user=target)
        .order_by("-login_timestamp")[:10]
    )

    form = EditUserForm(instance=target)
    reset_form = ResetPasswordForm()
    new_password_to_show: str | None = None

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "edit":
            form = EditUserForm(request.POST, instance=target)
            if form.is_valid():
                form.save()
                messages.success(request, "User updated.")
                return redirect("accounts_html:user_edit", user_id=target.pk)

        elif action == "reset_password":
            reset_form = ResetPasswordForm(request.POST)
            if reset_form.is_valid():
                custom = reset_form.cleaned_data.get("custom_password") or ""
                new_password = custom if custom else generate_temporary_password()
                target.set_password(new_password)
                target.force_password_change = bool(
                    reset_form.cleaned_data.get("force_change_on_login")
                )
                target.save(update_fields=["password", "force_password_change"])
                new_password_to_show = new_password

                if reset_form.cleaned_data.get("send_to_email"):
                    sent = _send_credentials_email(
                        request, target, new_password, reset=True
                    )
                    if sent:
                        messages.success(request, "Password reset; email sent.")
                    else:
                        messages.warning(
                            request, "Password reset, but the email failed to send."
                        )
                else:
                    messages.success(request, "Password reset.")

        elif action == "deactivate":
            target.is_active = False
            target.save(update_fields=["is_active"])
            messages.success(request, "User deactivated.")
            return redirect("accounts_html:user_edit", user_id=target.pk)

        elif action == "activate":
            target.is_active = True
            target.save(update_fields=["is_active"])
            messages.success(request, "User reactivated.")
            return redirect("accounts_html:user_edit", user_id=target.pk)

    context = {
        "target": target,
        "form": form,
        "reset_form": reset_form,
        "login_history": login_history,
        "new_password_to_show": new_password_to_show,
    }
    return render(request, "accounts/management/user_edit.html", context)


# ---------------------------------------------------------------------------
# Deactivate (confirmation page; POST flips the flag and preserves data)
# ---------------------------------------------------------------------------
@login_required
@_superadmin_required
def user_deactivate(request: HttpRequest, user_id: int) -> HttpResponse:
    target = get_object_or_404(User, pk=user_id)

    if target.pk == request.user.pk:
        messages.error(request, "You cannot deactivate your own account.")
        return redirect("accounts_html:user_edit", user_id=target.pk)

    if request.method == "POST":
        target.is_active = False
        target.save(update_fields=["is_active"])
        messages.success(
            request,
            f"{target.username} has been deactivated. Their data and audit trail are preserved.",
        )
        return redirect("accounts_html:user_list")

    return render(
        request,
        "accounts/management/user_deactivate_confirm.html",
        {"target": target},
    )
