from django.db import models
from django.core.exceptions import ValidationError

from common.sync import SyncModelMixin


class Department(SyncModelMixin):
    """
    Represents departments within the Customary Court of Appeal.
    """
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Department name (e.g., Legal, HR, Finance)"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Department description and responsibilities"
    )
    department_code = models.CharField(
        max_length=10,
        unique=True,
        help_text="Short code for the department (e.g., LEG, HR)"
    )
    head_of_department = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Name of the department head"
    )
    contact_email = models.EmailField(
        blank=True,
        null=True,
        help_text="Department contact email"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Department phone number"
    )
    office_location = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Physical office location"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this department currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments_department'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['department_code']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.department_code})"


class PostingLocation(SyncModelMixin):
    """
    Represents posting locations where staff can be assigned.
    """
    name = models.CharField(
        max_length=200,
        unique=True,
        help_text="Name of the posting location"
    )
    address = models.TextField(
        help_text="Full address of the location"
    )
    state = models.CharField(
        max_length=50,
        help_text="State where location is situated"
    )
    city = models.CharField(
        max_length=100,
        help_text="City or town"
    )
    location_code = models.CharField(
        max_length=10,
        unique=True,
        help_text="Short code for the location"
    )
    contact_person = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Contact person at the location"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )
    email = models.EmailField(
        blank=True,
        null=True
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Details about the posting location"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this location currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments_postinglocation'
        verbose_name = 'Posting Location'
        verbose_name_plural = 'Posting Locations'
        ordering = ['state', 'city', 'name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['state']),
            models.Index(fields=['location_code']),
        ]

    def __str__(self):
        return f"{self.name} - {self.state}"


class Designation(SyncModelMixin):
    """
    Represents job designations/ranks within the organization.
    """
    title = models.CharField(
        max_length=150,
        unique=True,
        help_text="Job title or designation"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the designation"
    )
    rank_order = models.IntegerField(
        help_text="Hierarchical rank (1=highest, for sorting)"
    )
    designation_type = models.CharField(
        max_length=50,
        choices=[
            ('executive', 'Executive'),
            ('managerial', 'Managerial'),
            ('professional', 'Professional'),
            ('administrative', 'Administrative'),
            ('support', 'Support'),
        ],
        default='professional',
        help_text="Category of designation"
    )
    min_experience_required = models.IntegerField(
        default=0,
        help_text="Minimum years of experience required"
    )
    educational_requirement = models.TextField(
        blank=True,
        null=True,
        help_text="Educational qualifications required"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this designation currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments_designation'
        verbose_name = 'Designation'
        verbose_name_plural = 'Designations'
        ordering = ['rank_order', 'title']
        indexes = [
            models.Index(fields=['title']),
            models.Index(fields=['rank_order']),
        ]

    def __str__(self):
        return self.title


class GradeLevel(SyncModelMixin):
    """
    Represents salary grade levels within the organization.
    """
    grade_level = models.CharField(
        max_length=10,
        unique=True,
        help_text="Grade level code (e.g., GL10, GL12, GL14)"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the grade level"
    )
    step_1_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Salary amount for step 1"
    )
    number_of_steps = models.IntegerField(
        default=15,
        help_text="Number of steps in this grade (typically 15)"
    )
    increment_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Annual increment amount per step"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this grade level currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments_gradelevel'
        verbose_name = 'Grade Level'
        verbose_name_plural = 'Grade Levels'
        ordering = ['grade_level']
        indexes = [
            models.Index(fields=['grade_level']),
        ]

    def __str__(self):
        return f"Grade {self.grade_level}"

    def get_salary_for_step(self, step):
        """Calculate salary for a given step."""
        if step < 1 or step > self.number_of_steps:
            raise ValidationError(f"Step must be between 1 and {self.number_of_steps}")
        return self.step_1_amount + ((step - 1) * self.increment_amount)


class DesignationOption(SyncModelMixin):
    """
    Server-side, name-only designation list shown in the React staff form
    and the Settings → Designations admin pane.

    This is intentionally separate from ``Designation`` (which models the
    full job catalogue with rank_order, salary expectations, etc.). The
    frontend picker only needs a list of free-form labels that all logged-in
    users see the same version of.
    """

    name = models.CharField(max_length=150, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments_designationoption'
        verbose_name = 'Designation Option'
        verbose_name_plural = 'Designation Options'
        ordering = ['name']

    def __str__(self):
        return self.name
