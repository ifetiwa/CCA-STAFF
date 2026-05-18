# Schema + data migration: introduce NHIS / NHF / signature / year-of-call-to-bar
# and align the employment_status choice list with the React app.
#
# Schema:
#   - signature              ImageField (nullable)
#   - nhis_number            CharField  (nullable)
#   - nhf_number             CharField  (nullable)
#   - year_of_call_to_bar    PositiveSmallIntegerField (nullable)
#   - employment_status      choices updated (validation only — no column change)
#
# Data:
#   Map any legacy status values to their nearest equivalent in the new set so
#   existing rows continue to validate. The mapping is intentionally
#   conservative; rows with a status that already matches the new set are left
#   untouched. Idempotent and safe on an empty database.

from django.db import migrations, models


LEGACY_STATUS_MAP = {
    "Suspended": "On Leave",
    "Retired": "Retirement",
    "Terminated": "Resignation",
}


def migrate_legacy_statuses(apps, schema_editor):
    Staff = apps.get_model("staff", "Staff")
    for old, new in LEGACY_STATUS_MAP.items():
        Staff.objects.filter(employment_status=old).update(employment_status=new)


def revert_legacy_statuses(apps, schema_editor):
    # Best-effort reverse: only the values we know we wrote. Other rows are
    # left as-is, since multiple legacy values map to the same new one and
    # we can't recover the original.
    Staff = apps.get_model("staff", "Staff")
    Staff.objects.filter(employment_status="Retirement").update(employment_status="Retired")
    Staff.objects.filter(employment_status="Resignation").update(employment_status="Terminated")
    # Suspended → On Leave was lossy; do not auto-revert "On Leave".


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="staff",
            name="signature",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="signatures/%Y/%m/",
                help_text=(
                    "Scanned signature image (PNG/JPG, transparent or white "
                    "background preferred)"
                ),
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="nhis_number",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=50,
                help_text="National Health Insurance Scheme (NHIS) enrolment number",
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="nhf_number",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=50,
                help_text="National Housing Fund (NHF) / housing PIN",
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="year_of_call_to_bar",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                help_text="Year of call to bar (legal staff only, optional)",
            ),
        ),
        # Update choices on employment_status. This is validation-only — the
        # column type/length is unchanged — but Django still emits an
        # AlterField to keep the model state in sync with migrations state.
        migrations.AlterField(
            model_name="staff",
            name="employment_status",
            field=models.CharField(
                max_length=50,
                default="Active",
                help_text="Current employment status",
                choices=[
                    ("Active", "Active"),
                    ("On Leave", "On Leave"),
                    ("Pending", "Pending"),
                    ("Secondment", "Secondment"),
                    ("Retirement", "Retirement"),
                    ("Resignation", "Resignation"),
                    ("Deceased", "Deceased"),
                    ("Archive", "Archive"),
                ],
            ),
        ),
        migrations.RunPython(migrate_legacy_statuses, revert_legacy_statuses),
    ]
