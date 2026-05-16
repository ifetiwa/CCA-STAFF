"""
URL configuration for the users app.
"""

from django.urls import path
from . import views

app_name = 'users'

urlpatterns = [
    # Authentication URLs
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # Error pages
    path('403-access-denied/', views.AccessDeniedView.as_view(), name='access_denied'),
    path('401-unauthorized/', views.UnauthorizedView.as_view(), name='unauthorized'),
    
    # Session management
    path('check-session/', views.check_session, name='check_session'),
    
    # User Management (Super Admin Only)
    path('management/', views.user_management_list, name='user_management_list'),
    path('management/create/', views.user_management_create, name='user_management_create'),
    path('management/<int:user_id>/edit/', views.user_management_edit, name='user_management_edit'),
    path('management/<int:user_id>/deactivate/', views.user_management_deactivate, name='user_management_deactivate'),
]
