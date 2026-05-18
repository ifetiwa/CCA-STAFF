"""
End-to-end sanity test for the new passport_photo + signature ImageFields on
the Staff model. Run from the backend/ directory with:

    python test_image_upload.py

Prints a clear PASS / FAIL line per check and exits with code 1 if any
assertion fails. Cleans up the staff row and uploaded files at the end.
"""

import os
import struct
import sys
import zlib
from datetime import date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "biodata_system.settings")

import django

django.setup()

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile

from departments.models import Department, Designation, GradeLevel
from staff.models import Staff
from staff.serializers import StaffSerializer


def make_png(width=4, height=4, color=(212, 165, 116, 255)):
    """Hand-roll a tiny PNG so we don't depend on Pillow in the test."""
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


PASS = "[ OK ]"
FAIL = "[FAIL]"
errors = []


def check(label, ok, detail=""):
    print(f"  {PASS if ok else FAIL}  {label}{(' - ' + detail) if detail else ''}")
    if not ok:
        errors.append(label)


# ---------------------------------------------------------------------------
# Set up the FK references we need. Re-use existing rows if they're already
# in the DB; create throwaway ones otherwise.
# ---------------------------------------------------------------------------
print("\n=== Staff image-upload test ===\n")

dept, _ = Department.objects.get_or_create(
    name="Test Department (image upload)",
    defaults={"department_code": "TST-IMG"},
)
desig, _ = Designation.objects.get_or_create(
    title="Test Designation (image upload)",
    defaults={"rank_order": 999},
)
grade, _ = GradeLevel.objects.get_or_create(
    grade_level="GL99",
    defaults={
        "description": "Test grade (image upload)",
        "step_1_amount": 1,
    },
)

print(f"  Reference data ready · Dept={dept.id} · Desig={desig.id} · GL={grade.id}\n")

# ---------------------------------------------------------------------------
# Create a Staff row with both images attached. SimpleUploadedFile is exactly
# what DRF's parser produces when the React app sends multipart/form-data, so
# this exercises the same write path as a real API submission.
# ---------------------------------------------------------------------------
STAFF_ID = "CCA/TEST/IMG-0001"

# Wipe any leftover row from a prior failed run.
Staff.objects.filter(staff_id=STAFF_ID).delete()

photo_bytes = make_png()
signature_bytes = make_png(width=120, height=30, color=(15, 37, 56, 255))

photo_upload = SimpleUploadedFile("passport.png", photo_bytes, content_type="image/png")
signature_upload = SimpleUploadedFile("signature.png", signature_bytes, content_type="image/png")

staff = Staff.objects.create(
    staff_id=STAFF_ID,
    first_name="Image",
    last_name="UploadTest",
    date_of_birth=date(1990, 1, 1),
    gender="M",
    state_of_origin="FCT",
    email="image.uploadtest@example.test",
    phone_number="08000000000",
    residential_address="Test address",
    residential_state="FCT",
    residential_city="Abuja",
    passport_photo=photo_upload,
    signature=signature_upload,
    nhis_number="NHIS-TEST-001",
    nhf_number="NHF-TEST-001",
    year_of_call_to_bar=2011,
    department=dept,
    designation=desig,
    grade_level=grade,
    grade_step=1,
    employment_type="Permanent",
    employment_status="Active",
    first_appointment_date=date(2015, 1, 1),
)

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------
fresh = Staff.objects.get(pk=staff.pk)

check("Staff row saved", fresh.pk is not None, f"pk={fresh.pk}")

check("passport_photo field populated", bool(fresh.passport_photo), fresh.passport_photo.name or "(empty)")
check("signature field populated",      bool(fresh.signature),      fresh.signature.name or "(empty)")

photo_path = os.path.join(settings.MEDIA_ROOT, fresh.passport_photo.name) if fresh.passport_photo else None
sig_path   = os.path.join(settings.MEDIA_ROOT, fresh.signature.name)      if fresh.signature      else None

check("passport_photo file exists on disk",
      photo_path and os.path.exists(photo_path),
      photo_path)
check("signature file exists on disk",
      sig_path and os.path.exists(sig_path),
      sig_path)

if photo_path and os.path.exists(photo_path):
    on_disk = open(photo_path, "rb").read()
    check("passport_photo bytes round-tripped", on_disk == photo_bytes,
          f"{len(on_disk)} bytes (expected {len(photo_bytes)})")

if sig_path and os.path.exists(sig_path):
    on_disk = open(sig_path, "rb").read()
    check("signature bytes round-tripped", on_disk == signature_bytes,
          f"{len(on_disk)} bytes (expected {len(signature_bytes)})")

check("passport_photo URL resolves",
      bool(fresh.passport_photo.url) and fresh.passport_photo.url.startswith(settings.MEDIA_URL),
      fresh.passport_photo.url)
check("signature URL resolves",
      bool(fresh.signature.url) and fresh.signature.url.startswith(settings.MEDIA_URL),
      fresh.signature.url)

check("nhis_number persisted",         fresh.nhis_number == "NHIS-TEST-001", fresh.nhis_number)
check("nhf_number persisted",          fresh.nhf_number == "NHF-TEST-001",  fresh.nhf_number)
check("year_of_call_to_bar persisted", fresh.year_of_call_to_bar == 2011,   str(fresh.year_of_call_to_bar))
check("employment_status accepts new value",
      fresh.employment_status == "Active",
      fresh.employment_status)

# Cycle the row through the serializer to confirm the API surface picks up
# the new fields.
serialized = StaffSerializer(fresh).data
for key in ("passport_photo", "signature", "nhis_number", "nhf_number",
            "year_of_call_to_bar", "employment_status"):
    check(f"serializer exposes {key}", key in serialized,
          repr(serialized.get(key))[:60])

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
if photo_path and os.path.exists(photo_path):
    os.remove(photo_path)
if sig_path and os.path.exists(sig_path):
    os.remove(sig_path)
fresh.delete()
# Leave the test department/designation/grade in place — they may be reused.

print()
if errors:
    print(f"=== FAILED ({len(errors)} check{'s' if len(errors) != 1 else ''} did not pass) ===")
    for e in errors:
        print(f"   - {e}")
    sys.exit(1)
print("=== ALL CHECKS PASSED ===")
