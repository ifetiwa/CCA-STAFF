from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AuditLogViewSet,
    LoginAttemptViewSet,
    SuspiciousActivityViewSet,
    my_activity,
    user_activity,
    users_activity_panel,
)

router = DefaultRouter()
router.register("entries", AuditLogViewSet, basename="audit-entry")
router.register("suspicious", SuspiciousActivityViewSet, basename="audit-suspicious")
router.register("login-attempts", LoginAttemptViewSet, basename="audit-login-attempt")

urlpatterns = [
    path("activity/me/", my_activity, name="audit-activity-me"),
    path("activity/users/", users_activity_panel, name="audit-activity-users"),
    path("activity/user/<str:username>/", user_activity, name="audit-activity-user"),
    path("", include(router.urls)),
]
