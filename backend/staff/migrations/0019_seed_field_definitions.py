from django.db import migrations


# (key, label, section, field_type, required, locked)
# key MUST match the staff form's formData key so the SPA can map config→field.
BUILTIN_FIELDS = [
    # Personal / Biodata
    ("title",              "Title",                 "Personal",   "text",     False, False),
    ("firstName",          "First Name",            "Personal",   "text",     True,  True),
    ("middleName",         "Middle Name",           "Personal",   "text",     False, False),
    ("lastName",           "Last Name",             "Personal",   "text",     True,  True),
    ("gender",             "Gender",                "Personal",   "select",   True,  False),
    ("dateOfBirth",        "Date of Birth",         "Personal",   "date",     True,  False),
    ("placeOfBirth",       "Place of Birth",        "Personal",   "text",     False, False),
    ("nationality",        "Nationality",           "Personal",   "text",     False, False),
    ("stateOfOrigin",      "State of Origin",       "Personal",   "text",     True,  False),
    ("lga",                "LGA of Origin",         "Personal",   "text",     False, False),
    ("senatorialDistrict", "Senatorial District",   "Personal",   "text",     False, False),
    ("geopoliticalZone",   "Geopolitical Zone",     "Personal",   "text",     False, False),
    ("tribe",              "Tribe",                 "Personal",   "text",     False, False),
    ("religion",           "Religion",              "Personal",   "text",     False, False),
    ("languages",          "Languages",             "Personal",   "text",     False, False),
    ("bloodGroup",         "Blood Group",           "Personal",   "text",     False, False),
    ("genotype",           "Genotype",              "Personal",   "text",     False, False),
    ("disability",         "Disability",            "Personal",   "text",     False, False),
    ("maritalStatus",      "Marital Status",        "Personal",   "select",   False, False),
    ("spouseName",         "Spouse Name",           "Personal",   "text",     False, False),
    ("numberOfChildren",   "Number of Children",    "Personal",   "number",   False, False),
    ("nin",                "NIN",                   "Personal",   "text",     False, False),
    # Contact
    ("email",              "Email",                 "Contact",    "email",    False, False),
    ("phonePrimary",       "Phone Number",          "Contact",    "tel",      False, False),
    ("phoneAlt",           "Alternate Phone",       "Contact",    "tel",      False, False),
    ("residentialAddress", "Residential Address",   "Contact",    "text",     False, False),
    ("permanentAddress",   "Permanent Address",     "Contact",    "text",     False, False),
    ("state",              "State of Residence",    "Contact",    "text",     False, False),
    ("city",               "City of Residence",     "Contact",    "text",     False, False),
    # Employment
    ("fileNumber",         "File Number",           "Employment", "text",     True,  True),
    ("secretFileNumber",   "Secret File Number",    "Employment", "text",     False, False),
    ("cadre",              "Cadre",                 "Employment", "text",     False, False),
    ("department",         "Department",            "Employment", "select",   True,  False),
    ("unit",               "Unit",                  "Employment", "text",     False, False),
    ("designation",        "Designation",           "Employment", "select",   False, False),
    ("postingLocation",    "Duty Station",          "Employment", "select",   False, False),
    ("organizationalRole", "Organizational Role",   "Employment", "select",   False, False),
    ("gradeLevel",         "Grade Level",           "Employment", "select",   False, False),
    ("step",               "Step",                  "Employment", "select",   False, False),
    ("employmentType",     "Employment Type",       "Employment", "select",   False, False),
    ("status",             "Employment Status",     "Employment", "select",   False, False),
    ("firstAppointmentDate", "First Appointment",   "Employment", "date",     True,  False),
    ("confirmationDate",   "Confirmation Date",     "Employment", "date",     False, False),
    ("presentAppointmentDate", "Present Appointment", "Employment", "date",   False, False),
    ("nominalPromotionDate", "Nominal Promotion Date", "Employment", "date",  False, False),
    ("lastPromotionDate",  "Last Promotion Date",   "Employment", "date",     False, False),
    ("yearOfCallToBar",    "Year of Call to Bar",   "Employment", "number",   False, False),
    ("nhisNumber",         "NHIA / NHIS No.",       "Employment", "text",     False, False),
    ("nhfNumber",          "NHF No.",               "Employment", "text",     False, False),
    # Financial
    ("bankName",           "Bank Name",             "Financial",  "text",     False, False),
    ("accountNumber",      "Account Number",        "Financial",  "text",     False, False),
    ("pfa",                "Pension Administrator",  "Financial", "text",     False, False),
    ("rsaPin",             "RSA PIN",               "Financial",  "text",     False, False),
    ("tin",                "TIN",                   "Financial",  "text",     False, False),
]


def seed(apps, schema_editor):
    FieldDefinition = apps.get_model("staff", "FieldDefinition")
    for i, (key, label, section, ftype, required, locked) in enumerate(BUILTIN_FIELDS):
        FieldDefinition.objects.update_or_create(
            key=key,
            defaults=dict(
                label=label, section=section, field_type=ftype,
                required=required, locked=locked, enabled=True,
                is_custom=False, order=i,
            ),
        )


def unseed(apps, schema_editor):
    FieldDefinition = apps.get_model("staff", "FieldDefinition")
    FieldDefinition.objects.filter(is_custom=False).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("staff", "0018_staff_custom_fields_fielddefinition"),
    ]
    operations = [migrations.RunPython(seed, unseed)]
