"""
Forms for bulk staff import.
"""

from django import forms
from django.core.exceptions import ValidationError

from accounts.upload_validators import validate_excel


class StaffBulkImportForm(forms.Form):
    """Form for uploading Excel file for bulk staff import."""

    excel_file = forms.FileField(
        label='Upload Excel File',
        help_text='Upload an .xlsx file with staff data (maximum 500 rows)',
        widget=forms.FileInput(attrs={
            'accept': '.xlsx',
            'class': 'form-control',
        })
    )

    def clean_excel_file(self):
        """Validate uploaded file: .xlsx only, with verified magic bytes."""
        return validate_excel(self.cleaned_data['excel_file'])


class BulkImportConfirmForm(forms.Form):
    """Form for confirming bulk import after preview."""
    
    confirm = forms.BooleanField(
        label='I confirm that the data is correct and ready to import',
        required=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
        })
    )
