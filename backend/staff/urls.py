from django.urls import path

from .views import (
    confirm_promotion,
    deployment_overview,
    locations_overview,
    promotions_due,
    record_promotion,
    register_staff,
    retirement_monitor,
    retirement_export_csv,
    staff_detail,
    staff_export_csv,
    staff_export_pdf,
    staff_list,
    staff_update_fields,
    staff_update_photo,
    transfer_staff,
    import_staff,
    import_preview,
    import_complete,
    download_staff_template,
)

app_name = "staff"

urlpatterns = [
    path("", staff_list, name="list"),
    path("register/", register_staff, name="register"),
    path("export.csv", staff_export_csv, name="export_csv"),
    path("export.pdf", staff_export_pdf, name="export_pdf"),
    path("import/", import_staff, name="import"),
    path("import/preview/", import_preview, name="import_preview"),
    path("import/complete/", import_complete, name="import_complete"),
    path("import/download-template/", download_staff_template, name="download_template"),
    path("<int:pk>/", staff_detail, name="detail"),
    path("<int:pk>/update/", staff_update_fields, name="update_fields"),
    path("<int:pk>/photo/", staff_update_photo, name="update_photo"),
    path("<int:pk>/promote/", record_promotion, name="record_promotion"),
    path("<int:pk>/confirm-promotion/", confirm_promotion, name="confirm_promotion"),
    path("promotions-due/", promotions_due, name="promotions_due"),
    path("locations/", locations_overview, name="locations_overview"),
    path("deployment/", deployment_overview, name="deployment_overview"),
    path("<int:pk>/transfer/", transfer_staff, name="transfer_staff"),
    path("retirement-monitor/", retirement_monitor, name="retirement_monitor"),
    path("retirement-monitor/export.csv", retirement_export_csv, name="retirement_export_csv"),
]
