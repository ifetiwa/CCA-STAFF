"""
Forms for user management (admin panel).
"""

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
import string
import secrets

User = get_user_model()


class CreateUserForm(forms.ModelForm):
    """Form for creating a new user."""
    
    email = forms.EmailField(
        label='Email Address',
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'user@example.com',
        })
    )
    
    first_name = forms.CharField(
        label='First Name',
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'John',
        })
    )
    
    last_name = forms.CharField(
        label='Last Name',
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Doe',
        })
    )
    
    role = forms.ModelChoiceField(
        queryset=None,  # Will be set in __init__
        required=True,
        widget=forms.Select(attrs={
            'class': 'form-control',
        })
    )
    
    phone_number = forms.CharField(
        label='Phone Number',
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '+234-XXX-XXX-XXXX',
        })
    )
    
    department = forms.CharField(
        label='Department',
        max_length=100,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g., Legal, Admin',
        })
    )

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'role', 'phone_number', 'department']
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'username',
                'maxlength': 150,
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only show active roles
        from users.models import Role
        self.fields['role'].queryset = Role.objects.filter(is_active=True)
        self.fields['role'].label_from_instance = lambda obj: obj.display_name

    def clean_username(self):
        """Validate username is unique."""
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists():
            raise ValidationError('Username already exists.')
        return username

    def clean_email(self):
        """Validate email is unique."""
        email = self.cleaned_data['email'].lower()
        if User.objects.filter(email=email).exists():
            raise ValidationError('Email already in use.')
        return email

    def save(self, commit=True):
        """Save the user with auto-generated password."""
        user = super().save(commit=False)
        
        # Generate temporary password
        temp_password = self.generate_temporary_password()
        user.set_password(temp_password)
        user.force_password_change = True
        user.email = user.email.lower()
        
        if commit:
            user.save()
            # Store temp password in a way that can be retrieved once
            user.temp_password = temp_password
        
        return user

    @staticmethod
    def generate_temporary_password(length=12):
        """Generate a secure temporary password."""
        alphabet = string.ascii_letters + string.digits + string.punctuation.replace('"', '').replace("'", '')
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password


class EditUserForm(forms.ModelForm):
    """Form for editing user details."""
    
    email = forms.EmailField(
        label='Email Address',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
        })
    )
    
    first_name = forms.CharField(
        label='First Name',
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
        })
    )
    
    last_name = forms.CharField(
        label='Last Name',
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
        })
    )
    
    role = forms.ModelChoiceField(
        queryset=None,  # Will be set in __init__
        widget=forms.Select(attrs={
            'class': 'form-control',
        })
    )
    
    phone_number = forms.CharField(
        label='Phone Number',
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
        })
    )
    
    department = forms.CharField(
        label='Department',
        max_length=100,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
        })
    )
    
    is_active = forms.BooleanField(
        label='Account Active',
        required=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
        })
    )

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'role', 'phone_number', 'department', 'is_active']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from users.models import Role
        self.fields['role'].queryset = Role.objects.filter(is_active=True)
        self.fields['role'].label_from_instance = lambda obj: obj.display_name

    def clean_email(self):
        """Validate email is unique (excluding current user)."""
        email = self.cleaned_data['email'].lower()
        if User.objects.filter(email=email).exclude(pk=self.instance.pk).exists():
            raise ValidationError('Email already in use.')
        return email

    def save(self, commit=True):
        """Save the updated user."""
        user = super().save(commit=False)
        user.email = user.email.lower()
        
        if commit:
            user.save()
        
        return user


class ResetPasswordForm(forms.Form):
    """Form for resetting user password."""
    
    send_to_email = forms.BooleanField(
        label='Send new password to user email',
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
        })
    )
    
    custom_password = forms.CharField(
        label='Custom Password (optional)',
        required=False,
        max_length=128,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Leave empty to auto-generate',
        })
    )
    
    force_change_on_login = forms.BooleanField(
        label='Force password change on next login',
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
        })
    )

    def clean_custom_password(self):
        """Validate custom password if provided."""
        password = self.cleaned_data.get('custom_password', '').strip()
        if password:
            try:
                validate_password(password)
            except ValidationError as e:
                raise ValidationError(f'Invalid password: {", ".join(e.messages)}')
        return password


class BulkUserActionForm(forms.Form):
    """Form for bulk actions on users."""
    
    ACTION_CHOICES = [
        ('activate', 'Activate'),
        ('deactivate', 'Deactivate'),
        ('reset_password', 'Reset Password'),
    ]
    
    action = forms.ChoiceField(
        choices=ACTION_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
        })
    )
    
    user_ids = forms.CharField(
        widget=forms.HiddenInput()
    )
    
    def clean_user_ids(self):
        """Validate user IDs."""
        user_ids = self.cleaned_data['user_ids'].split(',')
        if not user_ids:
            raise ValidationError('No users selected.')
        return [int(uid) for uid in user_ids if uid.strip().isdigit()]
