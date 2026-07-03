"""Registry of models exposed over the offline-sync API.

See docs/OFFLINE_FIRST_ARCHITECTURE.md. Each ``SyncSpec`` declares a model, its
public key (used in the pull/push payloads), and how its foreign keys map to
related rows. Foreign keys are exchanged as the related row's ``uuid`` (field
name ``<fk>_uuid``) so clients can link records locally without knowing the
server's integer primary keys.

``accounts.User`` is deliberately NOT synced here — pushing/pulling password
hashes to clients is handled separately by the offline-auth cache (Phase 3).
"""
from dataclasses import dataclass, field
from typing import Type

from django.db import models

from departments.models import (
    Department, Designation, GradeLevel, PostingLocation, DesignationOption,
)
from staff.models import Staff, StaffTransfer, StaffPromotion, Notification


@dataclass(frozen=True)
class SyncSpec:
    key: str
    model: Type[models.Model]
    # local FK field name -> related model (related row identified by its uuid)
    fk_fields: dict = field(default_factory=dict)
    # can clients push changes for this model? (False = pull-only)
    writable: bool = True
    # fields never accepted from clients (server-computed / derived)
    write_denylist: tuple = ()


SPECS = [
    SyncSpec("department", Department),
    SyncSpec("designation", Designation),
    SyncSpec("gradelevel", GradeLevel),
    SyncSpec("postinglocation", PostingLocation),
    SyncSpec("designationoption", DesignationOption),
    SyncSpec(
        "staff", Staff,
        fk_fields={
            "department": Department,
            "designation": Designation,
            "posting_location": PostingLocation,
            "grade_level": GradeLevel,
        },
        # These are recomputed by Staff.save(); never trust client values.
        write_denylist=(
            "years_of_service", "retirement_date", "retirement_date_age_60",
            "retirement_date_service_35", "retirement_basis",
            "years_remaining_to_retirement", "months_remaining_to_retirement",
            "next_promotion_date",
        ),
    ),
    SyncSpec(
        "stafftransfer", StaffTransfer,
        fk_fields={
            "staff": Staff,
            "from_location": PostingLocation,
            "to_location": PostingLocation,
        },
    ),
    SyncSpec(
        "staffpromotion", StaffPromotion,
        fk_fields={
            "staff": Staff,
            "new_designation": Designation,
            "new_grade": GradeLevel,
        },
    ),
    # Notifications are generated server-side; clients read but do not push them.
    SyncSpec("notification", Notification, fk_fields={"staff": Staff}, writable=False),
]

SPECS_BY_KEY = {s.key: s for s in SPECS}
