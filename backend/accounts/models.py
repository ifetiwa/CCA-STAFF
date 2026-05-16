from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user for the CCA Staff Biodata Management System.

    Four operational roles drive access control:
      * Admin Staff    — full read/write
      * Director       — read-only
      * Chief Registrar — read-only + export
      * President      — dashboard + read-only
    """

    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        ADMIN_STAFF = "admin_staff", "Admin Staff"
        DIRECTOR = "director", "Director"
        CHIEF_REGISTRAR = "chief_registrar", "Chief Registrar"
        PRESIDENT = "president", "President"

    # Capability sets — single source of truth used by permissions module.
    WRITE_ROLES = {Role.SUPER_ADMIN, Role.ADMIN_STAFF}
    EXPORT_ROLES = {Role.SUPER_ADMIN, Role.ADMIN_STAFF, Role.CHIEF_REGISTRAR}
    DASHBOARD_ROLES = {
        Role.SUPER_ADMIN,
        Role.ADMIN_STAFF,
        Role.DIRECTOR,
        Role.CHIEF_REGISTRAR,
        Role.PRESIDENT,
    }
    AUDIT_ROLES = {Role.SUPER_ADMIN, Role.ADMIN_STAFF, Role.CHIEF_REGISTRAR}
    MANAGE_USERS_ROLES = {Role.SUPER_ADMIN}

    # Granular permission keys super admin can override on a per-user basis.
    # Each key maps to a default derived from the user's role; the override
    # column lets super admin pin a value (True/False) per user.
    PERMISSION_KEYS = [
        "can_view_dashboard",
        "can_view_staff",
        "can_create_staff",
        "can_edit_staff",
        "can_delete_staff",
        "can_view_reports",
        "can_export",
        "can_view_audit",
        "can_view_records",
        "can_manage_users",
        "can_manage_settings",
        "can_view_notifications",
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ADMIN_STAFF,
    )
    phone = models.CharField(max_length=20, blank=True)
    force_password_change = models.BooleanField(
        default=False,
        help_text="Force user to set a new password on next login.",
    )
    permissions_override = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Per-user permission overrides set by the Super Admin. "
            "Keys are entries in User.PERMISSION_KEYS, values are True/False. "
            "Omitted keys fall back to the role-derived default."
        ),
    )

    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ("last_name", "first_name", "username")

    def __str__(self) -> str:
        full = self.get_full_name()
        return f"{full or self.username} ({self.get_role_display()})"

    # ---- Capability properties -------------------------------------------
    def _check(self, key: str, default: bool) -> bool:
        """Resolve a permission: super admin > override > role default."""
        if self.is_superuser or self.role == self.Role.SUPER_ADMIN:
            return True
        overrides = self.permissions_override or {}
        if key in overrides:
            return bool(overrides[key])
        return default

    @property
    def can_write(self) -> bool:
        return self._check("can_write", self.role in self.WRITE_ROLES)

    @property
    def can_export(self) -> bool:
        return self._check("can_export", self.role in self.EXPORT_ROLES)

    @property
    def can_view_dashboard(self) -> bool:
        return self._check("can_view_dashboard", self.role in self.DASHBOARD_ROLES)

    @property
    def can_view_audit(self) -> bool:
        return self._check("can_view_audit", self.role in self.AUDIT_ROLES)

    @property
    def can_manage_users(self) -> bool:
        return self.is_superuser or self.role in self.MANAGE_USERS_ROLES

    @property
    def is_read_only(self) -> bool:
        return not self.can_write

    def resolved_permissions(self) -> dict:
        """Final, override-aware permissions used by the React client."""
        write = self.can_write
        dash = self.can_view_dashboard
        return {
            "can_view_dashboard":    self._check("can_view_dashboard",    dash),
            "can_view_staff":        self._check("can_view_staff",        True),
            "can_create_staff":      self._check("can_create_staff",      write),
            "can_edit_staff":        self._check("can_edit_staff",        write),
            "can_delete_staff":      self._check("can_delete_staff",      self.role in {self.Role.SUPER_ADMIN, self.Role.ADMIN_STAFF}),
            "can_view_reports":      self._check("can_view_reports",      dash),
            "can_export":            self.can_export,
            "can_view_audit":        self.can_view_audit,
            "can_view_records":      self._check("can_view_records",      dash),
            "can_manage_users":      self.can_manage_users,
            "can_manage_settings":   self._check("can_manage_settings",   self.role in {self.Role.SUPER_ADMIN}),
            "can_view_notifications": self._check("can_view_notifications", True),
            "can_write":             write,
            "is_read_only":          not write,
        }

    def has_role(self, *roles) -> bool:
        """True if the user holds any of the given roles (str or Role members).

        Accepts short aliases (``'admin'``, ``'registrar'``) as well as the
        canonical values from :class:`Role` so view decorators stay readable.
        """
        if self.is_superuser:
            return True
        wanted = {self._normalize_role(r) for r in roles}
        return self.role in wanted

    # Short aliases accepted by ``@require_role([...])`` and ``has_role(...)``.
    ROLE_ALIASES = {
        "super_admin": Role.SUPER_ADMIN,
        "super": Role.SUPER_ADMIN,
        "admin": Role.ADMIN_STAFF,
        "admin_staff": Role.ADMIN_STAFF,
        "director": Role.DIRECTOR,
        "registrar": Role.CHIEF_REGISTRAR,
        "chief_registrar": Role.CHIEF_REGISTRAR,
        "president": Role.PRESIDENT,
    }

    @classmethod
    def _normalize_role(cls, role) -> str:
        key = str(role)
        return str(cls.ROLE_ALIASES.get(key, key))


class LoginActivity(models.Model):
    """Per-user login history surfaced in the Super Admin panel."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="login_history",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    login_timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    success = models.BooleanField(default=True)
    failure_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-login_timestamp"]
        indexes = [models.Index(fields=["user", "-login_timestamp"])]

    def __str__(self) -> str:
        status = "ok" if self.success else "fail"
        return f"{self.user.username} {status} @ {self.login_timestamp:%Y-%m-%d %H:%M}"
