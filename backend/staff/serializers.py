from rest_framework import serializers

from departments.models import Department, Designation, GradeLevel, PostingLocation
from .models import Staff


class DepartmentSerializer(serializers.ModelSerializer):
    staff_count = serializers.IntegerField(source="staff.count", read_only=True)

    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "staff_count", "created_at")


class PostingLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostingLocation
        fields = ("id", "name", "address", "city", "state", "is_headquarters")


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "rank_order", "description")


class GradeLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = ("id", "level", "name", "description")


class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    years_of_service = serializers.IntegerField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    posting_location_name = serializers.CharField(source="posting_location.name", read_only=True)
    designation_title = serializers.CharField(source="designation.title", read_only=True)
    grade_level_name = serializers.CharField(source="grade_level.grade_level", read_only=True)

    class Meta:
        model = Staff
        fields = (
            "id",
            "staff_id",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "passport_photo",
            "signature",
            "gender",
            "date_of_birth",
            "age",
            "state_of_origin",
            "nhis_number",
            "nhf_number",
            "year_of_call_to_bar",
            "department",
            "department_name",
            "posting_location",
            "posting_location_name",
            "designation",
            "designation_title",
            "grade_level",
            "grade_level_name",
            "grade_step",
            "employment_status",
            "first_appointment_date",
            "last_promotion_date",
            "next_promotion_date",
            "years_of_service",
            "retirement_date",
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
            "retirement_date",
            "created_at",
            "updated_at",
        )
