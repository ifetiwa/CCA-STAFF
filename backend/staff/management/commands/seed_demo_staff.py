"""Idempotent demo-staff seeder.

Recreates the same 8 mock rows the SPA used to ship with, so a fresh
Render Postgres has something to show on the Dashboard / Staff List.

Run once after deploy:

    python manage.py seed_demo_staff

Behaviour:
 - Departments / Designations referenced by the demo rows are created on
   demand (idempotent by name / department_code / title).
 - Each Staff row is keyed by staff_id; existing rows are updated rather
   than duplicated, so re-running the command is safe.
 - ``--wipe`` removes any pre-existing rows whose staff_id starts with
   ``CCA/`` before reseeding, useful when the demo set itself has changed.
"""
from __future__ import annotations

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from departments.models import Department, Designation
from staff.models import Staff


# (staff_id, first_name, last_name, gender, dob, state_of_origin,
#  email, phone, address, department_name, designation_title,
#  gradeLevel, step, first_appointment_date)
DEMO_ROWS = [
    ("CCA/2020/0001", "Chisom", "Adiala",    "F", date(1989,  7, 21), "Anambra",     "chisom.adiala@cca.gov.ng",   "08012345678", "No 14 Aminu Kano Crescent, Wuse II, Abuja", "Litigation Department",                      "Legal Officer",            "12", 4, date(2020, 3, 15)),
    ("CCA/2019/0002", "Fatima",  "Ibrahim",   "F", date(1986,  2,  4), "Kano",        "fatima.ibrahim@cca.gov.ng",  "08023456789", "Plot 22, Garki II, Abuja",                  "Administration Department",                  "Administrative Officer",   "10", 6, date(2019, 7, 20)),
    ("CCA/2021/0003", "Emeka",   "Okonkwo",   "M", date(1992, 11, 30), "Anambra",     "emeka.okonkwo@cca.gov.ng",   "08034567890", "Lugbe Phase 1, Abuja",                      "Litigation Department",                      "Court Clerk",              "8",  3, date(2021, 1, 10)),
    ("CCA/2026/0004", "Grace",   "Oduwole",   "F", date(1990,  4, 12), "Oyo",         "grace.oduwole@cca.gov.ng",   "08045678901", "Karu, Abuja",                                "Administration Department",                  "Human Resources Officer",  "9",  1, date(2026, 5,  1)),
    ("CCA/2018/0005", "Ahmed",   "Hassan",    "M", date(1968,  9,  8), "Kaduna",      "ahmed.hassan@cca.gov.ng",    "08056789012", "Maitama, Abuja",                             "Litigation Department",                      "Senior Registrar",         "15", 8, date(1993, 5, 12)),
    ("CCA/2021/0006", "Zainab",  "Ahmed",     "F", date(1994, 12,  2), "Borno",       "zainab.ahmed@cca.gov.ng",    "08067890123", "Gwarinpa, Abuja",                            "Planning, Research & Statistics Department", "IT Support Officer",       "9",  4, date(2021, 9,  8)),
    ("CCA/2019/0007", "David",   "Nwosu",     "M", date(1983,  6, 18), "Abia",        "david.nwosu@cca.gov.ng",     "08078901234", "Lokogoma, Abuja",                            "Finance and Supply Department",              "Finance Officer",          "11", 5, date(2019,11, 22)),
    ("CCA/2020/0008", "Victoria","Ekpo",      "F", date(1985,  3, 25), "Akwa Ibom",   "victoria.ekpo@cca.gov.ng",   "08089012345", "Wuse Zone 5, Abuja",                         "Litigation Department",                      "Legal Counsel",            "13", 2, date(2020, 2,  5)),
]


def _department_code(name: str) -> str:
    """Build a stable short code from the department name."""
    parts = [w for w in name.replace("&", "and").split() if w[0].isalpha()]
    stop = {"and", "of", "the", "department"}
    initials = "".join(p[0] for p in parts if p.lower() not in stop).upper()
    return (initials or name[:3].upper())[:10]


class Command(BaseCommand):
    help = "Seed (or refresh) the original 8 demo staff rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--wipe",
            action="store_true",
            help="Delete pre-existing demo rows (staff_id starting with CCA/) first.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["wipe"]:
            removed, _ = Staff.objects.filter(staff_id__startswith="CCA/").delete()
            self.stdout.write(self.style.WARNING(f"Wiped {removed} pre-existing demo row(s)."))

        created_count = updated_count = 0
        for row in DEMO_ROWS:
            (staff_id, first, last, gender, dob, soo, email, phone, addr,
             dept_name, desg_title, gl, step, appt) = row

            dept, _ = Department.objects.get_or_create(
                name=dept_name,
                defaults={"department_code": _department_code(dept_name)},
            )
            desg, _ = Designation.objects.get_or_create(
                title=desg_title,
                defaults={"rank_order": 1},
            )

            defaults = dict(
                first_name=first,
                last_name=last,
                gender=gender,
                date_of_birth=dob,
                state_of_origin=soo,
                email=email,
                phone_number=phone,
                residential_address=addr,
                residential_state="FCT",
                residential_city="Abuja",
                department=dept,
                designation=desg,
                grade_step=step,
                first_appointment_date=appt,
                employment_status="Active",
                is_active=True,
                # Staff.passport_photo is required; without Cloudinary configured
                # locally we just point at a placeholder path.
                passport_photo="placeholder.jpg",
            )

            obj, created = Staff.objects.update_or_create(
                staff_id=staff_id, defaults=defaults,
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Demo staff seeded: created={created_count}, updated={updated_count}, "
            f"total={Staff.objects.filter(staff_id__startswith='CCA/').count()}."
        ))
