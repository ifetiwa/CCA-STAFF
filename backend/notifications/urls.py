from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.list_notifications, name="list"),
    path("unread-count/", views.unread_count, name="unread-count"),
    path("mark-all-read/", views.mark_all_as_read, name="mark-all-read"),
    path("<int:pk>/read/", views.mark_as_read, name="mark-read"),
]
