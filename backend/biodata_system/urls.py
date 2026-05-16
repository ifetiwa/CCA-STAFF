"""Root URL configuration for biodata_system."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework.authtoken.views import obtain_auth_token

from accounts.media_views import protected_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", obtain_auth_token, name="api_token_auth"),
    path("api/accounts/", include("accounts.urls", namespace="accounts")),
    # HTML panel for super-admin user management (separate routes file so
    # the React frontend's API contract under /api/ is untouched).
    path("accounts/", include("accounts.html_urls", namespace="accounts_html")),
    path("api/staff/", include("staff.urls")),
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
