from datetime import date, timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.db.models.functions import ExtractYear
from django.shortcuts import render
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from departments.models import Department, GradeLevel, PostingLocation
from staff.models import Staff, StaffPromotion


def _add_months(d, months):
    """Add `months` to a date, clamping the day for short months."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last_day = [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return date(y, m, min(d.day, last_day))


def _initials(first, last):
    return f"{(first or '')[:1]}{(last or '')[:1]}".upper() or "?"


class DashboardDataView(APIView):
    """Single JSON endpoint that powers the executive dashboard.

    Returned in one payload so the front-end can refresh all widgets
    with one fetch instead of fanning out across multiple endpoints.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        in_90_days = today + timedelta(days=90)
        in_12_months = _add_months(today, 12)
        month_end = _add_months(date(today.year, today.month, 1), 1) - timedelta(days=1)
        year_end = date(today.year, 12, 31)
        five_years_ago_jan1 = date(today.year - 4, 1, 1)

        active_staff = Staff.objects.filter(is_active=True)

        # ---- KPI cards ---------------------------------------------------
        total_staff = Staff.objects.count()

        by_department = list(
            Department.objects.annotate(count=Count("staff"))
            .filter(count__gt=0)
            .values("id", "name", "department_code", "count")
            .order_by("-count")
        )

        upcoming_promotions_90 = active_staff.filter(
            next_promotion_date__gte=today,
            next_promotion_date__lte=in_90_days,
        ).count()

        upcoming_retirements_12mo = active_staff.filter(
            retirement_date__gte=today,
            retirement_date__lte=in_12_months,
        ).count()

        by_location_full = list(
            PostingLocation.objects.annotate(count=Count("staff"))
            .filter(count__gt=0)
            .values("id", "name", "state", "count")
            .order_by("-count")
        )

        # ---- Charts ------------------------------------------------------
        # Bar: staff per department (already computed above)
        department_chart = {
            "labels": [d["name"] for d in by_department],
            "data": [d["count"] for d in by_department],
        }

        # Donut: staff by grade level
        grade_rows = list(
            GradeLevel.objects.annotate(count=Count("staff"))
            .filter(count__gt=0)
            .values("grade_level", "count")
            .order_by("grade_level")
        )
        grade_chart = {
            "labels": [g["grade_level"] for g in grade_rows],
            "data": [g["count"] for g in grade_rows],
        }

        # Line: promotions per year (last 5 calendar years, oldest -> newest)
        promo_rows = (
            StaffPromotion.objects.filter(promotion_date__gte=five_years_ago_jan1)
            .annotate(yr=ExtractYear("promotion_date"))
            .values("yr")
            .annotate(c=Count("id"))
        )
        counts_by_year = {row["yr"]: row["c"] for row in promo_rows}
        years = list(range(today.year - 4, today.year + 1))
        promotions_chart = {
            "labels": [str(y) for y in years],
            "data": [counts_by_year.get(y, 0) for y in years],
        }

        # Horizontal bar: top 5 posting locations by staff count
        top_locations = by_location_full[:5]
        locations_chart = {
            "labels": [f'{l["name"]} ({l["state"]})' for l in top_locations],
            "data": [l["count"] for l in top_locations],
        }

        # ---- Quick action lists -----------------------------------------
        promotions_due_month = list(
            active_staff.filter(
                next_promotion_date__gte=today,
                next_promotion_date__lte=month_end,
            )
            .select_related("department", "designation", "grade_level")
            .order_by("next_promotion_date")[:5]
            .values(
                "id", "staff_id", "first_name", "last_name",
                "department__name", "designation__title",
                "grade_level__grade_level", "next_promotion_date",
            )
        )

        retiring_this_year = list(
            active_staff.filter(
                retirement_date__gte=today,
                retirement_date__lte=year_end,
            )
            .select_related("department", "designation")
            .order_by("retirement_date")[:5]
            .values(
                "id", "staff_id", "first_name", "last_name",
                "department__name", "designation__title", "retirement_date",
            )
        )

        recently_added = list(
            Staff.objects.select_related("department", "designation")
            .order_by("-created_at")[:5]
            .values(
                "id", "staff_id", "first_name", "last_name",
                "department__name", "designation__title", "created_at",
            )
        )

        def _shape(rows, date_field):
            shaped = []
            for r in rows:
                d_value = r.get(date_field)
                shaped.append({
                    "id": r["id"],
                    "staff_id": r["staff_id"],
                    "name": f'{r["first_name"]} {r["last_name"]}'.strip(),
                    "initials": _initials(r["first_name"], r["last_name"]),
                    "department": r.get("department__name") or "—",
                    "designation": r.get("designation__title") or "—",
                    "grade_level": r.get("grade_level__grade_level"),
                    "date": d_value.isoformat() if d_value else None,
                })
            return shaped

        return Response({
            "generated_at": today.isoformat(),
            "kpis": {
                "total_staff": total_staff,
                "active_staff": active_staff.count(),
                "by_department_total": len(by_department),
                "by_department": by_department,
                "upcoming_promotions_90d": upcoming_promotions_90,
                "upcoming_retirements_12mo": upcoming_retirements_12mo,
                "deployed_locations_total": len(by_location_full),
                "by_location": by_location_full,
            },
            "charts": {
                "department": department_chart,
                "grade_level": grade_chart,
                "promotions_trend": promotions_chart,
                "top_locations": locations_chart,
            },
            "quick_actions": {
                "promotions_due_this_month": _shape(promotions_due_month, "next_promotion_date"),
                "retiring_this_year": _shape(retiring_this_year, "retirement_date"),
                "recently_added": _shape(recently_added, "created_at"),
            },
        })


class DashboardSummaryView(APIView):
    """Legacy compact summary kept for backwards compatibility."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        soon = today + timedelta(days=180)
        return Response({
            "total_staff": Staff.objects.count(),
            "active_staff": Staff.objects.filter(is_active=True).count(),
            "by_department": list(
                Department.objects.annotate(count=Count("staff"))
                .values("id", "name", "department_code", "count")
                .order_by("-count")
            ),
            "due_for_promotion": Staff.objects.filter(
                next_promotion_date__lte=today, is_active=True
            ).count(),
            "retiring_in_6_months": Staff.objects.filter(
                retirement_date__lte=soon, is_active=True
            ).count(),
        })


@login_required
def executive_dashboard(request):
    """Render the executive dashboard shell. All data is loaded via the
    DashboardDataView JSON endpoint, so the page can auto-refresh."""
    return render(request, "dashboard/executive_dashboard.html", {
        "data_url": "/api/dashboard/data/",
    })
