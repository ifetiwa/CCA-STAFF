from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DesignationOptionViewSet

app_name = 'departments'

router = DefaultRouter()
router.register('designations', DesignationOptionViewSet, basename='designation')

urlpatterns = [
    path('', include(router.urls)),
]
