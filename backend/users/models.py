from django.db import models
from django.contrib.auth.models import AbstractUser


class Role(models.Model):
    """
    Custom roles for the system.
    """
    ROLE_CHOICES = [
        ('admin_staff', 'Admin Staff'),
        ('director', 'Director'),
        ('chief_registrar', 'Chief Registrar'),
        ('president', 'President'),
        ('staff', 'Regular Staff'),
    ]
    
    role_name = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        unique=True,
        help_text="Role identifier"
    )
    display_name = models.CharField(
        max_length=100,
        help_text="Display name for the role"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the role and its responsibilities"
    )
    permissions = models.JSONField(
        default=dict,
        help_text="JSON object with role permissions"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this role active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users_role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['display_name']

    def __str__(self):
        return self.display_name


class CustomUser(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.
    """
    staff = models.OneToOneField(
        'staff.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_account',
        help_text="Associated staff record"
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        help_text="User role"
    )
    employee_id = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        help_text="Employee ID"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Phone number"
    )
    department = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Department"
    )
    is_staff_user = models.BooleanField(
        default=False,
        help_text="Is this user a staff member in the organization"
    )
    last_login_ip = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text="Last login IP address"
    )
    failed_login_attempts = models.IntegerField(
        default=0,
        help_text="Number of failed login attempts"
    )
    account_locked_until = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Account locked until this datetime"
    )
    is_account_locked = models.BooleanField(
        default=False,
        help_text="Is this account currently locked"
    )
    password_changed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Last password change datetime"
    )
    force_password_change = models.BooleanField(
        default=False,
        help_text="Force user to change password on next login"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="User who created this account"
    )

    class Meta:
        db_table = 'users_customuser'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['username']
        permissions = [
            ('can_view_audit_logs', 'Can view audit logs'),
            ('can_export_data', 'Can export data'),
            ('can_manage_users', 'Can manage users'),
            ('can_view_reports', 'Can view reports'),
        ]

    def __str__(self):
        return f"{self.username} ({self.get_full_name()})"

    def get_full_name(self):
        """Return the user's full name."""
        full_name = f"{self.first_name} {self.last_name}"
        return full_name.strip() or self.username

    def has_role(self, role_name):
        """Check if user has a specific role."""
        return self.role and self.role.role_name == role_name

    def has_permission(self, permission):
        """Check if user has a specific permission."""
        if self.is_superuser:
            return True
        if not self.role:
            return False
        return permission in self.role.permissions.get('permissions', [])


class UserActivity(models.Model):
    """
    Log user activities and login history.
    """
    ACTIVITY_TYPE_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('password_change', 'Password Change'),
        ('account_lock', 'Account Lock'),
        ('account_unlock', 'Account Unlock'),
        ('data_export', 'Data Export'),
        ('record_view', 'Record View'),
        ('record_create', 'Record Create'),
        ('record_update', 'Record Update'),
        ('record_delete', 'Record Delete'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    activity_type = models.CharField(
        max_length=50,
        choices=ACTIVITY_TYPE_CHOICES,
        help_text="Type of activity"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the activity"
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text="IP address from which activity occurred"
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        help_text="User agent information"
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users_useractivity'
        verbose_name = 'User Activity'
        verbose_name_plural = 'User Activities'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['activity_type', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} ({self.timestamp})"


class LoginActivity(models.Model):
    """
    Track login history for each user.
    Stores last 10 logins with timestamps and IP addresses.
    """
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='login_history'
    )
    ip_address = models.GenericIPAddressField(
        help_text="IP address from which login occurred"
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        help_text="User agent information (browser, OS)"
    )
    login_timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )
    logout_timestamp = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When user logged out (if tracked)"
    )
    success = models.BooleanField(
        default=True,
        help_text="Was the login attempt successful"
    )
    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Reason for failed login attempt"
    )

    class Meta:
        db_table = 'users_loginactivity'
        verbose_name = 'Login Activity'
        verbose_name_plural = 'Login Activities'
        ordering = ['-login_timestamp']
        indexes = [
            models.Index(fields=['user', '-login_timestamp']),
            models.Index(fields=['-login_timestamp']),
        ]

    def __str__(self):
        status = 'Success' if self.success else 'Failed'
        return f"{self.user.username} - {status} - {self.login_timestamp}"

