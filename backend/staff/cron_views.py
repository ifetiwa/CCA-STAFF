"""HTTP-triggered cron endpoints.

Render's free plan does not include native cron jobs, so we expose
management-command runners as secret-protected POST endpoints and call
them from a scheduled GitHub Actions workflow.

Auth model: the caller must send ``X-Cron-Secret: <value>`` matching the
``CRON_SHARED_SECRET`` environment variable. No Django auth/session is
used — this endpoint is meant for machine-to-machine calls.
"""
from __future__ import annotations

import hmac
import io
import os

from django.core.management import call_command
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


def _unauthorized(message: str) -> JsonResponse:
    return JsonResponse({"status": "error", "detail": message}, status=401)


def _check_secret(request) -> JsonResponse | None:
    expected = os.environ.get("CRON_SHARED_SECRET", "")
    if not expected:
        return _unauthorized("CRON_SHARED_SECRET not configured on server.")
    provided = request.headers.get("X-Cron-Secret", "")
    if not hmac.compare_digest(expected, provided):
        return _unauthorized("Invalid or missing X-Cron-Secret header.")
    return None


@csrf_exempt
@require_POST
def run_step_increments(request):
    """Trigger the apply_step_increments management command."""
    err = _check_secret(request)
    if err is not None:
        return err

    buf = io.StringIO()
    try:
        call_command("apply_step_increments", stdout=buf)
    except Exception as exc:  # pragma: no cover — surface failure to caller
        return JsonResponse(
            {"status": "error", "detail": str(exc), "output": buf.getvalue()},
            status=500,
        )
    return JsonResponse({"status": "ok", "output": buf.getvalue()})
