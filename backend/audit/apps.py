from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "audit"
    verbose_name = "Audit Trail"

    def ready(self):
        # Import signal handlers (login/logout/failed-login + view-threshold).
        from . import signals  # noqa: F401

        # Wire the django-auditlog LogEntry → AuditLog mirror.
        signals.connect_auditlog_mirror()

        # Register domain models with django-auditlog.
        from . import auditlog_registry
        auditlog_registry.register_all()
