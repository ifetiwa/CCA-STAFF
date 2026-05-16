"""Authenticated media file serving.

Replaces ``django.views.static.serve`` for MEDIA_URL so passport photos and
any other uploaded files are only delivered to logged-in users. The view
canonicalises the path to keep it inside MEDIA_ROOT (no traversal) and
streams the file with the right Content-Type.
"""
from __future__ import annotations

import mimetypes
import os
import posixpath
from pathlib import Path
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import FileResponse, Http404


def _safe_join(root: Path, relpath: str) -> Path:
    """Resolve ``relpath`` under ``root``, refusing escapes."""
    relpath = unquote(relpath)
    relpath = posixpath.normpath(relpath.replace("\\", "/")).lstrip("/")
    if not relpath or relpath.startswith("..") or os.path.isabs(relpath):
        raise Http404
    target = (root / relpath).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        raise Http404
    return target


@login_required
def protected_media(request, path: str):
    """Serve a file from MEDIA_ROOT to authenticated users only."""
    root = Path(settings.MEDIA_ROOT)
    target = _safe_join(root, path)
    if not target.is_file():
        raise Http404
    content_type, _ = mimetypes.guess_type(str(target))
    response = FileResponse(
        target.open("rb"),
        content_type=content_type or "application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    # Force download for anything that isn't an image — keeps HTML/JS from
    # being interpreted by the browser even if it slipped past upload checks.
    if not (content_type or "").startswith("image/"):
        response["Content-Disposition"] = f'attachment; filename="{target.name}"'
    return response
