import secrets
import string

from rest_framework import serializers

from .models import User


def make_password_meeting_policy(length: int = 12) -> str:
    """Generate a random password that passes StrongPasswordValidator.

    Guarantees ≥1 uppercase, ≥1 digit, ≥1 symbol from a safe set, and the
    requested length (default 12). Replaces Django's removed
    ``UserManager.make_random_password`` (Django 5.1+).
    """
    if length < 10:
        length = 10
    must = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*?-_"),
    ]
    pool = string.ascii_letters + string.digits + "!@#$%^&*?-_"
    rest = [secrets.choice(pool) for _ in range(length - len(must))]
    chars = must + rest
    for i in range(len(chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        chars[i], chars[j] = chars[j], chars[i]
    return "".join(chars)


class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    full_name = serializers.SerializerMethodField()
    last_login_iso = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "phone",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login_iso",
            "permissions_override",
            "permissions",
        )
        read_only_fields = ("id", "date_joined", "is_staff", "last_login_iso")

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_permissions(self, obj):
        return obj.resolved_permissions()

    def validate_permissions_override(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("permissions_override must be an object")
        allowed = set(User.PERMISSION_KEYS) | {"can_write"}
        cleaned = {}
        for k, v in value.items():
            if k not in allowed:
                raise serializers.ValidationError(f"Unknown permission key: {k}")
            cleaned[k] = bool(v)
        return cleaned


class UserCreateSerializer(UserSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("password",)

    def create(self, validated_data):
        password = validated_data.pop("password", None) or make_password_meeting_policy(12)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        # Stash the (possibly auto-generated) password on the serializer so the
        # response can surface it to the super admin once at creation time.
        self._generated_password = password
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(self, "_generated_password"):
            data["initial_password"] = self._generated_password
        return data
