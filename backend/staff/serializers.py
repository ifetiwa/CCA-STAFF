from rest_framework import serializers

from departments.models import Department, Designation, GradeLevel, PostingLocation
from .models import Staff


class DepartmentSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="department_code", required=False)

    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "created_at")


class PostingLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostingLocation
        fields = ("id", "name", "address", "city", "state")


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "rank_order", "description")


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
