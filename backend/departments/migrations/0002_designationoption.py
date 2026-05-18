from django.db import migrations, models


SEED_DESIGNATIONS = [
    'Court Clerk',
    'Court Registrar',
    'Senior Registrar',
    'Legal Officer',
    'Legal Counsel',
    'Administrative Officer',
    'Human Resources Officer',
    'IT Support Officer',
    'Finance Officer',
    'Accountant',
    'Driver',
    'Secretary',
]


def seed_designations(apps, schema_editor):
    DesignationOption = apps.get_model('departments', 'DesignationOption')
    for name in SEED_DESIGNATIONS:
        DesignationOption.objects.get_or_create(name=name)


def unseed_designations(apps, schema_editor):
    DesignationOption = apps.get_model('departments', 'DesignationOption')
    DesignationOption.objects.filter(name__in=SEED_DESIGNATIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DesignationOption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Designation Option',
                'verbose_name_plural': 'Designation Options',
                'db_table': 'departments_designationoption',
                'ordering': ['name'],
            },
        ),
        migrations.RunPython(seed_designations, unseed_designations),
    ]
