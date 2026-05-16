"""Permissions for the audit trail viewer.

The audit log is restricted to Admin Staff and Chief Registrar (per the
``User.AUDIT_ROLES`` set on the custom user model) — and superusers.
"""
from rest_framework.permissions import BasePermission


class IsAuditViewer(BasePermission):
    message = "Audit logs are restricted to Admin Staff and Chief Registrar."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return getattr(user, "can_view_audit", False)
