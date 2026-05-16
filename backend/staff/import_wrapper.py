"""
Wrapper functions to expose import views as callable views for URL routing.
"""

from .import_views import (
    StaffImportUploadView,
    StaffImportPreviewView,
    StaffImportResultsView,
    download_staff_template,
)

# Expose views as functions for URL routing
import_staff = StaffImportUploadView.as_view()
import_preview = StaffImportPreviewView.as_view()
import_complete = StaffImportResultsView.as_view()

# Download template is already a function
download_template = download_staff_template

__all__ = [
    'import_staff',
    'import_preview',
    'import_complete',
    'download_template',
]
