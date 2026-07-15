from rest_framework import serializers
from django.core.validators import validate_email as _dj_validate_email
from django.core.exceptions import ValidationError as _DjValidationError

from departments.models import Department, Designation, GradeLevel, PostingLocation
from .models import Staff


def clean_email(raw):
    """Repair the two email typos that otherwise get a whole staff row rejected
    on import — a doubled ``@@`` and a comma used in place of the final dot
    (e.g. ``name@gmail,com``) — then validate. Returns a valid, lower-cased
    address, or ``""`` when the value is blank or cannot be repaired.

    This is why bulk imports used to silently lose rows: Django's EmailField
    hard-rejects malformed addresses with a 400, and the client counted the
    whole record as failed. Cleaning here means the record still saves (just
    without the unusable email) instead of being dropped.
    """
    s = str(raw or "").strip()
    if not s:
        return ""
    fixed = s.replace("@@", "@").replace(",", ".").lower()
    try:
        _dj_validate_email(fixed)
        return fixed
    except _DjValidationError:
        return ""


class DepartmentSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="department_code", required=False)

    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "created_at")


class PostingLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostingLocation
        fields = ("id", "name", "address", "city", "state", "is_headquarters")


class DesignationSerializer(serializers.ModelSerializer):
    # The React picker reads `name`; expose it as a read alias of `title` so the
    # list hydrates correctly while writes still use `title`.
    name = serializers.CharField(source="title", read_only=True)
    # The picker only sends a title when adding a designation. `rank_order` is a
    # required model column, so make it optional here and auto-assign it in the
    # viewset — otherwise every add failed with "rank_order is required".
    rank_order = serializers.IntegerField(required=False)

    class Meta:
        model = Designation
        fields = ("id", "title", "name", "rank_order", "description")

    def to_internal_value(self, data):
        """Accept `name` as an alias for `title` on write.

        The web picker posts ``{title}``, but older installed desktop clients
        post ``{name}``. Without this, those clients get
        "title: This field is required." and can't add designations. Map
        ``name`` → ``title`` when a title wasn't supplied so every client works.
        """
        title = data.get("title") if hasattr(data, "get") else None
        name = data.get("name") if hasattr(data, "get") else None
        if not title and name:
            try:
                data = data.copy()  # QueryDict (form post) → mutable copy
            except Exception:
                data = dict(data)
            data["title"] = name
        return super().to_internal_value(data)


class GradeLevelSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="grade_level", read_only=True)

    class Meta:
        model = GradeLevel
        fields = ("id", "grade_level", "name", "description")


class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    years_of_service = serializers.IntegerField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    posting_location_name = serializers.CharField(source="posting_location.name", read_only=True)
    designation_title = serializers.CharField(source="designation.title", read_only=True)
    grade_level_name = serializers.CharField(source="grade_level.grade_level", read_only=True)
    posting_location_is_hq = serializers.BooleanField(
        source="posting_location.is_headquarters", read_only=True, default=False,
    )

    # All email-typed columns on the model. Pre-cleaned so a malformed value
    # never 400s the whole record (see clean_email above).
    EMAIL_FIELDS = (
        "email",
        "next_of_kin_email",
        "next_of_kin_2_email",
        "next_of_kin_3_email",
    )

    def to_internal_value(self, data):
        """Repair/blank malformed emails in the incoming payload before the
        EmailField validators run, so bad addresses no longer cause the entire
        staff row to be rejected on import."""
        try:
            data = data.copy()  # QueryDict (multipart) → mutable copy
        except AttributeError:
            data = dict(data)
        for key in self.EMAIL_FIELDS:
            if key in data:
                data[key] = clean_email(data.get(key))
        return super().to_internal_value(data)

    def get_fields(self):
        """No field is mandatory on write — bulk import may supply partial rows.

        Every writable field is forced optional (and text fields allow blank)
        so the server never rejects a record for a *missing* field. Data-format
        checks (valid email, unique staff_id) still apply to values that *are*
        provided. The model stores blanks/NULLs for anything omitted.
        """
        fields = super().get_fields()
        for field in fields.values():
            if field.read_only:
                continue
            field.required = False
            if isinstance(field, serializers.CharField):
                field.allow_blank = True
        return fields

    class Meta:
        model = Staff
        fields = (
            "id",
            "staff_id",
            "file_number",
            "secret_file_number",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "passport_photo",
            "signature",
            "gender",
            "date_of_birth",
            "age",
            "nationality",
            "state_of_origin",
            "local_government_area",
            # Contact
            "email",
            "phone_number",
            "alternate_phone",
            "residential_address",
            "residential_state",
            "residential_city",
            # Identity numbers
            "nin",
            "national_identification",
            "passport_number",
            "nhis_number",
            "nhf_number",
            "year_of_call_to_bar",
            # Personal
            "marital_status",
            "number_of_dependents",
            # Employment
            "agency",
            "cadre",
            "unit",
            "department",
            "department_name",
            "posting_location",
            "posting_location_name",
            "designation",
            "designation_title",
            "grade_level",
            "grade_level_name",
            "grade_step",
            "employment_type",
            "employment_status",
            "first_appointment_date",
            "present_appointment_date",
            "last_promotion_date",
            "next_promotion_date",
            "last_increment_date",
            "next_increment_date",
            "years_of_service",
            "retirement_date",
            # Education
            "highest_qualification",
            "professional_certifications",
            "qualifications",
            # Next of kin (up to 3)
            "next_of_kin_name",
            "next_of_kin_relationship",
            "next_of_kin_phone",
            "next_of_kin_email",
            "next_of_kin_address",
            "next_of_kin_2_name",
            "next_of_kin_2_relationship",
            "next_of_kin_2_phone",
            "next_of_kin_2_email",
            "next_of_kin_2_address",
            "next_of_kin_3_name",
            "next_of_kin_3_relationship",
            "next_of_kin_3_phone",
            "next_of_kin_3_email",
            "next_of_kin_3_address",
            # Bank
            "bank_name",
            "account_number",
            "account_holder_name",
            "sort_code",
            # Nominal-roll extras (previously only in remarks)
            "title",
            "permanent_address",
            "date_confirmed",
            "pay_status",
            "pension_administrator",
            "rsa_pin",
            "location",
            "organizational_role",
            "judge_order",
            "posting_location_is_hq",
            "remarks",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "full_name",
            "age",
            "years_of_service",
            "next_promotion_date",
            "last_increment_date",
            "next_increment_date",
            "retirement_date",
            "created_at",
            "updated_at",
        )
