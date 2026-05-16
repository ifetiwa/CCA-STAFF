from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    recipient_role_display = serializers.CharField(
        source="get_recipient_role_display", read_only=True
    )
    staff_member_id = serializers.IntegerField(read_only=True)
    staff_member_name = serializers.SerializerMethodField()
    staff_member_staff_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient_role",
            "recipient_role_display",
            "type",
            "type_display",
            "staff_member_id",
            "staff_member_name",
            "staff_member_staff_id",
            "message",
            "is_read",
            "created_at",
        ]
        read_only_fields = fields

    def get_staff_member_name(self, obj):
        if obj.staff_member_id and obj.staff_member:
            return obj.staff_member.get_full_name()
        return None

    def get_staff_member_staff_id(self, obj):
        if obj.staff_member_id and obj.staff_member:
            return obj.staff_member.staff_id
        return None
