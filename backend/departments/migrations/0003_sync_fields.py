"""Add offline-sync fields (uuid, is_deleted, deleted_at) to the departments
models. See docs/OFFLINE_FIRST_ARCHITECTURE.md. These models already have
``updated_at``. The unique ``uuid`` is added via the safe
add-nullable -> populate -> enforce-unique pattern.
"""
import uuid

from django.db import migrations, models

SYNC_MODELS = ("Department", "PostingLocation", "Designation", "GradeLevel", "DesignationOption")


def populate_uuids(apps, schema_editor):
    for model_name in SYNC_MODELS:
        Model = apps.get_model("departments", model_name)
        for row in Model.objects.all().iterator():
            row.uuid = uuid.uuid4()
            row.save(update_fields=["uuid"])


def _add_uuid_nullable(model):
    return migrations.AddField(
        model_name=model, name="uuid",
        field=models.UUIDField(default=uuid.uuid4, editable=False, null=True, db_index=True),
    )


def _make_uuid_unique(model):
    return migrations.AlterField(
        model_name=model, name="uuid",
        field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,
                               help_text="Global sync identity, stable across devices."),
    )


def _add_tombstone(model):
    return [
        migrations.AddField(
            model_name=model, name="is_deleted",
            field=models.BooleanField(default=False, db_index=True,
                                      help_text="Soft-delete tombstone flag (syncs deletions across devices)."),
        ),
        migrations.AddField(
            model_name=model, name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, help_text="When this row was soft-deleted."),
        ),
    ]


_lower = [m.lower() for m in SYNC_MODELS]


class Migration(migrations.Migration):

    dependencies = [
        ("departments", "0002_designationoption"),
    ]

    operations = (
        [_add_uuid_nullable(m) for m in _lower]
        + [migrations.RunPython(populate_uuids, migrations.RunPython.noop)]
        + [_make_uuid_unique(m) for m in _lower]
        + [op for m in _lower for op in _add_tombstone(m)]
    )
