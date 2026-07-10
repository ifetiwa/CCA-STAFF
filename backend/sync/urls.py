"""URL routes for the offline-sync API (mounted at /api/sync/)."""
from django.urls import path

from .views import SyncPhotoView, SyncPullView, SyncPushView

app_name = "sync"

urlpatterns = [
    path("pull/", SyncPullView.as_view(), name="pull"),
    path("push/", SyncPushView.as_view(), name="push"),
    path("photo/", SyncPhotoView.as_view(), name="photo"),
]
