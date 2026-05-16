"""Forms used by the super-admin user management panel."""
from __future__ import annotations

import secrets
import string

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()


def generate_temporary_password(length: int = 12) -> str:
    """Cryptographically random temp password without ambiguous quote chars."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+?"
    return "".join(secrets.choice(alphabet) for _ in range(length))


_BASE_INPUT = {"class": "form-control"}


class CreateUserForm(forms.ModelForm):
    """Create a new user; password is auto-generated and shown once."""

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email", "role", "phone")
        widgets = {
            "username": forms.TextInput(attrs=_BASE_INPUT),
            "first_name": forms.TextInput(attrs=_BASE_INPUT),
            "last_name": forms.TextInput(attrs=_BASE_INPUT),
            "email": forms.EmailInput(attrs=_BASE_INPUT),
            "role": forms.Select(attrs=_BASE_INPUT),
            "phone": forms.TextInput(attrs=_BASE_INPUT),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in ("first_name", "last_name", "email", "role"):
            self.fields[field].required = True

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError("Username already exists.")
        return username

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("Email already in use.")
        return email

    def save(self, commit: bool = True):
        user = super().save(commit=False)
        user.email = user.email.lower()
        temp_password = generate_temporary_password()
        user.set_password(temp_password)
        user.force_password_change = True
        if commit:
            user.save()
        # Stash on the instance so the view can show / email it once.
        user.temp_password = temp_password
        return user


class EditUserForm(forms.ModelForm):
    """Edit role, profile and active flag. Username is immutable here."""

    class Meta:
        model = User
        fields = ("first_name", "last_name", "email", "role", "phone", "is_active")
        widgets = {
            "first_name": forms.TextInput(attrs=_BASE_INPUT),
            "last_name": forms.TextInput(attrs=_BASE_INPUT),
            "email": forms.EmailInput(attrs=_BASE_INPUT),
            "role": forms.Select(attrs=_BASE_INPUT),
            "phone": forms.TextInput(attrs=_BASE_INPUT),
            "is_active": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if (
            User.objects.filter(email__iexact=email)
            .exclude(pk=self.instance.pk)
            .exists()
        ):
            raise ValidationError("Email already in use.")
        return email

    def save(self, commit: bool = True):
        user = super().save(commit=False)
        user.email = user.email.lower()
        if commit:
            user.save()
        return user


class ResetPasswordForm(forms.Form):
    """Reset a user's password — auto-generate or provide a custom one."""

    custom_password = forms.CharField(
        required=False,
        max_length=128,
        widget=forms.PasswordInput(
            attrs={"class": "form-control", "placeholder": "Leave blank to auto-generate"}
        ),
        label="Custom password (optional)",
    )
    force_change_on_login = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"}),
        label="Force password change on next login",
    )
    send_to_email = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"}),
        label="Email the new password to the user",
    )

    def clean_custom_password(self):
        pw = (self.cleaned_data.get("custom_password") or "").strip()
        if pw:
            try:
                validate_password(pw)
            except ValidationError as exc:
                raise ValidationError(exc.messages)
        return pw


class ChangePasswordOnFirstLoginForm(forms.Form):
    """Self-service form a user fills when force_password_change is set."""

    new_password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control", "autocomplete": "new-password"}),
        label="New password",
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control", "autocomplete": "new-password"}),
        label="Confirm new password",
    )

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._user = user

    def clean_new_password(self):
        pw = self.cleaned_data["new_password"]
        validate_password(pw, user=self._user)
        return pw

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("new_password") and cleaned.get("confirm_password"):
            if cleaned["new_password"] != cleaned["confirm_password"]:
                raise ValidationError("The two passwords do not match.")
        return cleaned
