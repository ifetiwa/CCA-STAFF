"""
Authentication and authorization views for the biodata management system.
"""

from django.shortcuts import render, redirect
from django.views.generic import View, TemplateView
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import HttpRequest, HttpResponse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from users.models import UserActivity
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class LoginView(View):
    """
    Secure login view with session and activity logging.
    """
    
    def get(self, request: HttpRequest):
        """Display login form."""
        if request.user.is_authenticated:
            return redirect('dashboard')
        
        return render(request, 'users/login.html', {
            'title': 'Login - CCA Staff Biodata Management System'
        })
    
    def post(self, request: HttpRequest):
        """Handle login form submission."""
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        remember_me = request.POST.get('remember_me') == 'on'
        
        # Validate input
        if not username or not password:
            return render(request, 'users/login.html', {
                'error': 'Username and password are required.',
                'username': username,
            })
        
        # Authenticate user
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Check if account is active
            if not user.is_active:
                return render(request, 'users/login.html', {
                    'error': 'Your account has been deactivated. Please contact the administrator.',
                    'username': username,
                })
            
            # Unlock account if lock time has passed
            if user.is_account_locked and user.account_locked_until:
                if timezone.now() >= user.account_locked_until:
                    user.is_account_locked = False
                    user.account_locked_until = None
                    user.failed_login_attempts = 0
                    user.save()
                else:
                    minutes_remaining = (user.account_locked_until - timezone.now()).seconds // 60
                    return render(request, 'users/login.html', {
                        'error': f'Account is locked. Try again in {minutes_remaining} minutes.',
                        'username': username,
                    })
            
            # Login user
            login(request, user)
            
            # Set session timeout (30 minutes)
            request.session.set_expiry(1800)  # 30 minutes in seconds
            
            # Handle "Remember Me"
            if remember_me:
                request.session.set_expiry(1209600)  # 2 weeks in seconds
            
            # Log login activity
            self._log_login_activity(request, user)
            
            # Redirect to next page or dashboard
            next_url = request.GET.get('next', 'dashboard')
            return redirect(next_url)
        else:
            # Check if account is locked
            try:
                user = User.objects.get(username=username)
                if user.is_account_locked:
                    remaining_attempts = 5 - user.failed_login_attempts
                    error_msg = f'Account locked due to too many failed attempts. Try again later.'
                else:
                    error_msg = 'Invalid username or password.'
            except User.DoesNotExist:
                error_msg = 'Invalid username or password.'
            
            return render(request, 'users/login.html', {
                'error': error_msg,
                'username': username,
            })
    
    @staticmethod
    def _get_client_ip(request: HttpRequest) -> str:
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    @staticmethod
    def _log_login_activity(request: HttpRequest, user: User):
        """Log login activity."""
        try:
            ip_address = LoginView._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            UserActivity.objects.create(
                user=user,
                activity_type='login',
                description=f'User logged in from IP: {ip_address}',
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as e:
            logger.error(f"Failed to log login activity: {str(e)}")


@method_decorator(login_required(login_url='login'), name='dispatch')
class LogoutView(View):
    """
    Logout view that logs the activity and clears the session.
    """
    
    def get(self, request: HttpRequest):
        """Handle logout."""
        user = request.user
        
        # Log logout activity
        try:
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            UserActivity.objects.create(
                user=user,
                activity_type='logout',
                description='User logged out',
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as e:
            logger.error(f"Failed to log logout activity: {str(e)}")
        
        # Logout user
        logout(request)
        
        return redirect('login')
    
    @staticmethod
    def _get_client_ip(request: HttpRequest) -> str:
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class AccessDeniedView(TemplateView):
    """
    403 Access Denied view for unauthorized users.
    """
    template_name = 'users/403.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = '403 - Access Denied'
        context['message'] = 'You do not have permission to access this page.'
        
        if self.request.user.is_authenticated:
            context['user_role'] = self.request.user.role.display_name if self.request.user.role else 'No Role'
        
        return context


class UnauthorizedView(TemplateView):
    """
    401 Unauthorized view for unauthenticated users.
    """
    template_name = 'users/401.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = '401 - Unauthorized'
        context['message'] = 'You must be logged in to access this page.'
        return context


@require_http_methods(["GET"])
def check_session(request: HttpRequest):
    """
    Check if user session is still valid (AJAX endpoint).
    Used for frontend session timeout handling.
    """
    if request.user.is_authenticated:
        return HttpResponse('{"status": "active"}', content_type='application/json')
    else:
        return HttpResponse('{"status": "inactive"}', content_type='application/json', status=401)


# ==================== USER MANAGEMENT VIEWS (SUPER ADMIN ONLY) ====================

def superadmin_only(view_func):
    """Decorator to restrict access to super admin only."""
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated or not request.user.is_superuser:
            return redirect('users:login')
        return view_func(request, *args, **kwargs)
    return wrapper


@superadmin_only
def user_management_list(request: HttpRequest):
    """Display list of all users with pagination."""
    from django.core.paginator import Paginator
    from django.db.models import Q
    
    # Get search and filter parameters
    search_query = request.GET.get('q', '').strip()
    filter_status = request.GET.get('status', '')
    filter_role = request.GET.get('role', '')
    
    # Start with all users
    users = User.objects.select_related('role').all()
    
    # Apply search
    if search_query:
        users = users.filter(
            Q(username__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(email__icontains=search_query)
        )
    
    # Apply status filter
    if filter_status == 'active':
        users = users.filter(is_active=True)
    elif filter_status == 'inactive':
        users = users.filter(is_active=False)
    
    # Apply role filter
    if filter_role:
        users = users.filter(role__role_name=filter_role)
    
    # Order by created date (newest first)
    users = users.order_by('-created_at')
    
    # Pagination
    paginator = Paginator(users, 20)
    page_num = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_num)
    
    # Get last login info for each user
    user_logins = {}
    from users.models import LoginActivity
    for user in page_obj:
        last_login = LoginActivity.objects.filter(
            user=user,
            success=True
        ).order_by('-login_timestamp').first()
        user_logins[user.id] = last_login
    
    # Get all roles for filter dropdown
    from users.models import Role
    roles = Role.objects.filter(is_active=True)
    
    context = {
        'title': 'User Management',
        'page_obj': page_obj,
        'user_logins': user_logins,
        'search_query': search_query,
        'filter_status': filter_status,
        'filter_role': filter_role,
        'roles': roles,
        'total_users': User.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
        'inactive_users': User.objects.filter(is_active=False).count(),
    }
    
    return render(request, 'users/management/user_list.html', context)


@superadmin_only
def user_management_create(request: HttpRequest):
    """Create a new user with auto-generated password."""
    from users.management_forms import CreateUserForm
    from django.core.mail import send_mail
    from django.template.loader import render_to_string
    from django.conf import settings
    
    if request.method == 'POST':
        form = CreateUserForm(request.POST)
        if form.is_valid():
            user = form.save()
            temp_password = user.temp_password
            
            # Log in audit trail
            from audit.models import AuditLog
            AuditLog.objects.create(
                user=request.user.username,
                user_email=request.user.email,
                action='CREATE',
                model_name='CustomUser',
                record_id=str(user.pk),
                record_identifier=f"{user.username} ({user.get_full_name()})",
                new_values={
                    'username': user.username,
                    'email': user.email,
                    'role': str(user.role),
                    'force_password_change': True,
                },
                ip_address=_get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                status='SUCCESS',
                remarks=f'New user created. Temporary password: {temp_password}'
            )
            
            # Send email with credentials if requested
            if request.POST.get('send_email'):
                try:
                    html_message = render_to_string('users/emails/new_user_credentials.html', {
                        'user': user,
                        'temporary_password': temp_password,
                        'login_url': request.build_absolute_uri('/login/'),
                    })
                    
                    send_mail(
                        subject='Your CCA Staff Biodata Management System Account',
                        message=f'Your temporary password is: {temp_password}',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[user.email],
                        html_message=html_message,
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.error(f"Failed to send email to {user.email}: {str(e)}")
            
            # Show temporary password
            context = {
                'title': 'User Created Successfully',
                'user': user,
                'temporary_password': temp_password,
                'email_sent': request.POST.get('send_email') == 'on',
            }
            return render(request, 'users/management/user_created.html', context)
    else:
        form = CreateUserForm()
    
    context = {
        'title': 'Create New User',
        'form': form,
    }
    return render(request, 'users/management/user_form.html', context)


@superadmin_only
def user_management_edit(request: HttpRequest, user_id: int):
    """Edit user details and permissions."""
    from users.management_forms import EditUserForm, ResetPasswordForm
    
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return render(request, 'errors/404.html', status=404)
    
    # Get last 10 logins
    from users.models import LoginActivity
    login_history = LoginActivity.objects.filter(
        user=user
    ).order_by('-login_timestamp')[:10]
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'edit':
            form = EditUserForm(request.POST, instance=user)
            if form.is_valid():
                old_values = {
                    'role': str(user.role) if user.role else None,
                    'is_active': user.is_active,
                }
                
                user = form.save()
                
                new_values = {
                    'role': str(user.role) if user.role else None,
                    'is_active': user.is_active,
                }
                
                # Log the change
                from audit.models import AuditLog
                changed_fields = []
                if old_values['role'] != new_values['role']:
                    changed_fields.append('role')
                if old_values['is_active'] != new_values['is_active']:
                    changed_fields.append('is_active')
                
                if changed_fields:
                    AuditLog.objects.create(
                        user=request.user.username,
                        user_email=request.user.email,
                        action='UPDATE',
                        model_name='CustomUser',
                        record_id=str(user.pk),
                        record_identifier=f"{user.username} ({user.get_full_name()})",
                        old_values=old_values,
                        new_values=new_values,
                        changed_fields=changed_fields,
                        ip_address=_get_client_ip(request),
                        user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        status='SUCCESS',
                    )
                
                return redirect('users:user_management_edit', user_id=user.pk)
        
        elif action == 'reset_password':
            form = ResetPasswordForm(request.POST)
            if form.is_valid():
                # Generate or use custom password
                custom_password = form.cleaned_data.get('custom_password', '').strip()
                if custom_password:
                    new_password = custom_password
                else:
                    from users.management_forms import CreateUserForm
                    new_password = CreateUserForm.generate_temporary_password()
                
                user.set_password(new_password)
                user.force_password_change = form.cleaned_data.get('force_change_on_login', True)
                user.save()
                
                # Log the password reset
                from audit.models import AuditLog
                AuditLog.objects.create(
                    user=request.user.username,
                    user_email=request.user.email,
                    action='UPDATE',
                    model_name='CustomUser',
                    record_id=str(user.pk),
                    record_identifier=f"{user.username} ({user.get_full_name()})",
                    new_values={'password_reset': True, 'force_change_on_login': user.force_password_change},
                    changed_fields=['password'],
                    ip_address=_get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    status='SUCCESS',
                    remarks='Password reset by admin'
                )
                
                # Send email if requested
                if form.cleaned_data.get('send_to_email'):
                    try:
                        from django.core.mail import send_mail
                        from django.template.loader import render_to_string
                        from django.conf import settings
                        
                        html_message = render_to_string('users/emails/password_reset.html', {
                            'user': user,
                            'new_password': new_password,
                        })
                        
                        send_mail(
                            subject='Your CCA Staff Biodata Password Reset',
                            message=f'Your new password is: {new_password}',
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            recipient_list=[user.email],
                            html_message=html_message,
                            fail_silently=False,
                        )
                    except Exception as e:
                        logger.error(f"Failed to send password reset email: {str(e)}")
                
                # Show password
                context = {
                    'title': f'Edit User: {user.get_full_name()}',
                    'user': user,
                    'login_history': login_history,
                    'new_password': new_password,
                    'show_new_password': True,
                }
                return render(request, 'users/management/user_edit.html', context)
    else:
        form = EditUserForm(instance=user)
    
    reset_form = ResetPasswordForm()
    
    context = {
        'title': f'Edit User: {user.get_full_name()}',
        'user': user,
        'form': form,
        'reset_form': reset_form,
        'login_history': login_history,
    }
    return render(request, 'users/management/user_edit.html', context)


@superadmin_only
def user_management_deactivate(request: HttpRequest, user_id: int):
    """Deactivate a user account."""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return render(request, 'errors/404.html', status=404)
    
    if request.method == 'POST':
        user.is_active = False
        user.save()
        
        # Log the deactivation
        from audit.models import AuditLog
        AuditLog.objects.create(
            user=request.user.username,
            user_email=request.user.email,
            action='UPDATE',
            model_name='CustomUser',
            record_id=str(user.pk),
            record_identifier=f"{user.username} ({user.get_full_name()})",
            old_values={'is_active': True},
            new_values={'is_active': False},
            changed_fields=['is_active'],
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            status='SUCCESS',
            remarks='User account deactivated by admin'
        )
        
        return redirect('users:user_management_list')
    
    context = {
        'title': 'Deactivate User',
        'user': user,
    }
    return render(request, 'users/management/user_deactivate_confirm.html', context)


def _get_client_ip(request: HttpRequest) -> str:
    """Get client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip or '0.0.0.0'

