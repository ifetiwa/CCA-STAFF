"""Reports module.

Each report follows the same pattern:

1. A single page (``<report>``) that shows the filter form, an HTML preview
   of the matching rows, and "Export PDF"/"Export Excel" buttons.
2. Two export endpoints (``<report>_pdf`` / ``<report>_excel``) that re-apply
   the same filters and stream a download.

Filters are passed via GET query string so the export buttons can re-use
``?{{ request.GET.urlencode }}`` without storing report state on the server.
"""
from __future__ import annotations

import json
from collections import OrderedDict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from django.contrib.auth.decorators import login_required
from django.db.models import Q, QuerySet
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render

from departments.models import Department, GradeLevel, PostingLocation
from staff.models import Staff

from .exporters import log_report_export, render_csv, render_excel, render_pdf
from .nigeria_geo import format_long_date, geopolitical_zone, senatorial_district

TESTING_CHECKLIST_FILE = (
    Path(__file__).resolve().parents[2] / "src" / "data" / "testing_checklist.json"
)


def _load_testing_checklist() -> dict:
    with TESTING_CHECKLIST_FILE.open("r", encoding="utf-8") as fh:
        return json.load(fh)

# Preview is capped so the HTML page stays snappy even when the underlying
# queryset has thousands of rows. The PDF/Excel exports always include the
# full result set.
PREVIEW_LIMIT = 200


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _parse_date(raw: str) -> Optional[date]:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_int(raw: str) -> Optional[int]:
    raw = (raw or "").strip()
    return int(raw) if raw.isdigit() else None


def _filter_context():
    """Lookup data shared by every filter form."""
    return {
        "departments": Department.objects.filter(is_active=True).order_by("name"),
        "grade_levels": GradeLevel.objects.filter(is_active=True).order_by("grade_level"),
        "locations": PostingLocation.objects.filter(is_active=True).order_by("state", "name"),
    }


def _base_staff_qs() -> QuerySet:
    return (
        Staff.objects.filter(is_active=True)
        .select_related("department", "designation", "grade_level", "posting_location")
    )


def _apply_common(qs: QuerySet, request) -> tuple[QuerySet, OrderedDict]:
    """Apply department / location / grade filters. Returns the queryset and
    an ordered dict of human-readable filter labels for the report header."""
    applied = OrderedDict()

    dept = _parse_int(request.GET.get("department"))
    if dept is not None:
        qs = qs.filter(department_id=dept)
        try:
            applied["Department"] = Department.objects.get(pk=dept).name
        except Department.DoesNotExist:
            pass

    loc = _parse_int(request.GET.get("posting_location"))
    if loc is not None:
        qs = qs.filter(posting_location_id=loc)
        try:
            applied["Location"] = PostingLocation.objects.get(pk=loc).name
        except PostingLocation.DoesNotExist:
            pass

    grade = _parse_int(request.GET.get("grade_level"))
    if grade is not None:
        qs = qs.filter(grade_level_id=grade)
        try:
            applied["Grade Level"] = GradeLevel.objects.get(pk=grade).grade_level
        except GradeLevel.DoesNotExist:
            pass

    return qs, applied


def _filters_summary(applied: OrderedDict) -> str:
    if not applied:
        return "None"
    return "; ".join(f"{k}: {v}" for k, v in applied.items())


def _full_name(s) -> str:
    return s.get_full_name() if hasattr(s, "get_full_name") else f"{s.first_name} {s.last_name}"


def _name_parts(s):
    """Split a staff member's name into (title, surname, first, other names).

    The courtesy title lives in its own column so it is never mixed into the
    name — surname (last_name), first name and any other/middle names are kept
    separate, matching the "Surname, First Name & Other Names" convention.
    """
    return (
        (s.title or "").strip(),
        (s.last_name or "").strip(),
        (s.first_name or "").strip(),
        (s.middle_name or "").strip(),
    )


# ---------------------------------------------------------------------------
# Landing page
# ---------------------------------------------------------------------------

@login_required
def index(request):
    return render(request, "reports/index.html")


# ===========================================================================
# 1. Full Staff Register
# ===========================================================================

FULL_REGISTER_COLUMNS = [
    "Staff ID", "Title", "Surname", "First Name", "Other Names",
    "Gender", "Date of Birth", "State of Origin", "LGA",
    "Senatorial District", "Geopolitical Zone",
    "Department", "Designation", "Grade/Step", "Posting Location",
    "Phone", "Email", "First Appointment", "Years of Service",
    "Last Promotion", "Next Promotion", "Retirement Date", "Status",
]


def _full_register_data(request):
    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.order_by("last_name", "first_name")
    rows = []
    for s in qs.iterator(chunk_size=300):
        title, surname, first, other = _name_parts(s)
        rows.append([
            s.staff_id,
            title, surname, first, other,
            s.get_gender_display() if s.gender else "",
            format_long_date(s.date_of_birth),
            s.state_of_origin or "",
            s.local_government_area or "",
            senatorial_district(s.state_of_origin, s.local_government_area),
            geopolitical_zone(s.state_of_origin),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.posting_location.name if s.posting_location_id else "",
            s.phone_number or "",
            s.email or "",
            format_long_date(s.first_appointment_date),
            s.years_of_service,
            format_long_date(s.last_promotion_date),
            format_long_date(s.next_promotion_date),
            format_long_date(s.retirement_date),
            s.employment_status,
        ])
    return rows, applied


@login_required
def full_register(request):
    rows, applied = _full_register_data(request)
    ctx = {
        "title": "Full Staff Register",
        "columns": FULL_REGISTER_COLUMNS,
        "rows": rows[:PREVIEW_LIMIT],
        "row_count": len(rows),
        "preview_limit": PREVIEW_LIMIT,
        "truncated": len(rows) > PREVIEW_LIMIT,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "report_key": "full_register",
        "has_csv": True,
        **_filter_context(),
    }
    return render(request, "reports/full_register.html", ctx)


@login_required
def full_register_csv(request):
    rows, applied = _full_register_data(request)
    log_report_export(request, "full_register", "csv", dict(applied), len(rows))
    return render_csv(
        columns=FULL_REGISTER_COLUMNS,
        rows=rows,
        filename=f"full_staff_register_{date.today().isoformat()}.csv",
    )


@login_required
def full_register_pdf(request):
    rows, applied = _full_register_data(request)
    log_report_export(request, "full_register", "pdf", dict(applied), len(rows))
    return render_pdf(
        title="Full Staff Register",
        subtitle=f"All active staff — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=FULL_REGISTER_COLUMNS,
        rows=rows,
        filename=f"full_staff_register_{date.today().isoformat()}.pdf",
    )


@login_required
def full_register_excel(request):
    rows, applied = _full_register_data(request)
    log_report_export(request, "full_register", "xlsx", dict(applied), len(rows))
    return render_excel(
        title="Full Staff Register",
        subtitle=f"All active staff — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=FULL_REGISTER_COLUMNS,
        rows=rows,
        filename=f"full_staff_register_{date.today().isoformat()}.xlsx",
        sheet_name="Staff Register",
    )


# ===========================================================================
# 1b. Staff Nominal Roll (full biodata, one row per officer)
# ===========================================================================

NOMINAL_ROLL_COLUMNS = [
    "S/N", "Staff ID", "File Number", "Title", "Surname", "First Name",
    "Other Names", "Gender", "Marital Status", "Date of Birth",
    "State of Origin", "LGA", "Senatorial District", "Geopolitical Zone",
    "Department", "Designation", "Grade Level", "Step", "Posting Location",
    "Phone Number", "Email", "NIN",
    "First Appointment", "Date Confirmed", "Present Appointment",
    "Last Promotion", "Next Promotion", "Years of Service", "Retirement Date",
    "Employment Type", "Employment Status", "Pay Status",
    "Bank", "Account Number", "PFA", "RSA PIN",
    "Residential Address", "Permanent Address",
]


def _nominal_roll_data(request):
    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.order_by("last_name", "first_name")
    rows = []
    for i, s in enumerate(qs.iterator(chunk_size=300), start=1):
        title, surname, first, other = _name_parts(s)
        rows.append([
            i,
            s.staff_id,
            s.file_number or "",
            title, surname, first, other,
            s.get_gender_display() if s.gender else "",
            s.get_marital_status_display() if s.marital_status else "",
            format_long_date(s.date_of_birth),
            s.state_of_origin or "",
            s.local_government_area or "",
            senatorial_district(s.state_of_origin, s.local_government_area),
            geopolitical_zone(s.state_of_origin),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            s.grade_level.grade_level if s.grade_level_id else "",
            s.grade_step if s.grade_level_id else "",
            s.posting_location.name if s.posting_location_id else (s.location or ""),
            s.phone_number or "",
            s.email or "",
            s.nin or "",
            format_long_date(s.first_appointment_date),
            format_long_date(s.date_confirmed),
            format_long_date(s.present_appointment_date),
            format_long_date(s.last_promotion_date),
            format_long_date(s.next_promotion_date),
            s.years_of_service,
            format_long_date(s.retirement_date),
            s.get_employment_type_display() if s.employment_type else "",
            s.get_employment_status_display() if s.employment_status else "",
            s.pay_status or "",
            s.bank_name or "",
            s.account_number or "",
            s.pension_administrator or "",
            s.rsa_pin or "",
            s.residential_address or "",
            s.permanent_address or "",
        ])
    return rows, applied


# The preview table caps very wide tables to a readable subset of columns; the
# CSV / Excel downloads always contain the full column set above.
NOMINAL_ROLL_PREVIEW_COLUMNS = [
    "S/N", "Staff ID", "Title", "Surname", "First Name", "Other Names",
    "Gender", "Date of Birth", "State of Origin", "Senatorial District",
    "Geopolitical Zone", "Department", "Grade Level", "Step",
]
_NR_PREVIEW_IDX = [NOMINAL_ROLL_COLUMNS.index(c) for c in NOMINAL_ROLL_PREVIEW_COLUMNS]


@login_required
def nominal_roll(request):
    rows, applied = _nominal_roll_data(request)
    preview = [[r[i] for i in _NR_PREVIEW_IDX] for r in rows[:PREVIEW_LIMIT]]
    ctx = {
        "title": "Staff Nominal Roll",
        "columns": NOMINAL_ROLL_PREVIEW_COLUMNS,
        "rows": preview,
        "row_count": len(rows),
        "preview_limit": PREVIEW_LIMIT,
        "truncated": len(rows) > PREVIEW_LIMIT,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "report_key": "nominal_roll",
        "has_csv": True,
        "no_pdf": True,
        "preview_note": (
            "Preview shows core columns only — the CSV / Excel download contains "
            f"all {len(NOMINAL_ROLL_COLUMNS)} fields (including LGA, NIN, bank, "
            "pension, addresses and every milestone date, written out in full)."
        ),
        **_filter_context(),
    }
    return render(request, "reports/nominal_roll.html", ctx)


@login_required
def nominal_roll_csv(request):
    rows, applied = _nominal_roll_data(request)
    log_report_export(request, "nominal_roll", "csv", dict(applied), len(rows))
    return render_csv(
        columns=NOMINAL_ROLL_COLUMNS,
        rows=rows,
        filename=f"staff_nominal_roll_{date.today().isoformat()}.csv",
    )


@login_required
def nominal_roll_excel(request):
    rows, applied = _nominal_roll_data(request)
    log_report_export(request, "nominal_roll", "xlsx", dict(applied), len(rows))
    return render_excel(
        title="Staff Nominal Roll",
        subtitle=f"All active staff — full biodata — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=NOMINAL_ROLL_COLUMNS,
        rows=rows,
        filename=f"staff_nominal_roll_{date.today().isoformat()}.xlsx",
        sheet_name="Nominal Roll",
    )


# ===========================================================================
# 2. Promotion Due Report
# ===========================================================================

PROMOTION_COLUMNS = [
    "Staff ID", "Full Name", "Department", "Designation",
    "Grade/Step", "Last Promotion", "Next Promotion",
    "Days From Today", "Posting Location",
]


def _promotion_due_data(request):
    horizon_raw = (request.GET.get("horizon") or "6").strip()
    horizon_months = 12 if horizon_raw == "12" else 6
    today = date.today()
    cutoff = today + timedelta(days=int(horizon_months * 30.4375))

    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.filter(
        next_promotion_date__isnull=False,
        next_promotion_date__lte=cutoff,
    ).order_by("next_promotion_date")

    applied["Horizon"] = f"next {horizon_months} months"

    rows = []
    for s in qs.iterator(chunk_size=300):
        days = (s.next_promotion_date - today).days
        rows.append([
            s.staff_id,
            _full_name(s),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.last_promotion_date.isoformat() if s.last_promotion_date else "—",
            s.next_promotion_date.isoformat(),
            days,
            s.posting_location.name if s.posting_location_id else "",
        ])
    return rows, applied, horizon_months


@login_required
def promotion_due(request):
    rows, applied, horizon = _promotion_due_data(request)
    ctx = {
        "title": "Promotion Due Report",
        "columns": PROMOTION_COLUMNS,
        "rows": rows[:PREVIEW_LIMIT],
        "row_count": len(rows),
        "preview_limit": PREVIEW_LIMIT,
        "truncated": len(rows) > PREVIEW_LIMIT,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "horizon": horizon,
        "report_key": "promotion_due",
        **_filter_context(),
    }
    return render(request, "reports/promotion_due.html", ctx)


@login_required
def promotion_due_pdf(request):
    rows, applied, horizon = _promotion_due_data(request)
    log_report_export(request, "promotion_due", "pdf", dict(applied), len(rows))
    return render_pdf(
        title="Promotion Due Report",
        subtitle=f"Staff eligible for promotion in next {horizon} months — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=PROMOTION_COLUMNS,
        rows=rows,
        filename=f"promotion_due_{horizon}m_{date.today().isoformat()}.pdf",
    )


@login_required
def promotion_due_excel(request):
    rows, applied, horizon = _promotion_due_data(request)
    log_report_export(request, "promotion_due", "xlsx", dict(applied), len(rows))
    return render_excel(
        title="Promotion Due Report",
        subtitle=f"Staff eligible for promotion in next {horizon} months — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=PROMOTION_COLUMNS,
        rows=rows,
        filename=f"promotion_due_{horizon}m_{date.today().isoformat()}.xlsx",
        sheet_name="Promotion Due",
    )


# ===========================================================================
# 3. Retirement Projection Report
# ===========================================================================

RETIREMENT_COLUMNS = [
    "Staff ID", "Full Name", "Department", "Designation",
    "Grade/Step", "DOB", "First Appointment", "Years of Service",
    "Retire @ Age 60", "Retire @ 35 Years", "Effective Date", "Basis",
    "Years Left", "Posting Location",
]


def _retirement_data(request):
    horizon_raw = (request.GET.get("horizon") or "1").strip()
    horizon_years = {"1": 1, "2": 2, "5": 5}.get(horizon_raw, 1)
    today = date.today()
    cutoff = date(today.year + horizon_years, today.month,
                  min(today.day, 28))

    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.filter(
        retirement_date__isnull=False,
        retirement_date__lte=cutoff,
    ).order_by("retirement_date")

    applied["Horizon"] = f"next {horizon_years} year(s)"

    rows = []
    for s in qs.iterator(chunk_size=300):
        rows.append([
            s.staff_id,
            _full_name(s),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.date_of_birth.isoformat() if s.date_of_birth else "",
            s.first_appointment_date.isoformat() if s.first_appointment_date else "",
            s.years_of_service,
            s.retirement_date_age_60.isoformat() if s.retirement_date_age_60 else "",
            s.retirement_date_service_35.isoformat() if s.retirement_date_service_35 else "",
            s.retirement_date.isoformat(),
            s.get_retirement_basis_display() if s.retirement_basis else "",
            s.years_remaining_to_retirement,
            s.posting_location.name if s.posting_location_id else "",
        ])
    return rows, applied, horizon_years


@login_required
def retirement_projection(request):
    rows, applied, horizon = _retirement_data(request)
    ctx = {
        "title": "Retirement Projection Report",
        "columns": RETIREMENT_COLUMNS,
        "rows": rows[:PREVIEW_LIMIT],
        "row_count": len(rows),
        "preview_limit": PREVIEW_LIMIT,
        "truncated": len(rows) > PREVIEW_LIMIT,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "horizon": horizon,
        "report_key": "retirement_projection",
        **_filter_context(),
    }
    return render(request, "reports/retirement_projection.html", ctx)


@login_required
def retirement_projection_pdf(request):
    rows, applied, horizon = _retirement_data(request)
    log_report_export(request, "retirement_projection", "pdf", dict(applied), len(rows))
    return render_pdf(
        title="Retirement Projection Report",
        subtitle=f"Staff retiring in next {horizon} year(s) — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=RETIREMENT_COLUMNS,
        rows=rows,
        filename=f"retirement_projection_{horizon}y_{date.today().isoformat()}.pdf",
    )


@login_required
def retirement_projection_excel(request):
    rows, applied, horizon = _retirement_data(request)
    log_report_export(request, "retirement_projection", "xlsx", dict(applied), len(rows))
    return render_excel(
        title="Retirement Projection Report",
        subtitle=f"Staff retiring in next {horizon} year(s) — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=RETIREMENT_COLUMNS,
        rows=rows,
        filename=f"retirement_projection_{horizon}y_{date.today().isoformat()}.xlsx",
        sheet_name="Retirement",
    )


# ===========================================================================
# 4. Staff by Department Report (grouped)
# ===========================================================================

GROUP_COLUMNS = [
    "Staff ID", "Full Name", "Designation", "Grade/Step",
    "Posting Location", "First Appointment", "Next Promotion",
    "Retirement Date",
]


def _row_for_group(s):
    return [
        s.staff_id,
        _full_name(s),
        s.designation.title if s.designation_id else "",
        f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
        s.posting_location.name if s.posting_location_id else "",
        s.first_appointment_date.isoformat() if s.first_appointment_date else "",
        s.next_promotion_date.isoformat() if s.next_promotion_date else "",
        s.retirement_date.isoformat() if s.retirement_date else "",
    ]


def _by_department_data(request):
    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.order_by("department__name", "last_name", "first_name")

    grouped: dict[str, list] = OrderedDict()
    for s in qs.iterator(chunk_size=300):
        key = s.department.name if s.department_id else "— (no department) —"
        grouped.setdefault(key, []).append(_row_for_group(s))

    groups = [
        {"label": name, "rows": rows, "subtotal": len(rows)}
        for name, rows in grouped.items()
    ]
    return groups, applied


@login_required
def by_department(request):
    groups, applied = _by_department_data(request)
    total = sum(g["subtotal"] for g in groups)
    # Truncate preview rows but keep all group labels visible
    preview_groups = []
    remaining = PREVIEW_LIMIT
    truncated = False
    for g in groups:
        if remaining <= 0:
            truncated = True
            break
        take = g["rows"][:remaining]
        preview_groups.append({
            "label": g["label"], "rows": take, "subtotal": g["subtotal"],
        })
        remaining -= len(take)
        if len(take) < len(g["rows"]):
            truncated = True
    ctx = {
        "title": "Staff by Department",
        "columns": GROUP_COLUMNS,
        "groups": preview_groups,
        "row_count": total,
        "preview_limit": PREVIEW_LIMIT,
        "truncated": truncated,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "report_key": "by_department",
        **_filter_context(),
    }
    return render(request, "reports/by_department.html", ctx)


@login_required
def by_department_pdf(request):
    groups, applied = _by_department_data(request)
    total = sum(g["subtotal"] for g in groups)
    log_report_export(request, "by_department", "pdf", dict(applied), total)
    return render_pdf(
        title="Staff by Department",
        subtitle=f"Grouped by department — {total} record(s) across {len(groups)} group(s)",
        filters_summary=_filters_summary(applied),
        columns=GROUP_COLUMNS,
        rows=[],
        groups=groups,
        filename=f"staff_by_department_{date.today().isoformat()}.pdf",
    )


@login_required
def by_department_excel(request):
    groups, applied = _by_department_data(request)
    total = sum(g["subtotal"] for g in groups)
    log_report_export(request, "by_department", "xlsx", dict(applied), total)
    return render_excel(
        title="Staff by Department",
        subtitle=f"Grouped by department — {total} record(s) across {len(groups)} group(s)",
        filters_summary=_filters_summary(applied),
        columns=GROUP_COLUMNS,
        rows=[],
        groups=groups,
        filename=f"staff_by_department_{date.today().isoformat()}.xlsx",
        sheet_name="By Department",
    )


# ===========================================================================
# 5. Staff by Posting Location Report (grouped)
# ===========================================================================

def _by_location_data(request):
    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.order_by(
        "posting_location__state", "posting_location__name",
        "last_name", "first_name",
    )

    grouped: dict[str, list] = OrderedDict()
    for s in qs.iterator(chunk_size=300):
        if s.posting_location_id:
            key = f"{s.posting_location.name} ({s.posting_location.state})"
        else:
            key = "— (no posting location) —"
        grouped.setdefault(key, []).append(_row_for_group(s))

    groups = [
        {"label": name, "rows": rows, "subtotal": len(rows)}
        for name, rows in grouped.items()
    ]
    return groups, applied


@login_required
def by_location(request):
    groups, applied = _by_location_data(request)
    total = sum(g["subtotal"] for g in groups)
    preview_groups = []
    remaining = PREVIEW_LIMIT
    truncated = False
    for g in groups:
        if remaining <= 0:
            truncated = True
            break
        take = g["rows"][:remaining]
        preview_groups.append({
            "label": g["label"], "rows": take, "subtotal": g["subtotal"],
        })
        remaining -= len(take)
        if len(take) < len(g["rows"]):
            truncated = True
    ctx = {
        "title": "Staff by Posting Location",
        "columns": GROUP_COLUMNS,
        "groups": preview_groups,
        "row_count": total,
        "preview_limit": PREVIEW_LIMIT,
        "truncated": truncated,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "report_key": "by_location",
        **_filter_context(),
    }
    return render(request, "reports/by_location.html", ctx)


@login_required
def by_location_pdf(request):
    groups, applied = _by_location_data(request)
    total = sum(g["subtotal"] for g in groups)
    log_report_export(request, "by_location", "pdf", dict(applied), total)
    return render_pdf(
        title="Staff by Posting Location",
        subtitle=f"Grouped by location — {total} record(s) across {len(groups)} group(s)",
        filters_summary=_filters_summary(applied),
        columns=GROUP_COLUMNS,
        rows=[],
        groups=groups,
        filename=f"staff_by_location_{date.today().isoformat()}.pdf",
    )


@login_required
def by_location_excel(request):
    groups, applied = _by_location_data(request)
    total = sum(g["subtotal"] for g in groups)
    log_report_export(request, "by_location", "xlsx", dict(applied), total)
    return render_excel(
        title="Staff by Posting Location",
        subtitle=f"Grouped by location — {total} record(s) across {len(groups)} group(s)",
        filters_summary=_filters_summary(applied),
        columns=GROUP_COLUMNS,
        rows=[],
        groups=groups,
        filename=f"staff_by_location_{date.today().isoformat()}.xlsx",
        sheet_name="By Location",
    )


# ===========================================================================
# 6. New Appointments Report
# ===========================================================================

NEW_APPOINTMENTS_COLUMNS = [
    "Staff ID", "Full Name", "Department", "Designation",
    "Grade/Step", "Posting Location",
    "First Appointment", "Employment Type", "Status",
]


def _new_appointments_data(request):
    today = date.today()
    start = _parse_date(request.GET.get("start_date")) or (today - timedelta(days=365))
    end = _parse_date(request.GET.get("end_date")) or today

    if start > end:
        start, end = end, start

    qs, applied = _apply_common(_base_staff_qs(), request)
    qs = qs.filter(
        first_appointment_date__gte=start,
        first_appointment_date__lte=end,
    ).order_by("-first_appointment_date", "last_name")

    applied["From"] = start.isoformat()
    applied["To"] = end.isoformat()

    rows = []
    for s in qs.iterator(chunk_size=300):
        rows.append([
            s.staff_id,
            _full_name(s),
            s.department.name if s.department_id else "",
            s.designation.title if s.designation_id else "",
            f"{s.grade_level.grade_level}/{s.grade_step}" if s.grade_level_id else "",
            s.posting_location.name if s.posting_location_id else "",
            s.first_appointment_date.isoformat() if s.first_appointment_date else "",
            s.employment_type,
            s.employment_status,
        ])
    return rows, applied, start, end


@login_required
def new_appointments(request):
    rows, applied, start, end = _new_appointments_data(request)
    ctx = {
        "title": "New Appointments",
        "columns": NEW_APPOINTMENTS_COLUMNS,
        "rows": rows[:PREVIEW_LIMIT],
        "row_count": len(rows),
        "preview_limit": PREVIEW_LIMIT,
        "truncated": len(rows) > PREVIEW_LIMIT,
        "applied": applied,
        "filters_summary": _filters_summary(applied),
        "qs": request.GET.urlencode(),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "report_key": "new_appointments",
        **_filter_context(),
    }
    return render(request, "reports/new_appointments.html", ctx)


@login_required
def new_appointments_pdf(request):
    rows, applied, start, end = _new_appointments_data(request)
    log_report_export(request, "new_appointments", "pdf", dict(applied), len(rows))
    return render_pdf(
        title="New Appointments Report",
        subtitle=f"Staff appointed between {start.isoformat()} and {end.isoformat()} — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=NEW_APPOINTMENTS_COLUMNS,
        rows=rows,
        filename=f"new_appointments_{start.isoformat()}_{end.isoformat()}.pdf",
    )


@login_required
def new_appointments_excel(request):
    rows, applied, start, end = _new_appointments_data(request)
    log_report_export(request, "new_appointments", "xlsx", dict(applied), len(rows))
    return render_excel(
        title="New Appointments Report",
        subtitle=f"Staff appointed between {start.isoformat()} and {end.isoformat()} — {len(rows)} record(s)",
        filters_summary=_filters_summary(applied),
        columns=NEW_APPOINTMENTS_COLUMNS,
        rows=rows,
        filename=f"new_appointments_{start.isoformat()}_{end.isoformat()}.xlsx",
        sheet_name="New Appointments",
    )


# ===========================================================================
# 7. Pre-Handover Testing Checklist
# ===========================================================================

@login_required
def testing_checklist_data(request):
    """JSON endpoint consumed by the React Testing Checklist page."""
    return JsonResponse(_load_testing_checklist())


@login_required
def testing_checklist_pdf(request):
    """Branded PDF of the full handover testing checklist."""
    data = _load_testing_checklist()
    columns = data["columns"]

    groups = []
    for section in data["sections"]:
        rows = []
        if section.get("narrative"):
            rows.append(["—", section["narrative"], ""])
        if section.get("samples"):
            for s in section["samples"]["rows"]:
                # s = [Sample, Name, DOB, First Appt, Last Promo, Promo Due, Retirement, Driver]
                desc = (
                    f"{s[0]} {s[1]} — DOB {s[2]}, First Appt {s[3]}, "
                    f"Last Promotion {s[4]}"
                )
                expected = f"Promo Due {s[5]} · Retirement {s[6]} ({s[7]} driver)"
                rows.append([f"SAMPLE-{s[0]}", desc, expected])
        rows.extend([list(r) for r in section["tests"]])
        groups.append({
            "label": section["label"],
            "rows": rows,
            "subtotal": len(section["tests"]),
        })

    total = sum(len(s["tests"]) for s in data["sections"])
    log_report_export(
        request, "testing_checklist", "pdf", {}, total,
    )
    return render_pdf(
        title=data["title"],
        subtitle=f"{data['subtitle']} — {total} test cases (reference date {data['reference_date']})",
        filters_summary="",
        columns=columns,
        rows=[],
        groups=groups,
        filename=f"testing_checklist_{date.today().isoformat()}.pdf",
    )
