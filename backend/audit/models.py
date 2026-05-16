from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
import json


class AuditLog(models.Model):
    """
    Comprehensive audit logging for all system changes.
    Tracks who did what, when, and on which record.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('VIEW', 'View'),
        ('SEARCH', 'Search'),
        ('DOWNLOAD', 'Download'),
        ('EXPORT', 'Export'),
        ('BULK_IMPORT', 'Bulk Import'),
        ('LOGIN', 'Login'),
        ('LOGIN_FAILED', 'Login Failed'),
        ('LOGOUT', 'Logout'),
        ('APPROVE', 'Approve'),
        ('REJECT', 'Reject'),
        ('OTHER', 'Other'),
    ]

    # User who performed the action
    user = models.CharField(
        max_length=200,
        help_text="Username of the user who performed the action"
    )
    user_email = models.EmailField(
        blank=True,
        null=True,
        help_text="Email of the user who performed the action"
    )
    
    # Action details
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        help_text="Type of action performed"
    )
    
    # Model/Record information
    model_name = models.CharField(
        max_length=100,
        help_text="Name of the model/table affected"
    )
    record_id = models.CharField(
        max_length=200,
        help_text="ID of the record affected"
    )
    record_identifier = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Human-readable identifier of the record (e.g., staff name)"
    )
    
    # Change details
    old_values = models.JSONField(
        default=dict,
        blank=True,
        null=True,
        help_text="Previous values of changed fields (JSON)"
    )
    new_values = models.JSONField(
        default=dict,
        blank=True,
        null=True,
        help_text="New values of changed fields (JSON)"
    )
    changed_fields = models.JSONField(
        default=list,
        blank=True,
        null=True,
        help_text="List of fields that were changed"
    )
    
    # Request information
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text="IP address from which the action was performed"
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        help_text="User agent of the browser/client"
    )
    request_method = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text="HTTP method (GET, POST, PUT, DELETE, etc.)"
    )
    request_path = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Request URL path"
    )
    
    # Additional context
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional remarks about the action"
    )
    status = models.CharField(
        max_length=50,
        default='SUCCESS',
        choices=[
            ('SUCCESS', 'Success'),
            ('FAILURE', 'Failure'),
            ('PARTIAL', 'Partial'),
        ],
        help_text="Status of the action"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Error message if action failed"
    )
    
    # Timestamps
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'audit_auditlog'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['model_name', 'record_id']),
            models.Index(fields=['action', '-timestamp']),
            models.Index(fields=['ip_address', '-timestamp']),
            models.Index(fields=['-timestamp']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.model_name}:{self.record_id} ({self.timestamp})"

    def get_changes_summary(self):
        """
        Return a human-readable summary of changes.
        """
        if not self.changed_fields:
            return "No changes recorded"
        
        summary_parts = []
        for field in self.changed_fields:
            old_val = self.old_values.get(field, 'N/A') if self.old_values else 'N/A'
            new_val = self.new_values.get(field, 'N/A') if self.new_values else 'N/A'
            summary_parts.append(f"{field}: {old_val} → {new_val}")
        
        return "; ".join(summary_parts)


class AuditLogArchive(models.Model):
    """
    Archive for old audit logs (for data retention/compliance).
    """
    audit_log_id = models.BigIntegerField(
        help_text="Original audit log ID"
    )
    user = models.CharField(max_length=200)
    user_email = models.EmailField(blank=True, null=True)
    action = models.CharField(max_length=50)
    model_name = models.CharField(max_length=100)
    record_id = models.CharField(max_length=200)
    record_identifier = models.CharField(max_length=500, blank=True, null=True)
    old_values = models.JSONField(default=dict, blank=True, null=True)
    new_values = models.JSONField(default=dict, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField()
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_auditlogarchive'
        verbose_name = 'Audit Log Archive'
        verbose_name_plural = 'Audit Log Archives'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['model_name', 'record_id']),
            models.Index(fields=['-timestamp']),
        ]

    def __str__(self):
        return f"Archived: {self.user} - {self.action} - {self.model_name}:{self.record_id}"


class AuditSettings(models.Model):
    """
    Configuration for audit logging behavior.
    """
    retention_days = models.IntegerField(
        default=365,
        help_text="Number of days to retain audit logs before archiving"
    )
    archive_old_logs = models.BooleanField(
        default=True,
        help_text="Whether to archive old logs instead of deleting"
    )
    log_all_views = models.BooleanField(
        default=False,
        help_text="Whether to log every view/read action"
    )
    log_failed_logins = models.BooleanField(
        default=True,
        help_text="Whether to log failed login attempts"
    )
    notify_on_critical_changes = models.BooleanField(
        default=True,
        help_text="Whether to send notifications on critical record changes"
    )
    critical_models = models.JSONField(
        default=list,
        help_text="List of model names to consider as critical"
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'audit_auditsettings'
        verbose_name = 'Audit Settings'
        verbose_name_plural = 'Audit Settings'

    def __str__(self):
        return "Global Audit Settings"

    @classmethod
    def get_settings(cls):
        """Get or create the global audit settings."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class LoginAttempt(models.Model):
    """Every login attempt (success or failure). Powers the failed-login
    flag in the suspicious-activity detector."""
    username_tried = models.CharField(
        max_length=200,
        help_text="The identifier (username or email) the user typed.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_attempts",
        help_text="Resolved user (only set on success or known account).",
    )
    success = models.BooleanField(default=False, db_index=True)
    failure_reason = models.CharField(max_length=200, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_loginattempt"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["username_tried", "-timestamp"]),
            models.Index(fields=["ip_address", "-timestamp"]),
            models.Index(fields=["success", "-timestamp"]),
        ]

    def __str__(self):
        status = "OK" if self.success else "FAIL"
        return f"[{status}] {self.username_tried} from {self.ip_address} at {self.timestamp}"


class UserKnownIP(models.Model):
    """IP addresses a user has previously logged in from. New IPs trigger
    a suspicious-activity flag."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="known_ips",
    )
    ip_address = models.GenericIPAddressField()
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    login_count = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "audit_userknownip"
        unique_together = [("user", "ip_address")]
        indexes = [
            models.Index(fields=["user", "-last_seen"]),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.ip_address}"


class SuspiciousActivity(models.Model):
    """Flagged activity for admin review. Each row represents one alert
    raised by the detector (excessive views, login from a new IP, repeated
    failed logins, etc.)."""

    class Kind(models.TextChoices):
        EXCESSIVE_VIEWS = "EXCESSIVE_VIEWS", "Excessive record views"
        NEW_IP_LOGIN = "NEW_IP_LOGIN", "Login from a new IP"
        FAILED_LOGINS = "FAILED_LOGINS", "Repeated failed login attempts"
        OTHER = "OTHER", "Other"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    kind = models.CharField(
        max_length=32, choices=Kind.choices, db_index=True,
    )
    severity = models.CharField(
        max_length=10, choices=Severity.choices, default=Severity.MEDIUM,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suspicious_activities",
    )
    username = models.CharField(
        max_length=200, blank=True, default="",
        help_text="Username at time of event (kept even if user is later deleted).",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    description = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    is_acknowledged = models.BooleanField(default=False, db_index=True)
    acknowledged_by = models.CharField(max_length=200, blank=True, default="")
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_suspiciousactivity"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["kind", "-created_at"]),
            models.Index(fields=["is_acknowledged", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.kind} — {self.username or self.ip_address}"
