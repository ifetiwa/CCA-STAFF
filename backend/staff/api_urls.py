from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet,
    DesignationViewSet,
    GradeLevelViewSet,
    PostingLocationViewSet,
    StaffViewSet,
)

app_name = "staff_api"

router = DefaultRouter()
router.register("departments", DepartmentViewSet)
router.register("posting-locations", PostingLocationViewSet)
router.register("designations", DesignationViewSet)
router.register("grade-levels", GradeLevelViewSet)
router.register("", StaffViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
