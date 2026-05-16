"""Convenience re-export of role-based view decorators.

The canonical implementation lives in :mod:`accounts.permissions`. This module
exists so callers can write the more conventional::

    from accounts.decorators import require_role

    @require_role(['admin', 'registrar'])
    def export_payroll(request): ...
"""
from .permissions import has_role, normalize_roles, require_role

__all__ = ["require_role", "has_role", "normalize_roles"]
