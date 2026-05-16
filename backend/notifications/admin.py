from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "recipient_role", "staff_member", "is_read", "created_at")
    list_filter = ("type", "recipient_role", "is_read")
    search_fields = ("message", "staff_member__staff_id", "staff_member__first_name", "staff_member__last_name")
    readonly_fields = ("created_at", "dedupe_key")
    ordering = ("-created_at",)
