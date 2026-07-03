"""Add offline-sync fields to accounts.User (uuid, is_deleted, deleted_at,
updated_at). See docs/OFFLINE_FIRST_ARCHITECTURE.md. Users are synced so that
offline auth and permission checks work on client devices. The unique ``uuid``
is added via the safe add-nullable -> populate -> enforce-unique pattern.
"""
import uuid

from django.db import migrations, models


def populate_uuids(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for row in User.objects.all().iterator():
        row.uuid = uuid.uuid4()
        row.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_permissions_override_alter_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user", name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
        ),
        migrations.RunPython(populate_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user", name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                                   help_text="Global sync identity, stable across devices."),
        ),
        migrations.AddField(
            model_name="user", name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name="user", name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
        migrations.AddField(
            model_name="user", name="updated_at",
            field=models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking."),
        ),
    ]
