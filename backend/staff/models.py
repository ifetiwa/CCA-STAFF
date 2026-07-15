import re
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import timedelta, date

from common.sync import SyncModelMixin


# Promotion cycle depends on the officer's current grade level:
#   GL 01–06 → 2 years   GL 07–14 → 3 years   GL 15 and above → 4 years
# Unknown/unreadable grade falls back to the middle band (3 years).
DEFAULT_PROMOTION_CYCLE_YEARS = 3


def promotion_cycle_years(grade_level_code):
    """Years between promotions for a grade-level code like 'GL07', '07', 'GL 15'."""
    if not grade_level_code:
        return DEFAULT_PROMOTION_CYCLE_YEARS
    m = re.search(r"\d+", str(grade_level_code))
    if not m:
        return DEFAULT_PROMOTION_CYCLE_YEARS
    gl = int(m.group())
    if gl <= 0:
        return DEFAULT_PROMOTION_CYCLE_YEARS
    if gl <= 6:
        return 2
    if gl <= 14:
        return 3
    return 4


def _add_years(base, years):
    """Add whole calendar years (matches the frontend's setFullYear logic)."""
    try:
        return base.replace(year=base.year + years)
    except ValueError:  # 29 Feb → 28 Feb on non-leap target year
        return base.replace(year=base.year + years, day=28)


class Staff(SyncModelMixin):
    """
    Main Staff Biodata model containing all personnel information.
    """
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    MARITAL_STATUS_CHOICES = [
        ('Single', 'Single'),
        ('Married', 'Married'),
        ('Divorced', 'Divorced'),
        ('Widowed', 'Widowed'),
    ]

    EMPLOYMENT_TYPE_CHOICES = [
        ('Permanent', 'Permanent'),
        ('Contract', 'Contract'),
        ('Temporary', 'Temporary'),
        ('Casual', 'Casual'),
    ]

    EMPLOYMENT_STATUS_CHOICES = [
        ('Active', 'Active'),
        ('On Leave', 'On Leave'),
        ('Pending', 'Pending'),
        ('STOP PAY', 'STOP PAY'),
        ('Secondment', 'Secondment'),
        ('Suspension', 'Suspension'),
        ('Retirement', 'Retirement'),
        ('Resignation', 'Resignation'),
        ('Deceased', 'Deceased'),
        ('Archive', 'Archive'),
    ]

    # Personal Information
    staff_id = models.CharField(
        max_length=20,
        unique=True,
        help_text="Unique staff identification number"
    )
    file_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Personnel file number (open registry, e.g. from the nominal roll's FileNo)."
    )
    secret_file_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Confidential personnel file reference (e.g. CCA/SF/2026/0001)."
    )
    first_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="First name"
    )
    middle_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Middle name(s)"
    )
    last_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Last name/Surname"
    )
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        help_text="Date of birth (optional — bulk imports may omit it)"
    )
    gender = models.CharField(
        max_length=1,
        choices=GENDER_CHOICES,
        blank=True,
        null=True,
        help_text="Gender (optional)"
    )
    nationality = models.CharField(
        max_length=100,
        default='Nigerian',
        blank=True,
        help_text="Nationality"
    )
    state_of_origin = models.CharField(
        max_length=100,
        blank=True,
        help_text="State of origin in Nigeria"
    )
    # Parent agency / MDA the staff member belongs to. Free text so bulk
    # import can accumulate agencies without a separate lookup table.
    agency = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Parent agency / establishment"
    )
    # Sub-unit within the department, and cadre. Free text (the SPA owns the
    # unit picker per department); stored here so they persist across devices.
    unit = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Unit within the department"
    )
    cadre = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        help_text="Cadre / job stream (e.g. Legal, Administration)"
    )
    local_government_area = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        help_text="Local Government Area (LGA)"
    )
    
    # Contact Information
    email = models.EmailField(
        unique=True,
        blank=True,
        null=True,
        help_text="Official email address (optional). Blank stored as NULL so "
                  "multiple staff without an email don't clash on the unique index."
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Primary phone number (optional)"
    )
    alternate_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Alternate phone number"
    )
    residential_address = models.TextField(
        blank=True,
        help_text="Current residential address (optional)"
    )
    residential_state = models.CharField(
        max_length=100,
        blank=True,
        help_text="State of residence (optional)"
    )
    residential_city = models.CharField(
        max_length=100,
        blank=True,
        help_text="City of residence (optional)"
    )
    
    # Passport/Identification
    passport_photo = models.ImageField(
        upload_to='passport_photos/%Y/%m/',
        blank=True,
        null=True,
        help_text="Passport-size photograph (optional)"
    )
    signature = models.ImageField(
        upload_to='signatures/%Y/%m/',
        blank=True,
        null=True,
        help_text="Scanned signature image (PNG/JPG, transparent or white background preferred)"
    )
    passport_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="International passport number"
    )
    national_identification = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="National ID number"
    )
    nin = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="National Identification Number"
    )
    nhis_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="National Health Insurance Scheme (NHIS) enrolment number"
    )
    nhf_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="National Housing Fund (NHF) / housing PIN"
    )
    year_of_call_to_bar = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        help_text="Year of call to bar (legal staff only, optional)"
    )
    
    # Personal Details
    marital_status = models.CharField(
        max_length=50,
        choices=MARITAL_STATUS_CHOICES,
        default='Single'
    )
    number_of_dependents = models.IntegerField(
        default=0,
        help_text="Number of dependents"
    )
    
    # Employment Information
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Current department (optional)"
    )
    designation = models.ForeignKey(
        'departments.Designation',
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Current designation/rank (optional)"
    )
    posting_location = models.ForeignKey(
        'departments.PostingLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Current posting location"
    )
    grade_level = models.ForeignKey(
        'departments.GradeLevel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Current salary grade level"
    )
    grade_step = models.IntegerField(
        default=1,
        help_text="Current step within grade level"
    )
    employment_type = models.CharField(
        max_length=50,
        choices=EMPLOYMENT_TYPE_CHOICES,
        default='Permanent',
        help_text="Type of employment"
    )
    employment_status = models.CharField(
        max_length=50,
        choices=EMPLOYMENT_STATUS_CHOICES,
        default='Active',
        help_text="Current employment status"
    )
    
    # Service Dates
    first_appointment_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date of first appointment to the organization (optional)"
    )
    present_appointment_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date of present appointment / posting (DOPE on the nominal roll)."
    )
    last_promotion_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date of last promotion"
    )
    next_promotion_date = models.DateField(
        blank=True,
        null=True,
        help_text="Auto-calculated next promotion date (3 years from last promotion)"
    )
    contract_start_date = models.DateField(
        blank=True,
        null=True,
        help_text="Contract start date (if applicable)"
    )
    contract_end_date = models.DateField(
        blank=True,
        null=True,
        help_text="Contract end date (if applicable)"
    )
    
    # Step-Increment Tracking
    # Nigerian civil-service rule: step rises by 1 each year, on either
    # 1 January or 1 July, depending on whether the staff's present-post
    # anchor date falls in Jan–Jun or Jul–Dec respectively. The
    # apply_step_increments management command runs daily and bumps the
    # step whenever ``next_increment_date`` has been reached.
    last_increment_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date the staff's step was last incremented (auto-set).",
    )
    next_increment_date = models.DateField(
        blank=True,
        null=True,
        help_text="Next scheduled step-increment date (1 Jan or 1 Jul, auto-set).",
    )

    # Calculated Fields
    years_of_service = models.IntegerField(
        default=0,
        help_text="Total years of service (auto-calculated)"
    )
    retirement_date = models.DateField(
        blank=True,
        null=True,
        help_text="Calculated retirement date (age 60 or 35 years of service, whichever is earlier)"
    )
    retirement_date_age_60 = models.DateField(
        blank=True,
        null=True,
        help_text="Date staff reaches age 60 (DOB + 60 years)"
    )
    retirement_date_service_35 = models.DateField(
        blank=True,
        null=True,
        help_text="Date staff completes 35 years of service (first appointment + 35 years)"
    )
    retirement_basis = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        choices=[("age", "Age 60"), ("service", "35 years of service")],
        help_text="Which rule produced the earlier retirement date"
    )
    years_remaining_to_retirement = models.IntegerField(
        default=0,
        help_text="Whole years remaining until retirement (snapshot, refreshed on save)"
    )
    months_remaining_to_retirement = models.IntegerField(
        default=0,
        help_text="Total whole months remaining until retirement (snapshot, refreshed on save)"
    )
    
    # Education/Qualifications
    highest_qualification = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Highest educational qualification"
    )
    professional_certifications = models.TextField(
        blank=True,
        null=True,
        help_text="Professional certifications and licenses"
    )
    qualifications = models.TextField(
        blank=True,
        null=True,
        help_text="Educational qualifications (one per line; captured from bulk import)"
    )
    
    # Next of Kin — up to 3 entries (Primary, Secondary, Tertiary).
    # Stored as flat columns to keep queries simple; Primary is the existing
    # next_of_kin_* set, the 2nd and 3rd are suffixed _2 / _3.
    next_of_kin_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Name of primary next of kin"
    )
    next_of_kin_relationship = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Relationship to staff member"
    )
    next_of_kin_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Phone number of primary next of kin"
    )
    next_of_kin_email = models.EmailField(
        blank=True,
        null=True,
        help_text="Email of primary next of kin"
    )
    next_of_kin_address = models.TextField(
        blank=True,
        null=True,
        help_text="Address of primary next of kin"
    )

    next_of_kin_2_name = models.CharField(max_length=200, blank=True, null=True, help_text="Name of secondary next of kin")
    next_of_kin_2_relationship = models.CharField(max_length=50, blank=True, null=True)
    next_of_kin_2_phone = models.CharField(max_length=20, blank=True, null=True)
    next_of_kin_2_email = models.EmailField(blank=True, null=True)
    next_of_kin_2_address = models.TextField(blank=True, null=True)

    next_of_kin_3_name = models.CharField(max_length=200, blank=True, null=True, help_text="Name of tertiary next of kin")
    next_of_kin_3_relationship = models.CharField(max_length=50, blank=True, null=True)
    next_of_kin_3_phone = models.CharField(max_length=20, blank=True, null=True)
    next_of_kin_3_email = models.EmailField(blank=True, null=True)
    next_of_kin_3_address = models.TextField(blank=True, null=True)

    emergency_contact_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Emergency contact person"
    )
    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Emergency contact phone number"
    )
    
    # Bank Details
    bank_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Name of bank"
    )
    account_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Bank account number"
    )
    account_holder_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Account holder name"
    )

    # ------------------------------------------------------------------
    # Nominal-roll extras.
    # Structured columns for values that used to live only inside `remarks`
    # (and the permanent address, which previously had nowhere to go). Added so
    # they can be searched/filtered/reported on directly. All nullable.
    # ------------------------------------------------------------------
    title = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Courtesy title (Mr, Mrs, Dr, Barr., etc.)"
    )
    permanent_address = models.TextField(
        blank=True, null=True,
        help_text="Permanent / home-town address (distinct from residential address)."
    )
    date_confirmed = models.DateField(
        blank=True, null=True,
        help_text="Date the appointment was confirmed."
    )
    pay_status = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="Payroll status from the nominal roll (e.g. Active)."
    )
    pension_administrator = models.CharField(
        max_length=150, blank=True, null=True,
        help_text="Pension Fund Administrator (PFA)."
    )
    rsa_pin = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="Retirement Savings Account (RSA) PIN / Pension number."
    )
    sort_code = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Bank branch sort code."
    )
    location = models.CharField(
        max_length=150, blank=True, null=True,
        help_text="Duty post / location as recorded on the nominal roll (free text)."
    )

    # ------------------------------------------------------------------
    # Organisational hierarchy.
    # An explicit, assignable role used to order the nominal roll / staff list
    # (Chief Registrar first, then Directors, Deputy Directors, Heads of
    # Department and Heads of Unit) and to identify the court's Judges. Separate
    # from `designation` (the substantive job title) so the ordering is under
    # direct admin control and not tied to free-text designations.
    # ------------------------------------------------------------------
    ORGANIZATIONAL_ROLE_CHOICES = [
        ('Chief Registrar', 'Chief Registrar'),
        ('Director', 'Director'),
        ('Deputy Director', 'Deputy Director'),
        ('Head of Department', 'Head of Department'),
        ('Head of Unit', 'Head of Unit'),
        ('Judge', 'Judge'),
    ]
    organizational_role = models.CharField(
        max_length=40, blank=True, null=True,
        choices=ORGANIZATIONAL_ROLE_CHOICES,
        help_text="Hierarchy/role label; 'Judge' also lists the officer in the "
                  "Judges section (judges still appear in the main staff roll)."
    )
    judge_order = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Manual display order for the Judges list (lower = higher up). "
                  "Set by admins on the Judges page."
    )

    # System Fields
    is_active = models.BooleanField(
        default=True,
        help_text="Is the staff member active"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional remarks or notes"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="User who created this record"
    )
    updated_by = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="User who last updated this record"
    )

    class Meta:
        db_table = 'staff_staff'
        verbose_name = 'Staff Member'
        verbose_name_plural = 'Staff Members'
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['staff_id']),
            models.Index(fields=['email']),
            models.Index(fields=['department']),
            models.Index(fields=['designation']),
            models.Index(fields=['is_active']),
            models.Index(fields=['first_name', 'last_name']),
        ]
        permissions = [
            ('can_view_all_staff', 'Can view all staff records'),
            ('can_export_staff_records', 'Can export staff records'),
            ('can_approve_promotions', 'Can approve promotions'),
            ('can_manage_staff_documents', 'Can manage staff documents'),
        ]

    def __str__(self):
        return f"{self.staff_id} - {self.get_full_name()}"

    def get_full_name(self):
        """Return the full name of the staff member."""
        if self.middle_name:
            return f"{self.first_name} {self.middle_name} {self.last_name}"
        return f"{self.first_name} {self.last_name}"

    def calculate_years_of_service(self):
        """Calculate total years of service."""
        if not self.first_appointment_date:
            return 0
        today = date.today()
        delta = today - self.first_appointment_date
        return int(delta.days / 365.25)

    def calculate_retirement_at_age_60(self):
        """Date when staff reaches 60 years old (DOB + 60 years).
        Handles leap-day birthdays by falling back to Feb 28."""
        if not self.date_of_birth:
            return None
        dob = self.date_of_birth
        try:
            return date(dob.year + 60, dob.month, dob.day)
        except ValueError:
            return date(dob.year + 60, dob.month, dob.day - 1)

    def calculate_retirement_at_35_years_service(self):
        """Date when staff completes 35 years of service."""
        if not self.first_appointment_date:
            return None
        first = self.first_appointment_date
        try:
            return date(first.year + 35, first.month, first.day)
        except ValueError:
            return date(first.year + 35, first.month, first.day - 1)

    def calculate_retirement_date(self):
        """
        Earlier of:
        - Age 60 (date_of_birth + 60 years), OR
        - 35 years of service (first_appointment_date + 35 years)
        """
        age_60 = self.calculate_retirement_at_age_60()
        years_35 = self.calculate_retirement_at_35_years_service()
        if age_60 and years_35:
            return min(age_60, years_35)
        return age_60 or years_35

    def calculate_retirement_basis(self):
        """Return 'age' or 'service' indicating which rule applies."""
        age_60 = self.calculate_retirement_at_age_60()
        years_35 = self.calculate_retirement_at_35_years_service()
        if not (age_60 and years_35):
            return "age" if age_60 else ("service" if years_35 else None)
        return "age" if age_60 <= years_35 else "service"

    def calculate_time_remaining_to_retirement(self):
        """Return (years_remaining, total_months_remaining) until retirement.
        Negative when retirement date has passed."""
        target = self.calculate_retirement_date()
        if not target:
            return 0, 0
        today = date.today()
        # Total months between today and target, accounting for partial month.
        months = (target.year - today.year) * 12 + (target.month - today.month)
        if target.day < today.day:
            months -= 1
        years = months // 12 if months >= 0 else -((-months) // 12)
        return years, months

    def calculate_next_promotion_date(self):
        """
        Auto-calculate the next promotion date. The cycle length depends on the
        officer's current grade level (GL 01–06 → 2 yrs, GL 07–14 → 3 yrs,
        GL 15+ → 4 yrs). Counted from the last promotion, or first appointment
        when there has been no promotion yet.
        """
        base_date = self.last_promotion_date or self.first_appointment_date
        if not base_date:
            return None
        code = self.grade_level.grade_level if self.grade_level_id and self.grade_level else None
        return _add_years(base_date, promotion_cycle_years(code))

    # ------------------------------------------------------------------
    # Step-increment calculation (Nigerian civil-service rule).
    #
    #   Anchor   = last_promotion_date or first_appointment_date.
    #   Window   = month(Anchor) in {1..6}  → increment month is January
    #              month(Anchor) in {7..12} → increment month is July
    #   Next     = the next 1-Jan or 1-Jul strictly after ``reference``
    #              (which defaults to today), AND strictly after the
    #              ``last_increment_date`` so we always advance by ~1 year.
    # ------------------------------------------------------------------
    def _increment_anchor_date(self):
        return self.last_promotion_date or self.first_appointment_date

    def increment_month(self) -> int | None:
        """Return 1 (January) or 7 (July) based on present-post anchor."""
        anchor = self._increment_anchor_date()
        if not anchor:
            return None
        return 1 if anchor.month <= 6 else 7

    def calculate_next_increment_date(self, reference: date | None = None) -> date | None:
        """First 1-Jan or 1-Jul strictly after ``reference`` (today by default)
        AND strictly after ``last_increment_date`` if one exists."""
        month = self.increment_month()
        if month is None:
            return None
        today = reference or date.today()
        floor = max(filter(None, [today, self.last_increment_date]))
        # Try this year first, then next year, then the year after — at
        # most one of those will be > floor for a given month.
        for year in (floor.year, floor.year + 1, floor.year + 2):
            candidate = date(year, month, 1)
            if candidate > floor:
                return candidate
        return None

    def max_step(self) -> int:
        """Cap step at the GradeLevel.number_of_steps if it's known."""
        if self.grade_level_id and self.grade_level:
            return int(self.grade_level.number_of_steps or 15)
        return 15

    def save(self, *args, **kwargs):
        """Override save to auto-calculate fields."""
        # Store a blank email as NULL so multiple email-less staff don't collide
        # on the unique index (SQLite/Postgres allow many NULLs, not many '').
        if not self.email:
            self.email = None
        self.years_of_service = self.calculate_years_of_service()
        self.retirement_date_age_60 = self.calculate_retirement_at_age_60()
        self.retirement_date_service_35 = self.calculate_retirement_at_35_years_service()
        self.retirement_date = self.calculate_retirement_date()
        self.retirement_basis = self.calculate_retirement_basis()
        years_left, months_left = self.calculate_time_remaining_to_retirement()
        self.years_remaining_to_retirement = years_left
        self.months_remaining_to_retirement = months_left
        self.next_promotion_date = self.calculate_next_promotion_date()
        # next_increment_date is computed from today + anchor on first save,
        # then maintained by apply_step_increments after each bump.
        if self.next_increment_date is None:
            self.next_increment_date = self.calculate_next_increment_date()

        super().save(*args, **kwargs)

    @property
    def age(self):
        """Get current age of the staff member (None if DOB unknown)."""
        if not self.date_of_birth:
            return None
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    @property
    def is_due_for_promotion(self):
        """Check if staff is due for promotion."""
        if self.next_promotion_date:
            return date.today() >= self.next_promotion_date
        return False

    @property
    def is_due_for_retirement(self):
        """Check if staff is due for retirement."""
        if self.retirement_date:
            return date.today() >= self.retirement_date
        return False

    @property
    def time_to_retirement(self):
        """Get days remaining until retirement."""
        if self.retirement_date:
            delta = self.retirement_date - date.today()
            return max(0, delta.days)
        return None


class Notification(SyncModelMixin):
    """
    System notifications about a staff member — currently used by the
    check_promotions management command to flag upcoming promotion-due dates.
    """
    TYPE_CHOICES = [
        ("PROMOTION_DUE", "Promotion due"),
        ("PROMOTION_OVERDUE", "Promotion overdue"),
        ("RETIREMENT_DUE", "Retirement approaching"),
        ("OTHER", "Other"),
    ]
    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("warning", "Warning"),
        ("danger", "Danger"),
    ]

    staff = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, db_index=True)
    severity = models.CharField(
        max_length=10, choices=SEVERITY_CHOICES, default="info"
    )
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    related_date = models.DateField(
        null=True, blank=True,
        help_text="The date this notification refers to (e.g. promotion due date)."
    )
    is_read = models.BooleanField(default=False, db_index=True)
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking.")

    class Meta:
        db_table = "staff_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["staff", "type", "related_date"]),
            models.Index(fields=["is_read", "-created_at"]),
        ]
        constraints = [
            # Idempotency: only one notification per (staff, type, related_date)
            # so re-running the daily command doesn't pile up duplicates.
            models.UniqueConstraint(
                fields=["staff", "type", "related_date"],
                name="uniq_notification_per_staff_type_date",
            ),
        ]

    def __str__(self):
        return f"{self.get_type_display()} — {self.staff.staff_id} ({self.related_date})"


class StaffTransfer(SyncModelMixin):
    """
    History of posting-location transfers for a staff member.
    Each row records a move from from_location to to_location on transfer_date.
    from_location may be NULL for the very first posting assignment.
    """
    staff = models.ForeignKey(
        Staff,
        on_delete=models.CASCADE,
        related_name='transfers',
    )
    from_location = models.ForeignKey(
        'departments.PostingLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transfers_out',
        help_text="Previous posting location (NULL for first posting)."
    )
    to_location = models.ForeignKey(
        'departments.PostingLocation',
        on_delete=models.SET_NULL,
        null=True,
        related_name='transfers_in',
        help_text="New posting location."
    )
    transfer_date = models.DateField(
        help_text="Effective date of the transfer."
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Optional notes about the transfer."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking.")
    created_by = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Username of user who recorded this transfer."
    )

    class Meta:
        db_table = 'staff_stafftransfer'
        verbose_name = 'Staff Transfer'
        verbose_name_plural = 'Staff Transfers'
        ordering = ['-transfer_date', '-created_at']
        indexes = [
            models.Index(fields=['staff', '-transfer_date']),
            models.Index(fields=['to_location']),
            models.Index(fields=['from_location']),
        ]

    def __str__(self):
        to_label = str(self.to_location) if self.to_location_id else "Unassigned"
        return f"{self.staff.staff_id} → {to_label} on {self.transfer_date}"


class StaffPromotion(SyncModelMixin):
    """
    Track promotion history of staff members.
    """
    staff = models.ForeignKey(
        Staff,
        on_delete=models.CASCADE,
        related_name='promotions'
    )
    promotion_date = models.DateField(
        help_text="Date of promotion"
    )
    previous_designation = models.CharField(
        max_length=150,
        help_text="Previous designation"
    )
    new_designation = models.ForeignKey(
        'departments.Designation',
        on_delete=models.SET_NULL,
        null=True,
        help_text="New designation"
    )
    previous_grade = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text="Previous grade level"
    )
    new_grade = models.ForeignKey(
        'departments.GradeLevel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="New grade level"
    )
    new_grade_step = models.IntegerField(
        default=1,
        help_text="Step in new grade"
    )
    promotion_letter_ref = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Reference number of promotion letter"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Remarks about the promotion"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, help_text="Used for sync change-tracking.")

    class Meta:
        db_table = 'staff_staffpromotion'
        verbose_name = 'Staff Promotion'
        verbose_name_plural = 'Staff Promotions'
        ordering = ['-promotion_date']
        indexes = [
            models.Index(fields=['staff', '-promotion_date']),
        ]

    def __str__(self):
        return f"{self.staff.get_full_name()} - {self.promotion_date}"
