import csv
from datetime import date, datetime, timedelta
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction, IntegrityError
from django.db.models import Count, Prefetch, Q
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST
from rest_framework import filters, status as drf_status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import RoleBasedReadWrite

from audit.models import AuditLog
from audit.utils import log_search, log_view
from departments.models import Department, Designation, GradeLevel, PostingLocation

from .forms import (
    StaffRegistrationForm,
    calc_next_promotion_date,
    calc_retirement_date,
    calc_years_of_service,
)
from .models import Staff, StaffPromotion, StaffTransfer
from .serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    GradeLevelSerializer,
    PostingLocationSerializer,
    StaffSerializer,
)

# Bulk-import views: urls.py imports the function-style aliases by name,
# so we re-export them here. The class-based views themselves live in
# import_views.py; import_wrapper.py wraps them with .as_view().
from .import_wrapper import (
    import_staff,
    import_preview,
    import_complete,
)
from .import_views import download_staff_template


def _staff_edit_required(view):
    """Gate mutation endpoints. Returns JSON 401/403 instead of redirecting,
    so the inline-edit fetch() calls don't accidentally JSON.parse a login HTML page."""
    @wraps(view)
    def _wrap(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"ok": False, "error": "Authentication required."}, status=401)
        if not (request.user.is_superuser or request.user.is_staff):
            return JsonResponse({"ok": False, "error": "Permission denied."}, status=403)
        return view(request, *args, **kwargs)
    return _wrap


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _staff_snapshot(staff):
    return {
        "staff_id": staff.staff_id,
        "first_name": staff.first_name,
        "middle_name": staff.middle_name,
        "last_name": staff.last_name,
        "gender": staff.gender,
        "date_of_birth": staff.date_of_birth.isoformat() if staff.date_of_birth else None,
        "state_of_origin": staff.state_of_origin,
        "department": str(staff.department) if staff.department_id else None,
        "posting_location": str(staff.posting_location) if staff.posting_location_id else None,
        "designation": str(staff.designation) if staff.designation_id else None,
        "grade_level": str(staff.grade_level) if staff.grade_level_id else None,
        "grade_step": staff.grade_step,
        "first_appointment_date": staff.first_appointment_date.isoformat()
        if staff.first_appointment_date
        else None,
        "last_promotion_date": staff.last_promotion_date.isoformat()
        if staff.last_promotion_date
        else None,
        "next_promotion_date": staff.next_promotion_date.isoformat()
        if staff.next_promotion_date
        else None,
        "years_of_service": staff.years_of_service,
        "retirement_date": staff.retirement_date.isoformat()
        if staff.retirement_date
        else None,
    }


@login_required
def register_staff(request):
    """Staff registration form view. On valid POST, saves the staff record
    and writes a CREATE entry to the audit log."""
    if request.method == "POST":
        form = StaffRegistrationForm(request.POST, request.FILES)
        if form.is_valid():
            staff = form.save(commit=False)

            # Auto-calculated fields: server-side source of truth.
            staff.years_of_service = calc_years_of_service(staff.first_appointment_date)
            staff.next_promotion_date = calc_next_promotion_date(
                staff.last_promotion_date, staff.first_appointment_date,
                staff.grade_level.grade_level if staff.grade_level_id and staff.grade_level else None,
            )
            staff.retirement_date = calc_retirement_date(
                staff.date_of_birth, staff.first_appointment_date
            )

            actor = getattr(request.user, "username", None) or "anonymous"
            actor_email = getattr(request.user, "email", "") or ""
            staff.created_by = actor
            staff.updated_by = actor
            staff.save()

            AuditLog.objects.create(
                user=actor,
                user_email=actor_email or None,
                action="CREATE",
                model_name="Staff",
                record_id=str(staff.pk),
                record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
                old_values={},
                new_values=_staff_snapshot(staff),
                changed_fields=list(_staff_snapshot(staff).keys()),
                ip_address=_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                request_method=request.method,
                request_path=request.path,
                status="SUCCESS",
                remarks="Staff registered via registration form.",
            )

            messages.success(
                request,
                f"Staff {staff.get_full_name()} ({staff.staff_id}) registered successfully.",
            )
            return redirect(reverse("staff:register"))
    else:
        form = StaffRegistrationForm()

    return render(request, "staff/staff_register.html", {"form": form})


STAFF_LIST_PAGE_SIZE = 20

SORT_OPTIONS = {
    "name": ("last_name", "first_name"),
    "-name": ("-last_name", "-first_name"),
    "grade_level": ("grade_level__grade_level",),
    "-grade_level": ("-grade_level__grade_level",),
    "next_promotion": ("next_promotion_date",),
    "-next_promotion": ("-next_promotion_date",),
    "retirement": ("retirement_date",),
    "-retirement": ("-retirement_date",),
}


def _filtered_staff_queryset(request):
    """Build the filtered/searched/sorted Staff queryset used by both the
    HTML list view and the CSV/PDF exports.

    Performance notes:
    - select_related on all FK columns shown in the table avoids N+1.
    - only() trims columns the table doesn't render.
    - Indexes already exist on staff_id, department, designation, is_active,
      and (first_name, last_name) per Staff.Meta.indexes.
    """
    q = (request.GET.get("q") or "").strip()
    department_id = request.GET.get("department") or ""
    grade_level_id = request.GET.get("grade_level") or ""
    location_id = request.GET.get("posting_location") or ""
    promotion_window = request.GET.get("promotion_window") or ""  # "6m"
    sort = request.GET.get("sort") or "name"

    qs = (
        Staff.objects.select_related(
            "department", "posting_location", "designation", "grade_level"
        )
        .only(
            "id",
            "staff_id",
            "first_name",
            "middle_name",
            "last_name",
            "passport_photo",
            "next_promotion_date",
            "retirement_date",
            "is_active",
            "department__name",
            "department__department_code",
            "posting_location__name",
            "posting_location__state",
            "designation__title",
            "grade_level__grade_level",
            "grade_step",
        )
        .filter(is_active=True)
    )

    if q:
        qs = qs.filter(
            Q(first_name__icontains=q)
            | Q(middle_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(staff_id__icontains=q)
            | Q(department__name__icontains=q)
            | Q(department__department_code__icontains=q)
            | Q(posting_location__name__icontains=q)
            | Q(posting_location__city__icontains=q)
            | Q(posting_location__state__icontains=q)
            | Q(designation__title__icontains=q)
            | Q(grade_level__grade_level__icontains=q)
        )

    if department_id.isdigit():
        qs = qs.filter(department_id=int(department_id))
    if grade_level_id.isdigit():
        qs = qs.filter(grade_level_id=int(grade_level_id))
    if location_id.isdigit():
        qs = qs.filter(posting_location_id=int(location_id))

    if promotion_window == "6m":
        today = date.today()
        qs = qs.filter(
            next_promotion_date__isnull=False,
            next_promotion_date__gte=today,
            next_promotion_date__lte=today + timedelta(days=183),
        )

    order_by = SORT_OPTIONS.get(sort, SORT_OPTIONS["name"])
    qs = qs.order_by(*order_by)
    return qs, {
        "q": q,
        "department": department_id,
        "grade_level": grade_level_id,
        "posting_location": location_id,
        "promotion_window": promotion_window,
        "sort": sort,
    }


@login_required
def staff_list(request):
    queryset, applied = _filtered_staff_queryset(request)

    # Log search/filter activity (only when the user actually entered a query
    # or applied filters — bare page views aren't useful audit noise).
    if request.user.is_authenticated and (
        applied.get("q")
        or applied.get("department")
        or applied.get("grade_level")
        or applied.get("posting_location")
        or applied.get("promotion_window")
    ):
        try:
            log_search(
                request,
                model_name="staff.staff",
                query=applied.get("q") or "",
                result_count=queryset.count(),
                filters={k: v for k, v in applied.items() if v},
            )
        except Exception:
            pass

    paginator = Paginator(queryset, STAFF_LIST_PAGE_SIZE)
    page_number = request.GET.get("page") or 1
    page = paginator.get_page(page_number)

    # Build the querystring without `page=` so pagination links preserve filters.
    qd = request.GET.copy()
    qd.pop("page", None)
    base_qs = qd.urlencode()

    context = {
        "page": page,
        "applied": applied,
        "base_qs": base_qs,
        "total": paginator.count,
        "page_size": STAFF_LIST_PAGE_SIZE,
        "departments": Department.objects.filter(is_active=True).order_by("name"),
        "grade_levels": GradeLevel.objects.filter(is_active=True).order_by("grade_level"),
        "locations": PostingLocation.objects.filter(is_active=True).order_by("state", "name"),
        "sort_choices": [
            ("name", "Name (A–Z)"),
            ("-name", "Name (Z–A)"),
            ("grade_level", "Grade level (asc)"),
            ("-grade_level", "Grade level (desc)"),
            ("next_promotion", "Next promotion (soonest)"),
            ("-next_promotion", "Next promotion (latest)"),
            ("retirement", "Retirement (soonest)"),
            ("-retirement", "Retirement (latest)"),
        ],
    }
    return render(request, "staff/staff_list.html", context)


@login_required
def staff_detail(request, pk):
    staff = get_object_or_404(
        Staff.objects.select_related(
            "department", "posting_location", "designation", "grade_level"
        ),
        pk=pk,
    )
    # Drives the >50-views/hr suspicious-activity detector.
    try:
        log_view(request, staff)
    except Exception:
        pass
    promotion_history = (
        StaffPromotion.objects.filter(staff=staff)
        .select_related("new_designation", "new_grade")
        .order_by("-promotion_date")
    )
    transfer_history = (
        StaffTransfer.objects.filter(staff=staff)
        .select_related("from_location", "to_location")
        .order_by("-transfer_date", "-created_at")
    )
    context = {
        "staff": staff,
        "promotion_history": promotion_history,
        "transfer_history": transfer_history,
        "departments": Department.objects.filter(is_active=True).order_by("name"),
        "designations": Designation.objects.filter(is_active=True).order_by(
            "rank_order", "title"
        ),
        "grade_levels": GradeLevel.objects.filter(is_active=True).order_by("grade_level"),
        "locations": PostingLocation.objects.filter(is_active=True).order_by(
            "state", "name"
        ),
        "gender_choices": Staff.GENDER_CHOICES,
        "marital_choices": Staff.MARITAL_STATUS_CHOICES,
    }
    return render(request, "staff/staff_detail.html", context)


# Whitelist of fields that may be edited via the inline-edit endpoint.
# Map: field_name -> ("text" | "date" | "int" | "fk:<Model>" | "choice").
EDITABLE_FIELDS = {
    # Personal
    "first_name": "text",
    "middle_name": "text",
    "last_name": "text",
    "gender": "choice",
    "date_of_birth": "date",
    "state_of_origin": "text",
    "local_government_area": "text",
    "marital_status": "choice",
    "number_of_dependents": "int",
    # Contact
    "email": "text",
    "phone_number": "text",
    "alternate_phone": "text",
    "residential_address": "text",
    "residential_state": "text",
    "residential_city": "text",
    # Employment
    "department": "fk:department",
    "designation": "fk:designation",
    "posting_location": "fk:posting_location",
    "grade_level": "fk:grade_level",
    "grade_step": "int",
    "first_appointment_date": "date",
    "last_promotion_date": "date",
    # Education
    "highest_qualification": "text",
    "professional_certifications": "text",
    # Next of kin — primary
    "next_of_kin_name": "text",
    "next_of_kin_relationship": "text",
    "next_of_kin_phone": "text",
    "next_of_kin_email": "text",
    "next_of_kin_address": "text",
    # Next of kin — secondary
    "next_of_kin_2_name": "text",
    "next_of_kin_2_relationship": "text",
    "next_of_kin_2_phone": "text",
    "next_of_kin_2_email": "text",
    "next_of_kin_2_address": "text",
    # Next of kin — tertiary
    "next_of_kin_3_name": "text",
    "next_of_kin_3_relationship": "text",
    "next_of_kin_3_phone": "text",
    "next_of_kin_3_email": "text",
    "next_of_kin_3_address": "text",
    # Bank
    "bank_name": "text",
    "account_number": "text",
    "account_holder_name": "text",
    # Misc
    "remarks": "text",
}

FK_MODELS = {
    "department": Department,
    "designation": Designation,
    "posting_location": PostingLocation,
    "grade_level": GradeLevel,
}


def _coerce(field_type, raw):
    """Convert a raw form value to the proper Python type for the model."""
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        return None
    if field_type == "text" or field_type == "choice":
        return str(raw).strip()
    if field_type == "int":
        return int(raw)
    if field_type == "date":
        return datetime.strptime(str(raw).strip(), "%Y-%m-%d").date()
    if field_type.startswith("fk:"):
        model = FK_MODELS[field_type.split(":", 1)[1]]
        return model.objects.get(pk=int(raw))
    raise ValidationError(f"Unsupported field type: {field_type}")


def _display_value(staff, field_name):
    """Render a field for JSON response / audit snapshot."""
    val = getattr(staff, field_name)
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if hasattr(val, "pk"):
        return {"id": val.pk, "label": str(val)}
    return val


@_staff_edit_required
@require_POST
def staff_update_fields(request, pk):
    """Inline-edit endpoint. Accepts one or more field=value pairs in POST
    body, validates against the whitelist, saves, and writes one AuditLog
    row with the old/new values. Returns JSON with the new display values
    plus any derived fields that changed (years_of_service etc)."""
    staff = get_object_or_404(Staff, pk=pk)
    actor = getattr(request.user, "username", None) or "anonymous"

    old_values = {}
    new_values = {}
    errors = {}

    posted = {
        k: v
        for k, v in request.POST.items()
        if k != "csrfmiddlewaretoken" and k in EDITABLE_FIELDS
    }
    rejected = [k for k in request.POST if k not in EDITABLE_FIELDS and k != "csrfmiddlewaretoken"]
    if rejected:
        return JsonResponse(
            {"ok": False, "error": f"Fields not editable: {', '.join(rejected)}"},
            status=400,
        )

    # Coerce all inputs first; bail if any one fails.
    coerced = {}
    for field, raw in posted.items():
        try:
            coerced[field] = _coerce(EDITABLE_FIELDS[field], raw)
        except (ValueError, ValidationError, Department.DoesNotExist,
                Designation.DoesNotExist, PostingLocation.DoesNotExist,
                GradeLevel.DoesNotExist) as exc:
            errors[field] = str(exc) or "Invalid value"
    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    # Snapshot old → apply → save → log.
    with transaction.atomic():
        for field, value in coerced.items():
            old = getattr(staff, field)
            if old == value:
                continue
            old_values[field] = _display_value(staff, field)
            setattr(staff, field, value)
            new_values[field] = _display_value(staff, field)

        if not new_values:
            return JsonResponse({"ok": True, "fields": {}, "derived": {}, "noop": True})

        staff.updated_by = actor
        staff.save()  # triggers auto-calculation of derived fields

        AuditLog.objects.create(
            user=actor,
            user_email=getattr(request.user, "email", "") or None,
            action="UPDATE",
            model_name="Staff",
            record_id=str(staff.pk),
            record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
            old_values=old_values,
            new_values=new_values,
            changed_fields=list(new_values.keys()),
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method,
            request_path=request.path,
            status="SUCCESS",
            remarks="Inline edit from staff detail page.",
        )

    return JsonResponse({
        "ok": True,
        "fields": new_values,
        "derived": {
            "years_of_service": staff.years_of_service,
            "next_promotion_date": staff.next_promotion_date.isoformat()
            if staff.next_promotion_date else None,
            "retirement_date": staff.retirement_date.isoformat()
            if staff.retirement_date else None,
            "age": staff.age,
        },
    })


@_staff_edit_required
@require_POST
def staff_update_photo(request, pk):
    """Replace the passport photo. Logs to AuditLog with the old/new URL."""
    staff = get_object_or_404(Staff, pk=pk)
    new_file = request.FILES.get("passport_photo")
    if not new_file:
        return JsonResponse({"ok": False, "error": "No file uploaded."}, status=400)

    if new_file.content_type not in {"image/jpeg", "image/png", "image/webp", "image/jpg"}:
        return JsonResponse(
            {"ok": False, "error": "Photo must be JPG, PNG, or WEBP."},
            status=400,
        )
    if new_file.size > 5 * 1024 * 1024:
        return JsonResponse(
            {"ok": False, "error": "Photo must be under 5 MB."},
            status=400,
        )

    actor = getattr(request.user, "username", None) or "anonymous"
    old_url = staff.passport_photo.url if staff.passport_photo else None

    with transaction.atomic():
        staff.passport_photo = new_file
        staff.updated_by = actor
        staff.save()

        AuditLog.objects.create(
            user=actor,
            user_email=getattr(request.user, "email", "") or None,
            action="UPDATE",
            model_name="Staff",
            record_id=str(staff.pk),
            record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
            old_values={"passport_photo": old_url},
            new_values={"passport_photo": staff.passport_photo.url},
            changed_fields=["passport_photo"],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method,
            request_path=request.path,
            status="SUCCESS",
            remarks="Passport photo replaced from staff detail page.",
        )

    return JsonResponse({"ok": True, "photo_url": staff.passport_photo.url})


@_staff_edit_required
@require_POST
def record_promotion(request, pk):
    """Record a promotion: creates a StaffPromotion row, updates the Staff
    record's current designation/grade/step/last_promotion_date (which in
    turn re-derives next_promotion_date), and writes two AuditLog entries
    (one for the StaffPromotion CREATE, one for the Staff UPDATE)."""
    staff = get_object_or_404(Staff, pk=pk)

    promotion_date_raw = (request.POST.get("promotion_date") or "").strip()
    new_designation_raw = (request.POST.get("new_designation") or "").strip()
    new_grade_raw = (request.POST.get("new_grade") or "").strip()
    new_grade_step_raw = (request.POST.get("new_grade_step") or "").strip()
    letter_ref = (request.POST.get("promotion_letter_ref") or "").strip() or None
    remarks = (request.POST.get("remarks") or "").strip() or None

    errors = {}

    promotion_date = None
    if not promotion_date_raw:
        errors["promotion_date"] = "Required."
    else:
        try:
            promotion_date = datetime.strptime(promotion_date_raw, "%Y-%m-%d").date()
        except ValueError:
            errors["promotion_date"] = "Use YYYY-MM-DD."
        else:
            if promotion_date > date.today():
                errors["promotion_date"] = "Cannot be in the future."
            if staff.first_appointment_date and promotion_date < staff.first_appointment_date:
                errors["promotion_date"] = "Cannot be before first appointment."

    new_designation = None
    if not new_designation_raw.isdigit():
        errors["new_designation"] = "Required."
    else:
        try:
            new_designation = Designation.objects.get(pk=int(new_designation_raw))
        except Designation.DoesNotExist:
            errors["new_designation"] = "Designation not found."

    new_grade = None
    if new_grade_raw:
        if not new_grade_raw.isdigit():
            errors["new_grade"] = "Invalid grade."
        else:
            try:
                new_grade = GradeLevel.objects.get(pk=int(new_grade_raw))
            except GradeLevel.DoesNotExist:
                errors["new_grade"] = "Grade not found."

    new_grade_step = 1
    if new_grade_step_raw:
        try:
            new_grade_step = int(new_grade_step_raw)
            if new_grade_step < 1 or new_grade_step > 15:
                errors["new_grade_step"] = "Step must be 1–15."
        except ValueError:
            errors["new_grade_step"] = "Invalid step."

    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    actor = getattr(request.user, "username", None) or "anonymous"
    actor_email = getattr(request.user, "email", "") or None
    previous_designation_label = staff.designation.title if staff.designation_id else "—"
    previous_grade_label = staff.grade_level.grade_level if staff.grade_level_id else None
    old_staff_snapshot = {
        "designation": previous_designation_label,
        "grade_level": previous_grade_label,
        "grade_step": staff.grade_step,
        "last_promotion_date": staff.last_promotion_date.isoformat()
        if staff.last_promotion_date else None,
    }

    with transaction.atomic():
        promo = StaffPromotion.objects.create(
            staff=staff,
            promotion_date=promotion_date,
            previous_designation=previous_designation_label,
            new_designation=new_designation,
            previous_grade=previous_grade_label,
            new_grade=new_grade,
            new_grade_step=new_grade_step,
            promotion_letter_ref=letter_ref,
            remarks=remarks,
        )

        staff.designation = new_designation
        if new_grade is not None:
            staff.grade_level = new_grade
            staff.grade_step = new_grade_step
        staff.last_promotion_date = promotion_date
        staff.updated_by = actor
        staff.save()  # re-derives next_promotion_date

        new_staff_snapshot = {
            "designation": new_designation.title,
            "grade_level": new_grade.grade_level if new_grade else previous_grade_label,
            "grade_step": staff.grade_step,
            "last_promotion_date": staff.last_promotion_date.isoformat(),
        }

        AuditLog.objects.create(
            user=actor,
            user_email=actor_email,
            action="CREATE",
            model_name="StaffPromotion",
            record_id=str(promo.pk),
            record_identifier=f"{staff.staff_id} → {new_designation.title} on {promotion_date.isoformat()}",
            old_values={},
            new_values={
                "promotion_date": promotion_date.isoformat(),
                "previous_designation": previous_designation_label,
                "new_designation": new_designation.title,
                "previous_grade": previous_grade_label,
                "new_grade": new_grade.grade_level if new_grade else None,
                "new_grade_step": new_grade_step,
                "promotion_letter_ref": letter_ref,
                "remarks": remarks,
            },
            changed_fields=[
                "promotion_date", "new_designation", "new_grade",
                "new_grade_step", "promotion_letter_ref", "remarks",
            ],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method,
            request_path=request.path,
            status="SUCCESS",
            remarks="Promotion recorded from staff detail page.",
        )

        AuditLog.objects.create(
            user=actor,
            user_email=actor_email,
            action="UPDATE",
            model_name="Staff",
            record_id=str(staff.pk),
            record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
            old_values=old_staff_snapshot,
            new_values=new_staff_snapshot,
            changed_fields=[
                k for k in new_staff_snapshot
                if old_staff_snapshot.get(k) != new_staff_snapshot.get(k)
            ],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method,
            request_path=request.path,
            status="SUCCESS",
            remarks="Staff record synced from recorded promotion.",
        )

    return JsonResponse({
        "ok": True,
        "promotion": {
            "id": promo.pk,
            "promotion_date": promotion_date.isoformat(),
            "previous_designation": previous_designation_label,
            "new_designation": new_designation.title,
            "new_grade": new_grade.grade_level if new_grade else None,
            "new_grade_step": new_grade_step,
            "promotion_letter_ref": letter_ref or "",
            "remarks": remarks or "",
        },
        "staff": {
            "designation": {"id": new_designation.pk, "label": new_designation.title},
            "grade_level": {"id": new_grade.pk, "label": new_grade.grade_level} if new_grade else None,
            "grade_step": staff.grade_step,
            "last_promotion_date": staff.last_promotion_date.isoformat(),
        },
        "derived": {
            "years_of_service": staff.years_of_service,
            "next_promotion_date": staff.next_promotion_date.isoformat()
            if staff.next_promotion_date else None,
            "retirement_date": staff.retirement_date.isoformat()
            if staff.retirement_date else None,
        },
    })


@login_required
def promotions_due(request):
    """Group active staff into urgency buckets based on next_promotion_date.
    DB-side filtering on indexed date column → fast for 500+ records."""
    today = date.today()
    year_end = date(today.year, 12, 31)
    in_30 = today + timedelta(days=30)
    in_90 = today + timedelta(days=90)

    base = (
        Staff.objects.filter(is_active=True, next_promotion_date__isnull=False)
        .select_related("department", "designation", "grade_level", "posting_location")
        .only(
            "id", "staff_id", "first_name", "middle_name", "last_name",
            "passport_photo", "next_promotion_date", "last_promotion_date",
            "grade_step",
            "department__name",
            "designation__title",
            "grade_level__grade_level",
            "posting_location__name",
        )
    )

    urgent = list(
        base.filter(
            next_promotion_date__gte=today,
            next_promotion_date__lte=in_30,
        ).order_by("next_promotion_date")
    )
    upcoming = list(
        base.filter(
            next_promotion_date__gt=in_30,
            next_promotion_date__lte=in_90,
        ).order_by("next_promotion_date")
    )
    this_year = list(
        base.filter(
            next_promotion_date__gt=in_90,
            next_promotion_date__lte=year_end,
        ).order_by("next_promotion_date")
    )
    overdue = list(
        base.filter(next_promotion_date__lt=today).order_by("next_promotion_date")
    )

    for s in overdue:
        days_over = (today - s.next_promotion_date).days
        s.overdue_days = days_over
        s.overdue_reason = (
            "Never promoted since appointment"
            if not s.last_promotion_date
            else f"{days_over} day(s) past due; last promoted {s.last_promotion_date.isoformat()}"
        )

    context = {
        "today": today,
        "buckets": [
            {"key": "urgent",   "label": "Due within 30 days", "css": "danger",  "rows": urgent},
            {"key": "upcoming", "label": "Due within 90 days", "css": "warning", "rows": upcoming},
            {"key": "this_year","label": f"Due later this year ({today.year})", "css": "success", "rows": this_year},
            {"key": "overdue",  "label": "Overdue", "css": "secondary", "rows": overdue},
        ],
        "totals": {
            "urgent": len(urgent),
            "upcoming": len(upcoming),
            "this_year": len(this_year),
            "overdue": len(overdue),
        },
    }
    return render(request, "staff/promotions_due.html", context)


@_staff_edit_required
@require_POST
def confirm_promotion(request, pk):
    """One-click promotion confirmation from the Promotions Due page.

    - Sets last_promotion_date to today (or POSTed `promotion_date`).
    - Staff.save() re-derives next_promotion_date (+3 years).
    - Creates a StaffPromotion history row using the staff's current
      designation/grade (or POSTed overrides).
    - Dismisses any open PROMOTION_DUE / PROMOTION_OVERDUE notifications.
    - Writes two AuditLog rows (StaffPromotion CREATE, Staff UPDATE).
    """
    staff = get_object_or_404(
        Staff.objects.select_related("designation", "grade_level"), pk=pk
    )

    raw_date = (request.POST.get("promotion_date") or "").strip()
    try:
        promo_date = (
            datetime.strptime(raw_date, "%Y-%m-%d").date() if raw_date else date.today()
        )
    except ValueError:
        return JsonResponse({"ok": False, "error": "Invalid promotion_date."}, status=400)

    if promo_date > date.today():
        return JsonResponse(
            {"ok": False, "error": "Promotion date cannot be in the future."}, status=400
        )
    if staff.first_appointment_date and promo_date < staff.first_appointment_date:
        return JsonResponse(
            {"ok": False, "error": "Promotion date cannot precede first appointment."},
            status=400,
        )

    new_designation = staff.designation
    new_grade = staff.grade_level
    new_grade_step = staff.grade_step
    letter_ref = (request.POST.get("promotion_letter_ref") or "").strip() or None
    remarks = (request.POST.get("remarks") or "").strip() or "Confirmed from Promotions Due page."

    if (request.POST.get("new_designation") or "").isdigit():
        try:
            new_designation = Designation.objects.get(pk=int(request.POST["new_designation"]))
        except Designation.DoesNotExist:
            return JsonResponse({"ok": False, "error": "Designation not found."}, status=400)
    if (request.POST.get("new_grade") or "").isdigit():
        try:
            new_grade = GradeLevel.objects.get(pk=int(request.POST["new_grade"]))
        except GradeLevel.DoesNotExist:
            return JsonResponse({"ok": False, "error": "Grade not found."}, status=400)
    if request.POST.get("new_grade_step"):
        try:
            new_grade_step = int(request.POST["new_grade_step"])
            if new_grade_step < 1 or new_grade_step > 15:
                return JsonResponse({"ok": False, "error": "Step must be 1–15."}, status=400)
        except ValueError:
            return JsonResponse({"ok": False, "error": "Invalid step."}, status=400)

    actor = getattr(request.user, "username", None) or "anonymous"
    actor_email = getattr(request.user, "email", "") or None
    previous_designation_label = staff.designation.title if staff.designation_id else "—"
    previous_grade_label = staff.grade_level.grade_level if staff.grade_level_id else None

    old_snapshot = {
        "designation": previous_designation_label,
        "grade_level": previous_grade_label,
        "grade_step": staff.grade_step,
        "last_promotion_date": staff.last_promotion_date.isoformat()
        if staff.last_promotion_date else None,
        "next_promotion_date": staff.next_promotion_date.isoformat()
        if staff.next_promotion_date else None,
    }

    with transaction.atomic():
        promo = StaffPromotion.objects.create(
            staff=staff,
            promotion_date=promo_date,
            previous_designation=previous_designation_label,
            new_designation=new_designation,
            previous_grade=previous_grade_label,
            new_grade=new_grade,
            new_grade_step=new_grade_step,
            promotion_letter_ref=letter_ref,
            remarks=remarks,
        )

        staff.designation = new_designation
        staff.grade_level = new_grade
        staff.grade_step = new_grade_step
        staff.last_promotion_date = promo_date
        staff.updated_by = actor
        staff.save()

        new_snapshot = {
            "designation": new_designation.title if new_designation else None,
            "grade_level": new_grade.grade_level if new_grade else None,
            "grade_step": staff.grade_step,
            "last_promotion_date": staff.last_promotion_date.isoformat(),
            "next_promotion_date": staff.next_promotion_date.isoformat()
            if staff.next_promotion_date else None,
        }

        from .models import Notification
        Notification.objects.filter(
            staff=staff,
            type__in=("PROMOTION_DUE", "PROMOTION_OVERDUE"),
            is_dismissed=False,
        ).update(is_dismissed=True, is_read=True)

        AuditLog.objects.create(
            user=actor, user_email=actor_email,
            action="CREATE", model_name="StaffPromotion",
            record_id=str(promo.pk),
            record_identifier=f"{staff.staff_id} promotion confirmed on {promo_date.isoformat()}",
            old_values={},
            new_values={
                "promotion_date": promo_date.isoformat(),
                "previous_designation": previous_designation_label,
                "new_designation": new_designation.title if new_designation else None,
                "new_grade": new_grade.grade_level if new_grade else None,
                "new_grade_step": new_grade_step,
                "promotion_letter_ref": letter_ref,
                "remarks": remarks,
            },
            changed_fields=["promotion_date", "new_designation", "new_grade", "new_grade_step"],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method, request_path=request.path,
            status="SUCCESS",
            remarks="Promotion confirmed from Promotions Due page.",
        )

        AuditLog.objects.create(
            user=actor, user_email=actor_email,
            action="UPDATE", model_name="Staff",
            record_id=str(staff.pk),
            record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
            old_values=old_snapshot, new_values=new_snapshot,
            changed_fields=[
                k for k in new_snapshot if old_snapshot.get(k) != new_snapshot.get(k)
            ],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method, request_path=request.path,
            status="SUCCESS",
            remarks="Staff record updated by promotion confirmation.",
        )

    if request.headers.get("X-Requested-With") == "fetch":
        return JsonResponse({
            "ok": True,
            "staff_id": staff.pk,
            "last_promotion_date": staff.last_promotion_date.isoformat(),
            "next_promotion_date": staff.next_promotion_date.isoformat()
            if staff.next_promotion_date else None,
        })
    messages.success(
        request, f"Promotion confirmed for {staff.get_full_name()} on {promo_date.isoformat()}."
    )
    return redirect(reverse("staff:promotions_due"))


def _log_export(request, fmt, applied, row_count):
    AuditLog.objects.create(
        user=getattr(request.user, "username", None) or "anonymous",
        user_email=getattr(request.user, "email", "") or None,
        action="EXPORT",
        model_name="Staff",
        record_id="-",
        record_identifier=f"Staff list export ({fmt}, {row_count} rows)",
        new_values={"filters": applied, "format": fmt, "rows": row_count},
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        request_method=request.method,
        request_path=request.path,
        status="SUCCESS",
    )


@login_required
def staff_export_csv(request):
    queryset, applied = _filtered_staff_queryset(request)
    row_count = queryset.count()
    _log_export(request, "csv", applied, row_count)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = (
        f'attachment; filename="staff_export_{date.today().isoformat()}.csv"'
    )

    writer = csv.writer(response)
    queryset = queryset.iterator(chunk_size=200)  # streaming-friendly

    writer.writerow([
        "Staff ID",
        "Full Name",
        "Department",
        "Designation",
        "Grade Level",
        "Step",
        "Posting Location",
        "Next Promotion",
        "Retirement Date",
    ])
    for s in queryset:
        writer.writerow([
            s.staff_id,
            s.get_full_name(),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            s.grade_level.grade_level if s.grade_level_id else "",
            s.grade_step,
            s.posting_location.name if s.posting_location_id else "",
            s.next_promotion_date.isoformat() if s.next_promotion_date else "",
            s.retirement_date.isoformat() if s.retirement_date else "",
        ])
    return response


@login_required
def staff_export_pdf(request):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError:
        return HttpResponse(
            "PDF export requires the 'reportlab' package. "
            "Install it with: pip install reportlab",
            status=501,
            content_type="text/plain",
        )

    queryset, applied = _filtered_staff_queryset(request)
    row_count = queryset.count()
    _log_export(request, "pdf", applied, row_count)

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="staff_export_{date.today().isoformat()}.pdf"'
    )

    doc = SimpleDocTemplate(
        response,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
        title="CCA Staff Report",
    )

    styles = getSampleStyleSheet()
    story = [
        Paragraph("Customary Court of Appeal — Staff Report", styles["Title"]),
        Paragraph(
            f"Generated {date.today().isoformat()} • {queryset.count()} record(s)"
            + (f" • search: '{applied['q']}'" if applied["q"] else ""),
            styles["Normal"],
        ),
        Spacer(1, 12),
    ]

    data = [[
        "Staff ID", "Name", "Department", "Designation",
        "Grade", "Location", "Next Promotion", "Retirement",
    ]]
    for s in queryset.iterator(chunk_size=200):
        data.append([
            s.staff_id,
            s.get_full_name(),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.posting_location.name if s.posting_location_id else "",
            s.next_promotion_date.isoformat() if s.next_promotion_date else "—",
            s.retirement_date.isoformat() if s.retirement_date else "—",
        ])

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f4e3d")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f9")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)
    doc.build(story)
    return response


# ==================== RETIREMENT MONITOR ====================

RETIREMENT_BUCKETS = [
    # key, label, css, days_min_inclusive, days_max_inclusive (None = no upper bound)
    ("overdue",  "Already retired / overdue",   "danger",  None, -1),
    ("6m",       "Retiring within 6 months",    "orange",  0,    183),
    ("1y",       "Retiring within 1 year",      "amber",   184,  365),
    ("2y",       "Retiring within 2 years",     "yellow",  366,  730),
    ("safe",     "More than 2 years away",      "green",   731,  None),
]


def _bucket_for_days(days):
    """Map (retirement_date - today).days to a bucket key."""
    if days is None:
        return None
    if days < 0:
        return "overdue"
    if days <= 183:
        return "6m"
    if days <= 365:
        return "1y"
    if days <= 730:
        return "2y"
    return "safe"


def _retirement_queryset():
    """Active staff with a known retirement date, with all FKs for display."""
    return (
        Staff.objects.filter(is_active=True, retirement_date__isnull=False)
        .select_related("department", "designation", "grade_level", "posting_location")
        .only(
            "id", "staff_id", "first_name", "middle_name", "last_name",
            "passport_photo", "date_of_birth", "first_appointment_date",
            "retirement_date", "retirement_date_age_60",
            "retirement_date_service_35", "retirement_basis",
            "years_remaining_to_retirement", "months_remaining_to_retirement",
            "years_of_service", "employment_status",
            "department__name",
            "designation__title",
            "grade_level__grade_level", "grade_step",
            "posting_location__name", "posting_location__state",
        )
    )


@login_required
def retirement_monitor(request):
    """Retirement monitor page: groups active staff into urgency buckets
    keyed off the earlier of (age-60, 35-years-service)."""
    today = date.today()

    qs = _retirement_queryset()
    department_id = (request.GET.get("department") or "").strip()
    q = (request.GET.get("q") or "").strip()
    if department_id.isdigit():
        qs = qs.filter(department_id=int(department_id))
    if q:
        qs = qs.filter(
            Q(first_name__icontains=q)
            | Q(middle_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(staff_id__icontains=q)
        )

    buckets = {key: [] for key, *_ in RETIREMENT_BUCKETS}
    for staff in qs.order_by("retirement_date"):
        days_left = (staff.retirement_date - today).days
        staff.days_to_retirement = days_left
        staff.bucket_key = _bucket_for_days(days_left)
        buckets[staff.bucket_key].append(staff)

    bucket_views = [
        {
            "key": key,
            "label": label,
            "css": css,
            "rows": buckets[key],
            "count": len(buckets[key]),
        }
        for (key, label, css, _, _) in RETIREMENT_BUCKETS
    ]
    totals = {b["key"]: b["count"] for b in bucket_views}
    totals["all"] = sum(totals.values())

    return render(request, "staff/retirement_monitor.html", {
        "today": today,
        "buckets": bucket_views,
        "totals": totals,
        "applied": {"q": q, "department": department_id},
        "departments": Department.objects.filter(is_active=True).order_by("name"),
    })


@login_required
def retirement_export_csv(request):
    """Full retirement projection report as CSV. Honours the same filters
    as the monitor page."""
    today = date.today()
    qs = _retirement_queryset()
    department_id = (request.GET.get("department") or "").strip()
    q = (request.GET.get("q") or "").strip()
    if department_id.isdigit():
        qs = qs.filter(department_id=int(department_id))
    if q:
        qs = qs.filter(
            Q(first_name__icontains=q)
            | Q(middle_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(staff_id__icontains=q)
        )
    qs = qs.order_by("retirement_date")

    row_count = qs.count()
    _log_export(
        request, "csv",
        {"q": q, "department": department_id, "report": "retirement"},
        row_count,
    )

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = (
        f'attachment; filename="retirement_projection_{today.isoformat()}.csv"'
    )
    writer = csv.writer(response)
    writer.writerow([
        "Staff ID", "Full Name", "Department", "Designation",
        "Grade/Step", "Posting Location",
        "Date of Birth", "First Appointment",
        "Years of Service",
        "Retires at Age 60", "Retires at 35 Years Service",
        "Effective Retirement Date", "Basis",
        "Days Remaining", "Years Remaining", "Months Remaining",
        "Bucket",
    ])
    BUCKET_LABELS = {key: label for key, label, *_ in RETIREMENT_BUCKETS}
    for s in qs.iterator(chunk_size=200):
        days_left = (s.retirement_date - today).days
        writer.writerow([
            s.staff_id,
            s.get_full_name(),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.posting_location.name if s.posting_location_id else "",
            s.date_of_birth.isoformat() if s.date_of_birth else "",
            s.first_appointment_date.isoformat() if s.first_appointment_date else "",
            s.years_of_service,
            s.retirement_date_age_60.isoformat() if s.retirement_date_age_60 else "",
            s.retirement_date_service_35.isoformat() if s.retirement_date_service_35 else "",
            s.retirement_date.isoformat(),
            s.get_retirement_basis_display() if s.retirement_basis else "",
            days_left,
            s.years_remaining_to_retirement,
            s.months_remaining_to_retirement,
            BUCKET_LABELS.get(_bucket_for_days(days_left), ""),
        ])
    return response


# ==================== STAFF LOCATION TRACKING ====================


def _location_staff_only_fields():
    """Columns needed to render a staff card under a location."""
    return (
        "id", "staff_id", "first_name", "middle_name", "last_name",
        "passport_photo", "is_active",
        "department__name", "department__department_code",
        "designation__title",
        "grade_level__grade_level", "grade_step",
        "posting_location_id",
    )


@login_required
def locations_overview(request):
    """List all posting locations with the staff currently assigned to each.

    - Each location is rendered with a headcount and an expandable staff list.
    - Each staff entry links to their profile.
    - Includes a synthetic "Unassigned" bucket for active staff with no
      posting_location set, so HR can see and reassign them.
    """
    q = (request.GET.get("q") or "").strip()

    staff_qs = (
        Staff.objects.filter(is_active=True)
        .select_related("department", "designation", "grade_level")
        .only(*_location_staff_only_fields())
        .order_by("last_name", "first_name")
    )

    locations = (
        PostingLocation.objects.filter(is_active=True)
        .annotate(headcount=Count(
            "staff",
            filter=Q(staff__is_active=True),
            distinct=True,
        ))
        .prefetch_related(Prefetch("staff_set", queryset=staff_qs, to_attr="assigned_staff"))
        .order_by("state", "city", "name")
    )

    if q:
        # Filter the locations themselves; staff search lives on the staff list page.
        locations = locations.filter(
            Q(name__icontains=q)
            | Q(city__icontains=q)
            | Q(state__icontains=q)
            | Q(location_code__icontains=q)
        )

    unassigned_staff = list(staff_qs.filter(posting_location__isnull=True)) if not q else []

    total_assigned = sum(loc.headcount for loc in locations)
    context = {
        "locations": locations,
        "unassigned_staff": unassigned_staff,
        "unassigned_count": len(unassigned_staff),
        "total_locations": len(locations),
        "total_assigned": total_assigned,
        "applied": {"q": q},
    }
    return render(request, "staff/locations_overview.html", context)


@login_required
def deployment_overview(request):
    """Single flat table of every active posting location and its current
    headcount (active staff). Sortable by name or headcount."""
    sort = request.GET.get("sort") or "name"
    order_by = {
        "name": ("state", "city", "name"),
        "-name": ("-state", "-city", "-name"),
        "headcount": ("headcount", "name"),
        "-headcount": ("-headcount", "name"),
    }.get(sort, ("state", "city", "name"))

    rows = (
        PostingLocation.objects.filter(is_active=True)
        .annotate(headcount=Count(
            "staff",
            filter=Q(staff__is_active=True),
            distinct=True,
        ))
        .order_by(*order_by)
    )

    unassigned_count = Staff.objects.filter(
        is_active=True, posting_location__isnull=True
    ).count()

    total_assigned = sum(r.headcount for r in rows)
    return render(request, "staff/deployment_overview.html", {
        "rows": list(rows),
        "unassigned_count": unassigned_count,
        "total_assigned": total_assigned,
        "total_locations": len(rows),
        "sort": sort,
    })


@_staff_edit_required
@require_POST
def transfer_staff(request, pk):
    """Transfer a staff member to a new posting location.

    POST fields:
      - to_location (PostingLocation pk, required; "" allowed = unassign)
      - transfer_date (YYYY-MM-DD, required)
      - notes (optional)

    Side effects:
      - Updates Staff.posting_location.
      - Creates a StaffTransfer history row (from_location = previous value).
      - Writes a Staff UPDATE AuditLog entry.

    Returns JSON describing the new posting + transfer row.
    """
    staff = get_object_or_404(
        Staff.objects.select_related("posting_location"), pk=pk
    )

    raw_to = (request.POST.get("to_location") or "").strip()
    raw_date = (request.POST.get("transfer_date") or "").strip()
    notes = (request.POST.get("notes") or "").strip() or None

    errors = {}

    new_location = None
    if raw_to:
        if not raw_to.isdigit():
            errors["to_location"] = "Invalid location."
        else:
            try:
                new_location = PostingLocation.objects.get(pk=int(raw_to))
            except PostingLocation.DoesNotExist:
                errors["to_location"] = "Location not found."

    transfer_date = None
    if not raw_date:
        errors["transfer_date"] = "Required."
    else:
        try:
            transfer_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            errors["transfer_date"] = "Use YYYY-MM-DD."
        else:
            if staff.first_appointment_date and transfer_date < staff.first_appointment_date:
                errors["transfer_date"] = "Cannot be before first appointment."

    old_location = staff.posting_location  # FK instance or None
    if new_location is None and old_location is None and not errors:
        errors["to_location"] = "Already unassigned."
    elif new_location is not None and old_location is not None \
            and new_location.pk == old_location.pk and not errors:
        errors["to_location"] = "Staff is already at this location."

    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    actor = getattr(request.user, "username", None) or "anonymous"
    actor_email = getattr(request.user, "email", "") or None
    old_label = str(old_location) if old_location else None
    new_label = str(new_location) if new_location else None

    with transaction.atomic():
        transfer = StaffTransfer.objects.create(
            staff=staff,
            from_location=old_location,
            to_location=new_location,
            transfer_date=transfer_date,
            notes=notes,
            created_by=actor,
        )

        staff.posting_location = new_location
        staff.updated_by = actor
        staff.save(update_fields=[
            "posting_location", "updated_by", "updated_at",
        ])

        AuditLog.objects.create(
            user=actor,
            user_email=actor_email,
            action="UPDATE",
            model_name="Staff",
            record_id=str(staff.pk),
            record_identifier=f"{staff.staff_id} - {staff.get_full_name()}",
            old_values={"posting_location": old_label},
            new_values={"posting_location": new_label},
            changed_fields=["posting_location"],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            request_method=request.method,
            request_path=request.path,
            status="SUCCESS",
            remarks=(
                f"Transfer recorded (StaffTransfer #{transfer.pk}) "
                f"effective {transfer_date.isoformat()}."
                + (f" Notes: {notes}" if notes else "")
            ),
        )

    return JsonResponse({
        "ok": True,
        "transfer": {
            "id": transfer.pk,
            "transfer_date": transfer_date.isoformat(),
            "from_location": old_label,
            "to_location": new_label,
            "notes": notes or "",
        },
        "staff": {
            "id": staff.pk,
            "posting_location": (
                {"id": new_location.pk, "label": str(new_location)}
                if new_location else None
            ),
        },
    })


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]


class PostingLocationViewSet(viewsets.ModelViewSet):
    queryset = PostingLocation.objects.all()
    serializer_class = PostingLocationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "city", "state"]


class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["rank_order", "title"]


class GradeLevelViewSet(viewsets.ModelViewSet):
    queryset = GradeLevel.objects.all()
    serializer_class = GradeLevelSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["level"]


class StaffResultsPagination(PageNumberPagination):
    """Pagination for the Staff API.

    The global default (PAGE_SIZE=25, no ``page_size`` override) capped the
    SPA at 25 rows even though it asked for ``page_size=1000`` — so large
    directories (e.g. after a bulk import) appeared to be missing everyone
    past the first 25. Honour a client-supplied ``page_size`` up to a ceiling
    so the desktop/web client can pull the full roster; it still follows the
    ``next`` links for anything beyond one page.

    ``max_page_size`` is deliberately modest: the full StaffSerializer emits
    ~80 fields per row, and materialising 1000 of them at once used enough RAM
    that concurrent full-roster pulls (desktop + web) OOM-killed the 512 MB
    instance (exit 137) — Render then restarted it, which was the recurring
    ~35s outage. 250/page keeps peak memory per request ~4x lower; the client
    just walks a few more ``next`` pages, which it already does.
    """

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 250


class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.select_related(
        "department", "posting_location", "designation", "grade_level"
    ).all()
    serializer_class = StaffSerializer
    pagination_class = StaffResultsPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    # Reads: any authenticated user. Writes (create / update / destroy /
    # bulk_delete): super_admin or admin_staff only. RoleBasedReadWrite
    # implements that split — see accounts.permissions.
    permission_classes = [IsAuthenticated, RoleBasedReadWrite]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "staff_id",
        "first_name",
        "middle_name",
        "last_name",
        "department__name",
        "designation__title",
    ]
    ordering_fields = ["last_name", "first_appointment_date", "retirement_date"]

    # ------------------------------------------------------------------
    # Audit trail: stamp the acting user on every write so the AuditLog
    # rows have something to attribute changes to (DRF's TokenAuth runs
    # after the auditlog middleware, so we can't rely on the middleware
    # alone — it sees AnonymousUser for SPA requests).
    # ------------------------------------------------------------------
    def _actor(self, request):
        u = getattr(request, "user", None)
        if u and u.is_authenticated:
            return getattr(u, "username", "") or (getattr(u, "email", "") or "system")
        return "system"

    def create(self, request, *args, **kwargs):
        """Create a staff row, or UPDATE the existing one when the posted
        ``staff_id`` already exists.

        This is what makes "upload a file and update existing records" work:
        the SPA's bulk import POSTs one row per staff member. Previously a row
        whose ``staff_id`` was already in the database was rejected with a
        409/400 "staff with this staff_id already exists" and counted as a
        failed row. Now that row updates the existing record instead.

        The update is partial, so columns the import file leaves blank keep
        their current values rather than being wiped.
        """
        staff_id = str(request.data.get("staff_id") or "").strip()
        try:
            if staff_id:
                existing = Staff.objects.filter(staff_id=staff_id).first()
                if existing is not None:
                    serializer = self.get_serializer(existing, data=request.data, partial=True)
                    serializer.is_valid(raise_exception=True)
                    with transaction.atomic():
                        self.perform_update(serializer)
                    headers = self.get_success_headers(serializer.data)
                    # 200 (not 201) signals "updated an existing record".
                    return Response(serializer.data, status=drf_status.HTTP_200_OK, headers=headers)
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as exc:
            # A unique-constraint clash (most often a duplicate email shared by
            # two rows in an uploaded file). Report this row cleanly as a 400 so
            # the bulk import records one failed row instead of a 500, and the
            # rest of the file still imports. The savepoint above keeps the
            # connection usable after the rollback.
            detail = "email already in use" if "email" in str(exc).lower() else str(exc)
            return Response({"detail": f"Could not save staff: {detail}"},
                            status=drf_status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(created_by=self._actor(self.request), updated_by=self._actor(self.request))

    def perform_update(self, serializer):
        serializer.save(updated_by=self._actor(self.request))

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        """Delete several staff rows in one call.

        Body: ``{"ids": [1, 2, 3]}``
        Returns: ``{"deleted": N, "missing": [<ids not found>]}``

        Permission: RoleBasedReadWrite already gates this to super_admin /
        admin_staff / Django superuser because POST is a write method.
        """
        raw_ids = request.data.get("ids") or []
        if not isinstance(raw_ids, (list, tuple)):
            return Response(
                {"detail": "Expected 'ids' to be a list of staff primary keys."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        ids = []
        for value in raw_ids:
            try:
                ids.append(int(value))
            except (TypeError, ValueError):
                continue
        if not ids:
            return Response(
                {"detail": "Provide at least one valid integer id in 'ids'."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        found_qs = Staff.objects.filter(pk__in=ids)
        found_ids = set(found_qs.values_list("pk", flat=True))
        missing = [i for i in ids if i not in found_ids]

        # Record an audit row before the rows themselves vanish.
        actor = self._actor(request)
        try:
            from audit.models import AuditLog
            AuditLog.objects.create(
                user=actor,
                action="DELETE",
                model_name="Staff",
                record_id=",".join(str(i) for i in found_ids),
                record_identifier=f"bulk_delete x{len(found_ids)}",
                new_values={"ids": list(found_ids), "requested": ids, "missing": missing},
                ip_address=_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                request_method=request.method,
                request_path=request.path,
                status="SUCCESS",
                remarks="Bulk delete via /api/staff/bulk-delete/.",
            )
        except Exception:
            # Don't let an auditlog hiccup block the actual delete.
            pass

        deleted_count, _ = found_qs.delete()
        return Response({"deleted": deleted_count, "missing": missing})


# ==================== BULK IMPORT VIEWS ====================
# Function-style import aliases are imported from .import_wrapper at the top
# of this module — they are already in scope and exported via this file.
