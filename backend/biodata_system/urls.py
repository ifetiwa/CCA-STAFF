"""Root URL configuration for biodata_system."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework.authtoken.views import obtain_auth_token

from accounts.media_views import protected_media


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", obtain_auth_token, name="api_token_auth"),
    path("api/accounts/", include("accounts.urls", namespace="accounts")),
    # HTML panel for super-admin user management (separate routes file so
    # the React frontend's API contract under /api/ is untouched).
    path("accounts/", include("accounts.html_urls", namespace="accounts_html")),
    # JSON API used by the React SPA — DRF ViewSets with TokenAuthentication
    # (CSRF-exempt by design).
    path("api/staff/", include("staff.api_urls")),
    # HTML staff pages (server-rendered). Kept available under /staff/ for
    # internal flows that don't go through the SPA. Mounting them at
    # /api/staff/ broke the SPA's PUT/POST requests because CsrfViewMiddleware
    # rejected the token-only requests with 403.
    path("staff/", include("staff.urls")),
    path("api/", include("departments.urls", namespace="departments")),
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
