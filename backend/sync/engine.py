"""Row-level serialize (pull) and apply (push) logic for the sync API.

Design notes (see docs/OFFLINE_FIRST_ARCHITECTURE.md):
  * Rows are keyed by ``uuid`` across devices; the integer PK never leaves the
    server.
  * Foreign keys are exchanged as ``<fk>_uuid``.
  * Conflict policy is last-write-wins by ``updated_at``: if the server row is
    newer than the incoming change, the server wins and the row is reported as
    a conflict (not applied).
  * Writes go through ``Model.save()`` so Staff auto-calculations, and any
    model-level logic, run exactly as they do for a normal API write.
  * Image fields (passport photo, signature) are synced out-of-band, not here.
"""
from django.db.models.fields.files import FieldFile
from django.utils import timezone
from django.utils.dateparse import parse_datetime


def serialize_row(spec, obj) -> dict:
    """Serialize a model instance into a JSON-safe sync dict.

    DRF's JSON renderer handles ``date``/``datetime``/``Decimal``/``UUID``, so
    native values are returned as-is except file fields (emitted as a path).
    """
    data = {}
    for f in obj._meta.concrete_fields:
        name = f.name
        if name == "id":
            continue  # server-only integer PK, never leaves the server
        if f.is_relation:
            rel = getattr(obj, name, None)
            data[f"{name}_uuid"] = rel.uuid if rel is not None else None
            continue
        value = getattr(obj, name)
        if isinstance(value, FieldFile):
            data[name] = value.name or None  # path only; blob syncs out-of-band
        else:
            data[name] = value
    return data


def _parse_dt(value):
    if not value:
        return None
    dt = parse_datetime(value) if isinstance(value, str) else value
    if dt is not None and timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def apply_row(spec, row: dict, user) -> str:
    """Apply one incoming change. Returns 'applied' or 'conflict'.

    Raises on malformed rows so the caller can report a per-row error.
    """
    row_uuid = row.get("uuid")
    if not row_uuid:
        raise ValueError("row is missing 'uuid'")

    incoming_updated = _parse_dt(row.get("updated_at"))
    obj = spec.model.objects.filter(uuid=row_uuid).first()

    # Last-write-wins: server keeps its version if it is strictly newer.
    if obj and incoming_updated and obj.updated_at and obj.updated_at > incoming_updated:
        return "conflict"

    # Soft delete (tombstone).
    if row.get("_deleted"):
        if obj and not obj.is_deleted:
            obj.is_deleted = True
            obj.deleted_at = timezone.now()
            obj.save()
        return "applied"

    field_map = {f.name: f for f in spec.model._meta.concrete_fields}
    values = {}
    for key, raw in row.items():
        if key in ("_deleted", "id", "uuid", "created_at"):
            continue
        # Foreign key sent as <fk>_uuid -> resolve to the related instance.
        if key.endswith("_uuid"):
            base = key[:-len("_uuid")]
            if base in spec.fk_fields:
                rel_model = spec.fk_fields[base]
                values[base] = rel_model.objects.filter(uuid=raw).first() if raw else None
            continue
        if key in spec.write_denylist or key not in field_map:
            continue
        f = field_map[key]
        if isinstance(f, FieldFile) or f.get_internal_type() in ("FileField", "ImageField"):
            continue  # photos handled out-of-band
        if getattr(f, "auto_now", False) or getattr(f, "auto_now_add", False):
            continue  # server manages these timestamps
        values[key] = f.to_python(raw)

    if obj:
        for key, val in values.items():
            setattr(obj, key, val)
        # An update implicitly un-deletes unless _deleted was set (handled above).
        obj.is_deleted = bool(values.get("is_deleted", False))
        obj.save()
    else:
        values["uuid"] = row_uuid
        spec.model.objects.create(**values)
    return "applied"
