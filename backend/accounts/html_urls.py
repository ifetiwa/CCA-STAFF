"""HTML routes for the super-admin user management panel.

Kept separate from ``accounts/urls.py`` so the React frontend's
``/api/accounts/...`` contract stays untouched. Mounted at ``/accounts/``
in :mod:`biodata_system.urls`.
"""
from django.urls import path

from . import management_views
from .password_change import password_change_required

app_name = "accounts_html"

urlpatterns = [
    path("manage/users/", management_views.user_list, name="user_list"),
    path("manage/users/create/", management_views.user_create, name="user_create"),
    path("manage/users/<int:user_id>/", management_views.user_edit, name="user_edit"),
    path(
        "manage/users/<int:user_id>/deactivate/",
        management_views.user_deactivate,
        name="user_deactivate",
    ),
    path(
        "password-change-required/",
        password_change_required,
        name="password_change_required",
    ),
]
