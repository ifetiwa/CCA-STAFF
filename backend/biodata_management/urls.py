"""
Root URL configuration for the biodata_management project.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    path("admin/", admin.site.urls),

    # HTML pages
    path("staff/", include("staff.urls")),

    # JSON API
    path("api/staff/", include("staff.api_urls")),
    path("api/audit/", include("audit.urls")),

    path("auth/", include("users.urls")),

    # Convenience: land on the staff list at "/"
    path("", RedirectView.as_view(pattern_name="staff:list", permanent=False)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
