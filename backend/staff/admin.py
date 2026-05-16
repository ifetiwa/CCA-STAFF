from django.contrib import admin

from .models import Staff
from departments.models import Department, Designation, GradeLevel, PostingLocation


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(PostingLocation)
class PostingLocationAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    search_fields = ("title",) if "title" in [f.name for f in Designation._meta.get_fields()] else ()


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    pass


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ("staff_id", "last_name", "first_name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("staff_id", "first_name", "last_name", "middle_name")
