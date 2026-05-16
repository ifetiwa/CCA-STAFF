from django.contrib import admin

from .models import (
    AuditLog,
    AuditLogArchive,
    AuditSettings,
    LoginAttempt,
    SuspiciousActivity,
    UserKnownIP,
)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp", "user", "action", "model_name", "record_id",
        "ip_address", "status",
    )
    list_filter = ("action", "status", "model_name")
    search_fields = (
        "user", "user_email", "record_identifier", "record_id", "ip_address",
    )
    date_hierarchy = "timestamp"
    readonly_fields = tuple(f.name for f in AuditLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "username_tried", "success", "ip_address", "failure_reason")
    list_filter = ("success",)
    search_fields = ("username_tried", "ip_address")
    date_hierarchy = "timestamp"
    readonly_fields = tuple(f.name for f in LoginAttempt._meta.fields)


@admin.register(UserKnownIP)
class UserKnownIPAdmin(admin.ModelAdmin):
    list_display = ("user", "ip_address", "first_seen", "last_seen", "login_count")
    search_fields = ("user__username", "ip_address")


@admin.register(SuspiciousActivity)
class SuspiciousActivityAdmin(admin.ModelAdmin):
    list_display = (
        "created_at", "kind", "severity", "username", "ip_address",
        "is_acknowledged",
    )
    list_filter = ("kind", "severity", "is_acknowledged")
    search_fields = ("username", "ip_address", "description")
    date_hierarchy = "created_at"
    actions = ["mark_acknowledged"]

    def mark_acknowledged(self, request, queryset):
        from django.utils import timezone
        queryset.filter(is_acknowledged=False).update(
            is_acknowledged=True,
            acknowledged_by=request.user.username,
            acknowledged_at=timezone.now(),
        )
    mark_acknowledged.short_description = "Mark selected alerts acknowledged"


@admin.register(AuditLogArchive)
class AuditLogArchiveAdmin(admin.ModelAdmin):
    list_display = ("archived_at", "user", "action", "model_name", "record_id")
    list_filter = ("action", "model_name")
    search_fields = ("user", "record_id", "record_identifier")


@admin.register(AuditSettings)
class AuditSettingsAdmin(admin.ModelAdmin):
    list_display = ("retention_days", "archive_old_logs", "log_all_views", "log_failed_logins")
