"""
Role-based access control utilities for the biodata management system.
"""

from functools import wraps
from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.shortcuts import redirect
from django.http import HttpResponseForbidden
from django.views.generic import View


class RoleRequiredMixin(View):
    """
    Mixin to check user role before allowing view access.
    
    Usage:
        class MyView(RoleRequiredMixin, TemplateView):
            allowed_roles = ['admin_staff', 'director']
            template_name = 'my_template.html'
    """
    allowed_roles = []  # List of allowed role names
    redirect_url = '/403-access-denied/'  # URL to redirect to on access denied
    
    def dispatch(self, request, *args, **kwargs):
        """Check role before dispatching the view."""
        if not request.user.is_authenticated:
            return redirect('login')
        
        # Superusers always have access
        if request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)
        
        # Check if user has required role
        if self.allowed_roles:
            user_role = request.user.role.role_name if request.user.role else None
            
            if user_role not in self.allowed_roles:
                return redirect(self.redirect_url)
        
        return super().dispatch(request, *args, **kwargs)


class PermissionRequiredMixin(View):
    """
    Mixin to check specific permission before allowing view access.
    
    Usage:
        class MyView(PermissionRequiredMixin, TemplateView):
            required_permission = 'can_export_data'
            template_name = 'my_template.html'
    """
    required_permission = None
    redirect_url = '/403-access-denied/'
    
    def dispatch(self, request, *args, **kwargs):
        """Check permission before dispatching the view."""
        if not request.user.is_authenticated:
            return redirect('login')
        
        # Superusers always have access
        if request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)
        
        # Check if user has required permission
        if self.required_permission:
            if not request.user.has_permission(self.required_permission):
                return redirect(self.redirect_url)
        
        return super().dispatch(request, *args, **kwargs)


def require_role(allowed_roles=None):
    """
    Decorator to check user role before allowing function-based view access.
    
    Usage:
        @require_role(['admin_staff', 'director'])
        def my_view(request):
            return render(request, 'template.html')
    
    Args:
        allowed_roles (list): List of allowed role names
    """
    if allowed_roles is None:
        allowed_roles = []
    
    def decorator(view_func):
        @wraps(view_func)
        @login_required(login_url='login')
        def wrapper(request, *args, **kwargs):
            # Superusers always have access
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Check if user has required role
            if allowed_roles:
                user_role = request.user.role.role_name if request.user.role else None
                
                if user_role not in allowed_roles:
                    return redirect('/403-access-denied/')
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator


def require_permission(permission_name):
    """
    Decorator to check specific permission before allowing function-based view access.
    
    Usage:
        @require_permission('can_export_data')
        def export_view(request):
            return HttpResponse('Exported data')
    
    Args:
        permission_name (str): Permission to check
    """
    def decorator(view_func):
        @wraps(view_func)
        @login_required(login_url='login')
        def wrapper(request, *args, **kwargs):
            # Superusers always have access
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Check if user has required permission
            if not request.user.has_permission(permission_name):
                return redirect('/403-access-denied/')
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator


def require_roles_and_permission(allowed_roles=None, permission_name=None):
    """
    Decorator to check both role AND permission.
    
    Usage:
        @require_roles_and_permission(
            allowed_roles=['admin_staff'],
            permission_name='can_manage_users'
        )
        def manage_users_view(request):
            return render(request, 'manage_users.html')
    """
    if allowed_roles is None:
        allowed_roles = []
    
    def decorator(view_func):
        @wraps(view_func)
        @login_required(login_url='login')
        def wrapper(request, *args, **kwargs):
            # Superusers always have access
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Check role if specified
            if allowed_roles:
                user_role = request.user.role.role_name if request.user.role else None
                if user_role not in allowed_roles:
                    return redirect('/403-access-denied/')
            
            # Check permission if specified
            if permission_name:
                if not request.user.has_permission(permission_name):
                    return redirect('/403-access-denied/')
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator
