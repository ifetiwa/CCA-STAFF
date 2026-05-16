"""Signal handlers that auto-create notifications.

The ``record_updated`` notification fires whenever an existing Staff record is
saved (``created=False``). Newly-created staff don't trigger one — that would
spam the dropdown on every imported row.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from staff.models import Staff

from .models import Notification


@receiver(post_save, sender=Staff)
def staff_updated_notification(sender, instance: Staff, created: bool, **kwargs):
    if created:
        return
    actor = getattr(instance, "updated_by", None) or "system"
    Notification.objects.create(
        recipient_role=Notification.ROLE_ALL,
        type=Notification.Type.RECORD_UPDATED,
        staff_member=instance,
        message=(
            f"Record for {instance.get_full_name()} ({instance.staff_id}) "
            f"was updated by {actor}."
        ),
    )
