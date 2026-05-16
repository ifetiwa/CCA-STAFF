"""Custom password validators enforcing the project security policy.

Policy: minimum 10 characters, at least one uppercase letter, one digit,
and one symbol (non-alphanumeric).
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")


class StrongPasswordValidator:
    """Enforce uppercase + digit + symbol on top of Django's length validator."""

    def __init__(self, min_length: int = 10):
        self.min_length = min_length

    def validate(self, password, user=None):
        errors = []
        if len(password) < self.min_length:
            errors.append(
                _("Password must be at least %(min)d characters long.")
                % {"min": self.min_length}
            )
        if not any(c.isupper() for c in password):
            errors.append(_("Password must contain at least one uppercase letter."))
        if not any(c.isdigit() for c in password):
            errors.append(_("Password must contain at least one digit."))
        if not SYMBOL_RE.search(password):
            errors.append(
                _("Password must contain at least one symbol (e.g. !@#$%%^&*).")
            )
        if errors:
            raise ValidationError(errors, code="password_not_strong")

    def get_help_text(self):
        return _(
            "Your password must be at least %(min)d characters long and contain at "
            "least one uppercase letter, one digit, and one symbol."
        ) % {"min": self.min_length}
