from rest_framework import serializers

from .models import AuditLog, LoginAttempt, SuspiciousActivity, UserKnownIP


class AuditLogListSerializer(serializers.ModelSerializer):
    """Compact row used by the audit table view."""
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    changes_summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "timestamp",
            "user",
            "user_email",
            "action",
            "action_display",
            "model_name",
            "record_id",
            "record_identifier",
            "ip_address",
            "status",
            "changes_summary",
        )
        read_only_fields = fields

    def get_changes_summary(self, obj):
        try:
            return obj.get_changes_summary()
        except Exception:
            return ""


class AuditLogDetailSerializer(serializers.ModelSerializer):
    """Full row for the expandable detail panel."""
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    changes_summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "timestamp",
            "user",
            "user_email",
            "action",
            "action_display",
            "model_name",
            "record_id",
            "record_identifier",
            "old_values",
            "new_values",
            "changed_fields",
            "changes_summary",
            "ip_address",
            "user_agent",
            "request_method",
            "request_path",
            "remarks",
            "status",
            "error_message",
        )
        read_only_fields = fields

    def get_changes_summary(self, obj):
        try:
            return obj.get_changes_summary()
        except Exception:
            return ""


class SuspiciousActivitySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)

    class Meta:
        model = SuspiciousActivity
        fields = (
            "id",
            "kind",
            "kind_display",
            "severity",
            "severity_display",
            "username",
            "ip_address",
            "description",
            "details",
            "is_acknowledged",
            "acknowledged_by",
            "acknowledged_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "kind",
            "kind_display",
            "severity",
            "severity_display",
            "username",
            "ip_address",
            "description",
            "details",
            "acknowledged_by",
            "acknowledged_at",
            "created_at",
        )


class LoginAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginAttempt
        fields = (
            "id",
            "timestamp",
            "username_tried",
            "success",
            "failure_reason",
            "ip_address",
            "user_agent",
        )


class UserKnownIPSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserKnownIP
        fields = (
            "id",
            "user",
            "ip_address",
            "first_seen",
            "last_seen",
            "login_count",
        )
