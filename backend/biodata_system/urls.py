"""Root URL configuration for biodata_system."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework.authtoken.views import obtain_auth_token

from accounts.media_views import protected_media
from staff.cron_views import run_step_increments


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", obtain_auth_token, name="api_token_auth"),
    # Secret-protected machine endpoint, called daily by GitHub Actions
    # to advance step-increments. See .github/workflows/step-increments.yml.
    path("api/cron/apply-step-increments/", run_step_increments, name="cron_step_increments"),
    path("api/accounts/", include("accounts.urls", namespace="accounts")),
    # HTML panel for super-admin user management (separate routes file so
    # the React frontend's API contract under /api/ is untouched).
    path("accounts/", include("accounts.html_urls", namespace="accounts_html")),
    # JSON API used by the React SPA. ``staff.api_urls`` is the single source
    # of truth for staff + department + designation + grade-level endpoints
    # under /api/staff/<resource>/. The previous /api/ mount of
    # departments.urls and /staff/ mount of the HTML views are gone — they
    # duplicated routes, returned slightly different payloads, and referenced
    # removed fields (e.g. salaryAnnualNGN) inside their templates.
    path("api/staff/", include("staff.api_urls")),
    # Offline-first sync API (pull/push) for the desktop clients.
    path("api/sync/", include("sync.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/audit/", include("audit.urls")),
    path("api/notifications/", include("notifications.urls", namespace="notifications")),
    path("reports/", include("reports.urls", namespace="reports")),
    # Authenticated media — replaces the dev-only static() handler so
    # passport photos and uploads aren't world-readable.
    re_path(r"^media/(?P<path>.+)$", protected_media, name="protected-media"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Wire the 403 page so RoleRequiredMixin / require_role can redirect anonymous
# users to a branded page rather than Django's default response.
handler403 = "accounts.views.access_denied_view"
