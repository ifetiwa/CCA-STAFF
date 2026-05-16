"""
Custom authentication backend for the biodata management system.
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.utils import timezone
from users.models import UserActivity
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class CustomAuthBackend(ModelBackend):
    """
    Custom authentication backend that logs login/logout activities
    and checks account lock status.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate user with username and password.
        Check if account is locked due to failed login attempts.
        """
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Log failed login attempt
            if request:
                self._log_failed_login(request, username, "User not found")
            return None
        
        # Check if account is locked
        if user.is_account_locked:
            if request:
                logger.warning(f"Login attempt for locked account: {username}")
                self._log_failed_login(request, username, "Account locked")
            return None
        
        # Validate password
        if user.check_password(password) and self.user_can_authenticate(user):
            # Reset failed login attempts on successful authentication
            user.failed_login_attempts = 0
            user.account_locked_until = None
            user.last_login_ip = self._get_client_ip(request) if request else None
            user.save(update_fields=['failed_login_attempts', 'account_locked_until', 'last_login_ip'])
            
            # Log successful login
            if request:
                self._log_activity(request, user, 'login', 'Successful login')
            
            return user
        else:
            # Increment failed login attempts
            user.failed_login_attempts += 1
            
            # Lock account after 5 failed attempts for 15 minutes
            if user.failed_login_attempts >= 5:
                user.is_account_locked = True
                user.account_locked_until = timezone.now() + timezone.timedelta(minutes=15)
                logger.warning(f"Account locked due to failed login attempts: {username}")
            
            user.save(update_fields=['failed_login_attempts', 'is_account_locked', 'account_locked_until'])
            
            # Log failed login attempt
            if request:
                self._log_failed_login(request, username, "Invalid password")
            
            return None
    
    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
    
    @staticmethod
    def _get_client_ip(request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    @staticmethod
    def _log_activity(request, user, activity_type, description):
        """Log user activity."""
        try:
            ip_address = CustomAuthBackend._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            UserActivity.objects.create(
                user=user,
                activity_type=activity_type,
                description=description,
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as e:
            logger.error(f"Failed to log activity: {str(e)}")
    
    @staticmethod
    def _log_failed_login(request, username, reason):
        """Log failed login attempt."""
        try:
            logger.warning(f"Failed login for {username}: {reason}")
            # Log as generic activity or user activity if user exists
        except Exception as e:
            logger.error(f"Failed to log failed login: {str(e)}")
