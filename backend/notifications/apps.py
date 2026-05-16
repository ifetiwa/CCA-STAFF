from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
    verbose_name = "In-App Notifications"

    def ready(self):
        # Import signal handlers so they're registered at startup.
        from . import signals  # noqa: F401
