"""Reusable file-upload validators.

Validates BOTH the file extension AND a magic-byte signature so an attacker
cannot smuggle a script by renaming it ``.jpg``.
"""
from __future__ import annotations

import os

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# (extension, [acceptable magic-byte signatures])
PHOTO_SIGNATURES = {
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
}

# .xlsx is a zip; .xls is the legacy OLE Compound File format. Per policy
# only .xlsx is accepted for imports.
EXCEL_SIGNATURES = {
    ".xlsx": [b"PK\x03\x04"],
}

MAX_PHOTO_BYTES = 5 * 1024 * 1024     # 5 MB
MAX_EXCEL_BYTES = 10 * 1024 * 1024    # 10 MB


def _read_head(file_obj, n: int = 16) -> bytes:
    try:
        pos = file_obj.tell()
    except (AttributeError, OSError):
        pos = None
    head = file_obj.read(n)
    if pos is not None:
        try:
            file_obj.seek(pos)
        except OSError:
            pass
    return head or b""


def _validate(file_obj, allowed: dict, max_bytes: int, kind: str):
    if file_obj is None:
        raise ValidationError(_("No file uploaded."))
    name = (file_obj.name or "").lower()
    ext = os.path.splitext(name)[1]
    if ext not in allowed:
        raise ValidationError(
            _("Only %(exts)s files are permitted for %(kind)s.")
            % {"exts": ", ".join(sorted(allowed)), "kind": kind}
        )
    size = getattr(file_obj, "size", None)
    if size is not None and size > max_bytes:
        raise ValidationError(
            _("File too large. Maximum size is %(mb).1f MB.")
            % {"mb": max_bytes / (1024 * 1024)}
        )
    head = _read_head(file_obj)
    if not any(head.startswith(sig) for sig in allowed[ext]):
        raise ValidationError(
            _("File contents do not match the %(ext)s format.") % {"ext": ext}
        )
    return file_obj


def validate_photo(file_obj):
    """Allow only .jpg/.jpeg/.png, with matching magic bytes, up to 5 MB."""
    return _validate(file_obj, PHOTO_SIGNATURES, MAX_PHOTO_BYTES, "photos")


def validate_excel(file_obj):
    """Allow only .xlsx, with matching magic bytes, up to 10 MB."""
    return _validate(file_obj, EXCEL_SIGNATURES, MAX_EXCEL_BYTES, "imports")
