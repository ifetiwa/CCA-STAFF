from django.db import models

from accounts.models import User


class Notification(models.Model):
    """In-app notification targeted at a role.

    A single row is visible to every user holding ``recipient_role`` (or to
    every authenticated user when the role is the wildcard ``"*"``). The
    ``is_read`` flag is shared by everyone who can see the row — matching the
    field-set requested in the product spec.
    """

    class Type(models.TextChoices):
        PROMOTION_DUE = "promotion_due", "Promotion due"
        RETIREMENT_SOON = "retirement_soon", "Retirement soon"
        RECORD_UPDATED = "record_updated", "Record updated"

    # Use User.Role values, plus "*" for "any authenticated user".
    ROLE_ALL = "*"
    RECIPIENT_ROLE_CHOICES = [
        (ROLE_ALL, "All roles"),
        *User.Role.choices,
    ]

    recipient_role = models.CharField(
        max_length=20,
        choices=RECIPIENT_ROLE_CHOICES,
        default=ROLE_ALL,
        db_index=True,
    )
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        db_index=True,
    )
    staff_member = models.ForeignKey(
        "staff.Staff",
        on_delete=models.CASCADE,
        related_name="role_notifications",
        null=True,
        blank=True,
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Optional idempotency key — set for auto-generated notifications so the
    # daily job doesn't pile up duplicates. NULL on ad-hoc rows.
    dedupe_key = models.CharField(max_length=120, blank=True, null=True, unique=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient_role", "is_read", "-created_at"]),
            models.Index(fields=["type", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"[{self.recipient_role}/{self.type}] {self.message[:50]}"
