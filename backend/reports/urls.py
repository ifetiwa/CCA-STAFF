from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("", views.index, name="index"),

    # 1. Full Staff Register
    path("full-register/", views.full_register, name="full_register"),
    path("full-register/export.pdf", views.full_register_pdf, name="full_register_pdf"),
    path("full-register/export.xlsx", views.full_register_excel, name="full_register_excel"),

    # 2. Promotion Due
    path("promotion-due/", views.promotion_due, name="promotion_due"),
    path("promotion-due/export.pdf", views.promotion_due_pdf, name="promotion_due_pdf"),
    path("promotion-due/export.xlsx", views.promotion_due_excel, name="promotion_due_excel"),

    # 3. Retirement Projection
    path("retirement-projection/", views.retirement_projection, name="retirement_projection"),
    path("retirement-projection/export.pdf", views.retirement_projection_pdf, name="retirement_projection_pdf"),
    path("retirement-projection/export.xlsx", views.retirement_projection_excel, name="retirement_projection_excel"),

    # 4. Staff by Department
    path("by-department/", views.by_department, name="by_department"),
    path("by-department/export.pdf", views.by_department_pdf, name="by_department_pdf"),
    path("by-department/export.xlsx", views.by_department_excel, name="by_department_excel"),

    # 5. Staff by Posting Location
    path("by-location/", views.by_location, name="by_location"),
    path("by-location/export.pdf", views.by_location_pdf, name="by_location_pdf"),
    path("by-location/export.xlsx", views.by_location_excel, name="by_location_excel"),

    # 6. New Appointments
    path("new-appointments/", views.new_appointments, name="new_appointments"),
    path("new-appointments/export.pdf", views.new_appointments_pdf, name="new_appointments_pdf"),
    path("new-appointments/export.xlsx", views.new_appointments_excel, name="new_appointments_excel"),

    # 7. Pre-Handover Testing Checklist
    path("testing-checklist/data/", views.testing_checklist_data, name="testing_checklist_data"),
    path("testing-checklist/export.pdf", views.testing_checklist_pdf, name="testing_checklist_pdf"),
]
