"""Idempotent demo-staff seeder.

Recreates 8 fully-populated demo rows so a fresh Render Postgres has
realistic data on the Dashboard / Staff List. Every column the model
exposes is filled (or left blank only where it makes sense — e.g. a
single staff member's contract dates).

Run once after deploy:

    python manage.py seed_demo_staff

Behaviour:
 - Departments / Designations / GradeLevels referenced by demo rows are
   created on demand. The Designation rank_order roughly orders them.
 - Each Staff row is keyed by staff_id; existing rows are updated rather
   than duplicated, so re-running the command is safe.
 - ``--wipe`` removes any pre-existing rows whose staff_id starts with
   ``CCA/`` before reseeding, useful when the demo set itself has changed.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction

from departments.models import Department, Designation, GradeLevel
from staff.models import Staff


def _department_code(name: str) -> str:
    parts = [w for w in name.replace("&", "and").split() if w[0].isalpha()]
    stop = {"and", "of", "the", "department"}
    initials = "".join(p[0] for p in parts if p.lower() not in stop).upper()
    return (initials or name[:3].upper())[:10]


# Department metadata seeded so the dashboard has labels and codes.
DEPARTMENTS = {
    "Litigation Department":                      ("LIT",  "Hon. Justice Tanko"),
    "Administration Department":                  ("ADM",  "Mr. Yusuf Adamu"),
    "Planning, Research & Statistics Department": ("PRS",  "Mrs. Lara Bello"),
    "Finance and Supply Department":              ("FIN",  "Mr. Ade Okon"),
}

# (title, rank_order)
DESIGNATIONS = [
    ("Senior Registrar",         9),
    ("Legal Counsel",            8),
    ("Legal Officer",            7),
    ("Court Clerk",              6),
    ("Administrative Officer",   6),
    ("Human Resources Officer",  6),
    ("Finance Officer",          6),
    ("IT Support Officer",       5),
]

# Grade levels with a salary anchor (only used by the GradeLevel.get_salary_for_step
# helper if you ever want to compute pay; demo rows reference these by name).
GRADE_LEVELS = {
    "GL08": Decimal("950000"),
    "GL09": Decimal("1100000"),
    "GL10": Decimal("1300000"),
    "GL11": Decimal("1550000"),
    "GL12": Decimal("1900000"),
    "GL13": Decimal("2350000"),
    "GL14": Decimal("2900000"),
    "GL15": Decimal("3500000"),
}


# Each row mirrors the data the old JS mock used to ship with, expanded to
# fill every persisted column.
DEMO_ROWS = [
    dict(
        staff_id="CCA/2020/0001",
        secret_file_number="CCA/SF/2020/0001",
        first_name="Chisom", middle_name="Amaka", last_name="Adiala",
        date_of_birth=date(1989, 7, 21), gender="F",
        nationality="Nigerian", state_of_origin="Anambra",
        local_government_area="Awka South",
        email="chisom.adiala@cca.gov.ng",
        phone_number="08012345678", alternate_phone="07098765432",
        residential_address="No 14 Aminu Kano Crescent, Wuse II, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A12345678", national_identification="ID-2020-0001",
        nin="12345678901", nhis_number="NHIS200001", nhf_number="NHF200001",
        marital_status="Married", number_of_dependents=2,
        department_name="Litigation Department",
        designation_title="Legal Officer",
        grade_level_code="GL12", grade_step=4,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2020, 3, 15),
        last_promotion_date=date(2024, 1, 1),
        highest_qualification="LLM, University of Lagos",
        professional_certifications="Nigerian Bar Association (2014); Notary Public (2019)",
        next_of_kin_name="Ifeanyi Adiala", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08111223344", next_of_kin_email="ifeanyi@example.com",
        next_of_kin_address="No 14 Aminu Kano Crescent, Wuse II, Abuja",
        next_of_kin_2_name="Ngozi Adiala", next_of_kin_2_relationship="Mother",
        next_of_kin_2_phone="08099887766", next_of_kin_2_email="",
        next_of_kin_2_address="12 Enugu Road, Awka",
        emergency_contact_name="Ifeanyi Adiala", emergency_contact_phone="08111223344",
        bank_name="GTBank", account_number="0123456789", account_holder_name="Chisom A. Adiala",
        remarks="Lead counsel on family-law matters.",
        year_of_call_to_bar=2014,
    ),
    dict(
        staff_id="CCA/2019/0002",
        secret_file_number="CCA/SF/2019/0002",
        first_name="Fatima", middle_name="", last_name="Ibrahim",
        date_of_birth=date(1986, 2, 4), gender="F",
        nationality="Nigerian", state_of_origin="Kano", local_government_area="Nassarawa",
        email="fatima.ibrahim@cca.gov.ng",
        phone_number="08023456789", alternate_phone="",
        residential_address="Plot 22, Garki II, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A22334455", national_identification="ID-2019-0002",
        nin="22345678902", nhis_number="NHIS190002", nhf_number="NHF190002",
        marital_status="Married", number_of_dependents=3,
        department_name="Administration Department",
        designation_title="Administrative Officer",
        grade_level_code="GL10", grade_step=6,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2019, 7, 20),
        last_promotion_date=date(2023, 8, 1),
        highest_qualification="MPA, Ahmadu Bello University",
        professional_certifications="CIPM (2018)",
        next_of_kin_name="Aliyu Ibrahim", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08134567890", next_of_kin_email="aliyu@example.com",
        next_of_kin_address="Plot 22, Garki II, Abuja",
        emergency_contact_name="Aliyu Ibrahim", emergency_contact_phone="08134567890",
        bank_name="Zenith Bank", account_number="2234567890", account_holder_name="Fatima Ibrahim",
        remarks="Coordinates HR onboarding workflow.",
    ),
    dict(
        staff_id="CCA/2021/0003",
        secret_file_number="CCA/SF/2021/0003",
        first_name="Emeka", middle_name="Chibuike", last_name="Okonkwo",
        date_of_birth=date(1992, 11, 30), gender="M",
        nationality="Nigerian", state_of_origin="Anambra", local_government_area="Onitsha North",
        email="emeka.okonkwo@cca.gov.ng",
        phone_number="08034567890", alternate_phone="08178899001",
        residential_address="Lugbe Phase 1, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A33445566", national_identification="ID-2021-0003",
        nin="32345678903", nhis_number="NHIS210003", nhf_number="NHF210003",
        marital_status="Single", number_of_dependents=0,
        department_name="Litigation Department",
        designation_title="Court Clerk",
        grade_level_code="GL08", grade_step=3,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2021, 1, 10),
        last_promotion_date=None,
        highest_qualification="BSc Public Administration, UNN",
        professional_certifications="",
        next_of_kin_name="Adaeze Okonkwo", next_of_kin_relationship="Sister",
        next_of_kin_phone="08145566778", next_of_kin_email="adaeze@example.com",
        next_of_kin_address="22 Bida Road, Onitsha",
        emergency_contact_name="Adaeze Okonkwo", emergency_contact_phone="08145566778",
        bank_name="Access Bank", account_number="3345678901", account_holder_name="Emeka Okonkwo",
        remarks="Court Clerk assigned to Court Room 3.",
    ),
    dict(
        staff_id="CCA/2026/0004",
        secret_file_number="CCA/SF/2026/0004",
        first_name="Grace", middle_name="Funke", last_name="Oduwole",
        date_of_birth=date(1990, 4, 12), gender="F",
        nationality="Nigerian", state_of_origin="Oyo", local_government_area="Ibadan North",
        email="grace.oduwole@cca.gov.ng",
        phone_number="08045678901", alternate_phone="",
        residential_address="Karu, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A44556677", national_identification="ID-2026-0004",
        nin="42345678904", nhis_number="NHIS260004", nhf_number="NHF260004",
        marital_status="Married", number_of_dependents=1,
        department_name="Administration Department",
        designation_title="Human Resources Officer",
        grade_level_code="GL09", grade_step=1,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2026, 5, 1),
        last_promotion_date=None,
        highest_qualification="MSc Industrial Relations & HRM, UI",
        professional_certifications="CIPM (2022); SHRM-CP (2024)",
        next_of_kin_name="Tunde Oduwole", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08156677889", next_of_kin_email="tunde@example.com",
        next_of_kin_address="Karu, Abuja",
        emergency_contact_name="Tunde Oduwole", emergency_contact_phone="08156677889",
        bank_name="UBA", account_number="4456789012", account_holder_name="Grace F. Oduwole",
        remarks="New hire — probation completes May 2027.",
    ),
    dict(
        staff_id="CCA/2018/0005",
        secret_file_number="CCA/SF/2018/0005",
        first_name="Ahmed", middle_name="", last_name="Hassan",
        date_of_birth=date(1968, 9, 8), gender="M",
        nationality="Nigerian", state_of_origin="Kaduna", local_government_area="Kaduna North",
        email="ahmed.hassan@cca.gov.ng",
        phone_number="08056789012", alternate_phone="08145566778",
        residential_address="Maitama, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A55667788", national_identification="ID-2018-0005",
        nin="52345678905", nhis_number="NHIS180005", nhf_number="NHF180005",
        marital_status="Married", number_of_dependents=4,
        department_name="Litigation Department",
        designation_title="Senior Registrar",
        grade_level_code="GL15", grade_step=8,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(1993, 5, 12),
        last_promotion_date=date(2020, 6, 1),
        highest_qualification="LLM, University of Abuja",
        professional_certifications="NBA (1995); Senior Magistrate certification (2010)",
        next_of_kin_name="Aisha Hassan", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08167788990", next_of_kin_email="aisha@example.com",
        next_of_kin_address="Maitama, Abuja",
        next_of_kin_2_name="Yusuf Hassan", next_of_kin_2_relationship="Son",
        next_of_kin_2_phone="08178899001", next_of_kin_2_email="",
        next_of_kin_2_address="Maitama, Abuja",
        emergency_contact_name="Aisha Hassan", emergency_contact_phone="08167788990",
        bank_name="First Bank", account_number="5567890123", account_holder_name="Ahmed Hassan",
        remarks="Approaches mandatory retirement in 2028.",
    ),
    dict(
        staff_id="CCA/2021/0006",
        secret_file_number="CCA/SF/2021/0006",
        first_name="Zainab", middle_name="", last_name="Ahmed",
        date_of_birth=date(1994, 12, 2), gender="F",
        nationality="Nigerian", state_of_origin="Borno", local_government_area="Maiduguri",
        email="zainab.ahmed@cca.gov.ng",
        phone_number="08067890123", alternate_phone="",
        residential_address="Gwarinpa, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A66778899", national_identification="ID-2021-0006",
        nin="62345678906", nhis_number="NHIS210006", nhf_number="NHF210006",
        marital_status="Single", number_of_dependents=0,
        department_name="Planning, Research & Statistics Department",
        designation_title="IT Support Officer",
        grade_level_code="GL09", grade_step=4,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2021, 9, 8),
        last_promotion_date=None,
        highest_qualification="BSc Computer Science, BUK",
        professional_certifications="CompTIA A+ (2022); ITIL Foundation (2023)",
        next_of_kin_name="Hauwa Ahmed", next_of_kin_relationship="Mother",
        next_of_kin_phone="08189900112", next_of_kin_email="hauwa@example.com",
        next_of_kin_address="Maiduguri, Borno",
        emergency_contact_name="Hauwa Ahmed", emergency_contact_phone="08189900112",
        bank_name="FCMB", account_number="6678901234", account_holder_name="Zainab Ahmed",
        remarks="Maintains help-desk and AV equipment.",
    ),
    dict(
        staff_id="CCA/2019/0007",
        secret_file_number="CCA/SF/2019/0007",
        first_name="David", middle_name="Chibuzor", last_name="Nwosu",
        date_of_birth=date(1983, 6, 18), gender="M",
        nationality="Nigerian", state_of_origin="Abia", local_government_area="Aba South",
        email="david.nwosu@cca.gov.ng",
        phone_number="08078901234", alternate_phone="",
        residential_address="Lokogoma, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A77889900", national_identification="ID-2019-0007",
        nin="72345678907", nhis_number="NHIS190007", nhf_number="NHF190007",
        marital_status="Married", number_of_dependents=2,
        department_name="Finance and Supply Department",
        designation_title="Finance Officer",
        grade_level_code="GL11", grade_step=5,
        employment_type="Contract", employment_status="Active",
        first_appointment_date=date(2019, 11, 22),
        last_promotion_date=date(2023, 11, 22),
        contract_start_date=date(2024, 1, 1), contract_end_date=date(2026, 12, 31),
        highest_qualification="MSc Accounting, University of Nigeria",
        professional_certifications="ICAN (2017); ACCA (2021)",
        next_of_kin_name="Ngozi Nwosu", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08190011223", next_of_kin_email="ngozi@example.com",
        next_of_kin_address="Lokogoma, Abuja",
        emergency_contact_name="Ngozi Nwosu", emergency_contact_phone="08190011223",
        bank_name="Stanbic IBTC", account_number="7789012345", account_holder_name="David C. Nwosu",
        remarks="Contract role — payroll and vendor reconciliation.",
    ),
    dict(
        staff_id="CCA/2020/0008",
        secret_file_number="CCA/SF/2020/0008",
        first_name="Victoria", middle_name="Iniobong", last_name="Ekpo",
        date_of_birth=date(1985, 3, 25), gender="F",
        nationality="Nigerian", state_of_origin="Akwa Ibom", local_government_area="Uyo",
        email="victoria.ekpo@cca.gov.ng",
        phone_number="08089012345", alternate_phone="",
        residential_address="Wuse Zone 5, Abuja",
        residential_state="FCT", residential_city="Abuja",
        passport_number="A88990011", national_identification="ID-2020-0008",
        nin="82345678908", nhis_number="NHIS200008", nhf_number="NHF200008",
        marital_status="Married", number_of_dependents=2,
        department_name="Litigation Department",
        designation_title="Legal Counsel",
        grade_level_code="GL13", grade_step=2,
        employment_type="Permanent", employment_status="Active",
        first_appointment_date=date(2020, 2, 5),
        last_promotion_date=date(2024, 2, 5),
        highest_qualification="LLM (Commercial Law), UNILAG",
        professional_certifications="NBA (2010); Chartered Mediator (2019)",
        next_of_kin_name="Daniel Ekpo", next_of_kin_relationship="Spouse",
        next_of_kin_phone="08201122334", next_of_kin_email="daniel@example.com",
        next_of_kin_address="Wuse Zone 5, Abuja",
        next_of_kin_2_name="Mary Ekpo", next_of_kin_2_relationship="Daughter",
        next_of_kin_2_phone="08212233445", next_of_kin_2_email="",
        next_of_kin_2_address="Wuse Zone 5, Abuja",
        emergency_contact_name="Daniel Ekpo", emergency_contact_phone="08201122334",
        bank_name="Wema Bank", account_number="8890123456", account_holder_name="Victoria I. Ekpo",
        remarks="Heads commercial-disputes desk.",
    ),
]


class Command(BaseCommand):
    help = "Seed (or refresh) the 8 fully-populated demo staff rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--wipe", action="store_true",
            help="Delete pre-existing demo rows (staff_id starting with CCA/) first.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["wipe"]:
            removed, _ = Staff.objects.filter(staff_id__startswith="CCA/").delete()
            self.stdout.write(self.style.WARNING(f"Wiped {removed} pre-existing demo row(s)."))

        # 1) Department / Designation / GradeLevel fixtures.
        for name, (code, hod) in DEPARTMENTS.items():
            Department.objects.update_or_create(
                name=name,
                defaults={"department_code": code, "head_of_department": hod, "is_active": True},
            )
        for title, rank in DESIGNATIONS:
            Designation.objects.update_or_create(
                title=title, defaults={"rank_order": rank, "is_active": True},
            )
        for code, anchor in GRADE_LEVELS.items():
            GradeLevel.objects.update_or_create(
                grade_level=code,
                defaults={"step_1_amount": anchor, "number_of_steps": 15, "is_active": True},
            )

        # 2) Staff rows.
        created_count = updated_count = skipped_count = 0
        for raw in DEMO_ROWS:
            row = dict(raw)
            dept = Department.objects.get(name=row.pop("department_name"))
            desg = Designation.objects.get(title=row.pop("designation_title"))
            grade = GradeLevel.objects.get(grade_level=row.pop("grade_level_code"))
            defaults = dict(
                **row,
                department=dept, designation=desg, grade_level=grade,
                is_active=True,
                created_by="seed_demo_staff",
                updated_by="seed_demo_staff",
            )
            staff_id = defaults.pop("staff_id")
            try:
                # Per-row atomic block so one bad row doesn't poison the txn.
                with transaction.atomic():
                    obj, created = Staff.objects.update_or_create(
                        staff_id=staff_id, defaults=defaults,
                    )
            except IntegrityError as exc:
                # A demo value (e.g. email) may already belong to a real record.
                # Demo data is optional — skip the row rather than fail the deploy.
                skipped_count += 1
                self.stdout.write(self.style.WARNING(
                    f"Skipped demo staff {staff_id}: {exc}"
                ))
                continue
            if created:
                created_count += 1
            else:
                updated_count += 1

        total = Staff.objects.filter(staff_id__startswith="CCA/").count()
        self.stdout.write(self.style.SUCCESS(
            f"Demo staff seeded: created={created_count}, updated={updated_count}, "
            f"skipped={skipped_count}, total={total}."
        ))
