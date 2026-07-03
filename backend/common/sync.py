"""Shared offline-sync model mixin.

See docs/OFFLINE_FIRST_ARCHITECTURE.md. This lives outside any app because it
is an abstract model (not registered in the app registry) reused by staff,
departments and accounts.

``uuid`` is a stable, globally unique identity used to match rows across
devices. We deliberately keep each model's integer primary key so existing
foreign keys, routes and APIs are untouched. Deletes are soft (``is_deleted``
+ ``deleted_at``) so a deletion made on one device propagates instead of a row
silently reappearing after the next sync.

Note: ``updated_at`` is intentionally NOT part of this mixin — most synced
models already declare their own. Add ``updated_at = models.DateTimeField(
auto_now=True)`` on any synced model that lacks one.
"""
import uuid as uuid_lib

from django.db import models


class SyncModelMixin(models.Model):
    uuid = models.UUIDField(
        default=uuid_lib.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Global sync identity, stable across devices.",
    )
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Soft-delete tombstone flag (syncs deletions across devices).",
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this row was soft-deleted.",
    )

    class Meta:
        abstract = True
