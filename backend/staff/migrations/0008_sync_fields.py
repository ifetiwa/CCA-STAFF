"""Add offline-sync fields (uuid, is_deleted, deleted_at, updated_at) to the
staff-app models. See docs/OFFLINE_FIRST_ARCHITECTURE.md.

The ``uuid`` column is unique, so it is added in three safe steps against
existing rows: add it nullable/non-unique, populate every row with a fresh
uuid4 via RunPython, then enforce uniqueness.
"""
import uuid

from django.db import migrations, models

SYNC_MODELS = ("Staff", "Notification", "StaffTransfer", "StaffPromotion")


def populate_uuids(apps, schema_editor):
    for model_name in SYNC_MODELS:
        Model = apps.get_model("staff", model_name)
        for row in Model.objects.all().iterator():
            row.uuid = uuid.uuid4()
            row.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0007_staff_last_increment_date_staff_next_increment_date"),
    ]

    operations = [
        # 1) Add uuid nullable + non-unique so existing rows migrate cleanly.
        migrations.AddField(
            model_name="staff",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
        ),
        migrations.AddField(
            model_name="stafftransfer",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
        ),
        migrations.AddField(
            model_name="staffpromotion",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
        ),
        # 2) Give every existing row a distinct uuid.
        migrations.RunPython(populate_uuids, migrations.RunPython.noop),
        # 3) Enforce uniqueness now that values are populated.
        migrations.AlterField(
            model_name="staff",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                                   help_text="Global sync identity, stable across devices."),
        ),
        migrations.AlterField(
            model_name="notification",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                                   help_text="Global sync identity, stable across devices."),
        ),
        migrations.AlterField(
            model_name="stafftransfer",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                                   help_text="Global sync identity, stable across devices."),
        ),
        migrations.AlterField(
            model_name="staffpromotion",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                                   help_text="Global sync identity, stable across devices."),
        ),
        # --- Tombstone fields on every synced model ---
        migrations.AddField(
            model_name="staff", name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name="staff", name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
        migrations.AddField(
            model_name="notification", name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name="notification", name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
        migrations.AddField(
            model_name="stafftransfer", name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name="stafftransfer", name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
        migrations.AddField(
            model_name="staffpromotion", name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name="staffpromotion", name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
        # --- updated_at where it was missing (Staff already has it) ---
        migrations.AddField(
            model_name="notification", name="updated_at",
            field=models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking."),
        ),
        migrations.AddField(
            model_name="stafftransfer", name="updated_at",
            field=models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking."),
        ),
        migrations.AddField(
            model_name="staffpromotion", name="updated_at",
            field=models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking."),
        ),
    ]
