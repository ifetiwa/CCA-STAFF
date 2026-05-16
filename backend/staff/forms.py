from datetime import date, timedelta

from crispy_bootstrap5.bootstrap5 import FloatingField
from crispy_forms.helper import FormHelper
from crispy_forms.layout import HTML, Column, Div, Layout, Row, Submit
from django import forms
from django.core.exceptions import ValidationError

from accounts.upload_validators import validate_photo

from .models import Staff


NIGERIAN_STATES = [
    ("", "-- Select State of Origin --"),
    ("Abia", "Abia"),
    ("Adamawa", "Adamawa"),
    ("Akwa Ibom", "Akwa Ibom"),
    ("Anambra", "Anambra"),
    ("Bauchi", "Bauchi"),
    ("Bayelsa", "Bayelsa"),
    ("Benue", "Benue"),
    ("Borno", "Borno"),
    ("Cross River", "Cross River"),
    ("Delta", "Delta"),
    ("Ebonyi", "Ebonyi"),
    ("Edo", "Edo"),
    ("Ekiti", "Ekiti"),
    ("Enugu", "Enugu"),
    ("FCT", "Federal Capital Territory"),
    ("Gombe", "Gombe"),
    ("Imo", "Imo"),
    ("Jigawa", "Jigawa"),
    ("Kaduna", "Kaduna"),
    ("Kano", "Kano"),
    ("Katsina", "Katsina"),
    ("Kebbi", "Kebbi"),
    ("Kogi", "Kogi"),
    ("Kwara", "Kwara"),
    ("Lagos", "Lagos"),
    ("Nasarawa", "Nasarawa"),
    ("Niger", "Niger"),
    ("Ogun", "Ogun"),
    ("Ondo", "Ondo"),
    ("Osun", "Osun"),
    ("Oyo", "Oyo"),
    ("Plateau", "Plateau"),
    ("Rivers", "Rivers"),
    ("Sokoto", "Sokoto"),
    ("Taraba", "Taraba"),
    ("Yobe", "Yobe"),
    ("Zamfara", "Zamfara"),
]


def calc_years_of_service(first_appointment_date):
    if not first_appointment_date:
        return 0
    delta = date.today() - first_appointment_date
    return int(delta.days / 365.25)


def _safe_add_years(d, years):
    if not d:
        return None
    try:
        return date(d.year + years, d.month, d.day)
    except ValueError:
        return date(d.year + years, d.month, d.day - 1)


def calc_retirement_date(date_of_birth, first_appointment_date):
    if not (date_of_birth and first_appointment_date):
        return None
    retirement_at_60 = _safe_add_years(date_of_birth, 60)
    retirement_at_35_years = _safe_add_years(first_appointment_date, 35)
    return min(retirement_at_60, retirement_at_35_years)


def calc_next_promotion_date(last_promotion_date, first_appointment_date):
    base = last_promotion_date or first_appointment_date
    if not base:
        return None
    return base + timedelta(days=3 * 365)


class StaffRegistrationForm(forms.ModelForm):
    """Staff registration form, styled with crispy-forms (bootstrap5)."""

    first_name = forms.CharField(
        max_length=100,
        label="First Name",
        widget=forms.TextInput(attrs={"placeholder": "First name"}),
    )
    middle_name = forms.CharField(
        max_length=100,
        required=False,
        label="Middle Name",
        widget=forms.TextInput(attrs={"placeholder": "Middle name (optional)"}),
    )
    last_name = forms.CharField(
        max_length=100,
        label="Last Name",
        widget=forms.TextInput(attrs={"placeholder": "Surname"}),
    )
    state_of_origin = forms.ChoiceField(
        choices=NIGERIAN_STATES,
        label="State of Origin",
    )
    date_of_birth = forms.DateField(
        label="Date of Birth",
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    first_appointment_date = forms.DateField(
        label="Date of First Appointment",
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    last_promotion_date = forms.DateField(
        required=False,
        label="Date of Last Promotion",
        widget=forms.DateInput(attrs={"type": "date"}),
    )

    residential_state = forms.ChoiceField(
        choices=NIGERIAN_STATES,
        label="State of Residence",
    )

    class Meta:
        model = Staff
        fields = [
            "staff_id",
            "first_name",
            "middle_name",
            "last_name",
            "passport_photo",
            "gender",
            "date_of_birth",
            "state_of_origin",
            "email",
            "phone_number",
            "residential_address",
            "residential_state",
            "residential_city",
            "department",
            "posting_location",
            "designation",
            "grade_level",
            "grade_step",
            "first_appointment_date",
            "last_promotion_date",
        ]
        widgets = {
            "staff_id": forms.TextInput(attrs={"placeholder": "e.g. CCA/2026/001"}),
            "grade_step": forms.NumberInput(attrs={"min": 1, "max": 15}),
            "email": forms.EmailInput(attrs={"placeholder": "name@cca.gov.ng"}),
            "phone_number": forms.TextInput(attrs={"placeholder": "+234 …"}),
            "residential_address": forms.Textarea(attrs={"rows": 2}),
            "residential_city": forms.TextInput(attrs={"placeholder": "City / Town"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.helper = FormHelper()
        self.helper.form_method = "post"
        self.helper.form_enctype = "multipart/form-data"
        self.helper.attrs = {"novalidate": "novalidate", "id": "staff-registration-form"}
        self.helper.layout = Layout(
            HTML('<h4 class="section-title mt-2 mb-3">Identity</h4>'),
            Row(
                Column("staff_id", css_class="col-md-4"),
                Column("passport_photo", css_class="col-md-8"),
            ),
            Row(
                Column("first_name", css_class="col-md-4"),
                Column("middle_name", css_class="col-md-4"),
                Column("last_name", css_class="col-md-4"),
            ),
            Row(
                Column("gender", css_class="col-md-4"),
                Column("date_of_birth", css_class="col-md-4"),
                Column("state_of_origin", css_class="col-md-4"),
            ),

            HTML('<h4 class="section-title mt-4 mb-3">Contact & Residence</h4>'),
            Row(
                Column("email", css_class="col-md-6"),
                Column("phone_number", css_class="col-md-6"),
            ),
            Row(
                Column("residential_address", css_class="col-md-12"),
            ),
            Row(
                Column("residential_state", css_class="col-md-6"),
                Column("residential_city", css_class="col-md-6"),
            ),

            HTML('<h4 class="section-title mt-4 mb-3">Posting & Rank</h4>'),
            Row(
                Column("department", css_class="col-md-6"),
                Column("posting_location", css_class="col-md-6"),
            ),
            Row(
                Column("designation", css_class="col-md-6"),
                Column("grade_level", css_class="col-md-3"),
                Column("grade_step", css_class="col-md-3"),
            ),

            HTML('<h4 class="section-title mt-4 mb-3">Service Dates</h4>'),
            Row(
                Column("first_appointment_date", css_class="col-md-6"),
                Column("last_promotion_date", css_class="col-md-6"),
            ),

            HTML('<h4 class="section-title mt-4 mb-3">Auto-calculated</h4>'),
            HTML(
                '<div class="row g-3 mb-3">'
                '  <div class="col-md-4">'
                '    <label class="form-label">Years of Service</label>'
                '    <input type="text" id="calc-years-of-service" class="form-control" readonly>'
                '  </div>'
                '  <div class="col-md-4">'
                '    <label class="form-label">Next Promotion Due</label>'
                '    <input type="text" id="calc-next-promotion" class="form-control" readonly>'
                '  </div>'
                '  <div class="col-md-4">'
                '    <label class="form-label">Retirement Date</label>'
                '    <input type="text" id="calc-retirement" class="form-control" readonly>'
                '  </div>'
                '</div>'
            ),
            Div(
                Submit("submit", "Register Staff", css_class="btn btn-primary px-4"),
                HTML('<a href="." class="btn btn-outline-secondary ms-2">Reset</a>'),
                css_class="mt-3",
            ),
        )

    def clean_date_of_birth(self):
        dob = self.cleaned_data.get("date_of_birth")
        if dob and dob >= date.today():
            raise ValidationError("Date of birth must be in the past.")
        if dob:
            age = (date.today() - dob).days / 365.25
            if age < 18:
                raise ValidationError("Staff must be at least 18 years old.")
            if age > 80:
                raise ValidationError("Date of birth seems incorrect (age over 80).")
        return dob

    def clean_first_appointment_date(self):
        first = self.cleaned_data.get("first_appointment_date")
        if first and first > date.today():
            raise ValidationError("First appointment date cannot be in the future.")
        return first

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if email and Staff.objects.filter(email__iexact=email).exists():
            raise ValidationError("A staff member with this email already exists.")
        return email

    def clean_phone_number(self):
        phone = (self.cleaned_data.get("phone_number") or "").strip()
        digits = "".join(ch for ch in phone if ch.isdigit())
        if phone and len(digits) < 10:
            raise ValidationError("Phone number must contain at least 10 digits.")
        return phone

    def clean_passport_photo(self):
        photo = self.cleaned_data.get("passport_photo")
        if photo and hasattr(photo, "name"):
            validate_photo(photo)
        return photo

    def clean_staff_id(self):
        sid = (self.cleaned_data.get("staff_id") or "").strip()
        if sid and Staff.objects.filter(staff_id__iexact=sid).exists():
            raise ValidationError("This Staff ID is already in use.")
        return sid

    def clean_grade_step(self):
        step = self.cleaned_data.get("grade_step")
        if step is not None and (step < 1 or step > 15):
            raise ValidationError("Grade step must be between 1 and 15.")
        return step

    def clean(self):
        cleaned = super().clean()
        dob = cleaned.get("date_of_birth")
        first = cleaned.get("first_appointment_date")
        last_promo = cleaned.get("last_promotion_date")

        if dob and first and first < dob:
            self.add_error(
                "first_appointment_date",
                "First appointment date cannot be before date of birth.",
            )
        if dob and first:
            age_at_appt = (first - dob).days / 365.25
            if age_at_appt < 16:
                self.add_error(
                    "first_appointment_date",
                    "Staff must have been at least 16 at first appointment.",
                )
        if last_promo and first and last_promo < first:
            self.add_error(
                "last_promotion_date",
                "Last promotion cannot be before first appointment.",
            )
        if last_promo and last_promo > date.today():
            self.add_error("last_promotion_date", "Last promotion cannot be in the future.")
        return cleaned
