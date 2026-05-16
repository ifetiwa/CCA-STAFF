from django.urls import path

from .views import DashboardDataView, DashboardSummaryView, executive_dashboard

app_name = "dashboard"

urlpatterns = [
    path("", executive_dashboard, name="executive"),
    path("summary/", DashboardSummaryView.as_view(), name="summary"),
    path("data/", DashboardDataView.as_view(), name="data"),
]
