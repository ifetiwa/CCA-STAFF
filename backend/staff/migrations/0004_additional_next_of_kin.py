# Adds support for up to 3 Next of Kin entries (Primary + Secondary + Tertiary)
# plus an email field for the primary entry.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0003_alter_staff_employment_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_email',
            field=models.EmailField(blank=True, null=True, help_text='Email of primary next of kin', max_length=254),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_2_name',
            field=models.CharField(blank=True, null=True, help_text='Name of secondary next of kin', max_length=200),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_2_relationship',
            field=models.CharField(blank=True, null=True, max_length=50),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_2_phone',
            field=models.CharField(blank=True, null=True, max_length=20),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_2_email',
            field=models.EmailField(blank=True, null=True, max_length=254),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_2_address',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_3_name',
            field=models.CharField(blank=True, null=True, help_text='Name of tertiary next of kin', max_length=200),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_3_relationship',
            field=models.CharField(blank=True, null=True, max_length=50),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_3_phone',
            field=models.CharField(blank=True, null=True, max_length=20),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_3_email',
            field=models.EmailField(blank=True, null=True, max_length=254),
        ),
        migrations.AddField(
            model_name='staff',
            name='next_of_kin_3_address',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='staff',
            name='next_of_kin_name',
            field=models.CharField(blank=True, null=True, help_text='Name of primary next of kin', max_length=200),
        ),
        migrations.AlterField(
            model_name='staff',
            name='next_of_kin_phone',
            field=models.CharField(blank=True, null=True, help_text='Phone number of primary next of kin', max_length=20),
        ),
        migrations.AlterField(
            model_name='staff',
            name='next_of_kin_address',
            field=models.TextField(blank=True, null=True, help_text='Address of primary next of kin'),
        ),
    ]
