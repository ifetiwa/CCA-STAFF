"""
Views for bulk staff import.
"""

import tempfile
import os
from django.shortcuts import render, redirect
from django.views.generic import View, TemplateView
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import HttpResponse, HttpResponseForbidden
from django.contrib import messages
from django.db import transaction
from staff.import_utils import ExcelTemplateGenerator, BulkStaffImporter
from staff.import_forms import StaffBulkImportForm, BulkImportConfirmForm
from users.permissions import RoleRequiredMixin
import logging

logger = logging.getLogger(__name__)


@login_required(login_url='login')
def download_staff_template(request):
    """Download Excel template for staff import."""
    
    # Check if user has permission to import staff
    if not request.user.is_superuser and request.user.role.role_name != 'admin_staff':
        messages.error(request, 'You do not have permission to download the import template.')
        return redirect('dashboard')
    
    try:
        # Generate template
        template_wb = ExcelTemplateGenerator.generate_template()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            template_wb.save(tmp.name)
            tmp_path = tmp.name
        
        # Read and return file
        with open(tmp_path, 'rb') as f:
            response = HttpResponse(
                f.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="Staff_Import_Template.xlsx"'
        
        # Clean up temporary file
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        return response
    
    except Exception as e:
        logger.error(f"Error generating template: {str(e)}")
        messages.error(request, f'Error generating template: {str(e)}')
        return redirect('staff_import')


@method_decorator(login_required(login_url='login'), name='dispatch')
class StaffImportUploadView(View):
    """Handle staff import file upload."""
    
    template_name = 'staff/import_upload.html'
    
    def get_permission(self):
        """Check if user has permission to import staff."""
        return self.request.user.is_superuser or \
               (self.request.user.role and self.request.user.role.role_name == 'admin_staff')
    
    def get(self, request):
        """Display import form."""
        if not self.get_permission():
            return HttpResponseForbidden('You do not have permission to access this page.')
        
        form = StaffBulkImportForm()
        return render(request, self.template_name, {
            'form': form,
            'title': 'Bulk Import Staff',
        })
    
    def post(self, request):
        """Handle file upload."""
        if not self.get_permission():
            return HttpResponseForbidden('You do not have permission to access this page.')
        
        form = StaffBulkImportForm(request.POST, request.FILES)
        
        if form.is_valid():
            excel_file = request.FILES['excel_file']
            
            try:
                # Save temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                    for chunk in excel_file.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                
                # Parse Excel file
                importer = BulkStaffImporter(request.user, request=request)
                parsed_rows, parse_errors = importer.parse_excel_file(tmp_path)
                
                # Clean up temporary file
                try:
                    os.unlink(tmp_path)
                except:
                    pass
                
                if parse_errors:
                    for error in parse_errors:
                        messages.error(request, error)
                    return render(request, self.template_name, {
                        'form': form,
                        'title': 'Bulk Import Staff',
                    })
                
                # Validate and preview
                valid_rows, invalid_rows, summary = importer.validate_and_preview(parsed_rows)
                
                # Store preview data in session
                request.session['import_preview'] = {
                    'valid_rows': [
                        {
                            'row_number': r['row_number'],
                            'data': {k: str(v) if v else '' for k, v in r['data'].items()},
                            'errors': r['errors'],
                            'warnings': r['warnings'],
                        }
                        for r in valid_rows
                    ],
                    'invalid_rows': [
                        {
                            'row_number': r['row_number'],
                            'data': {k: str(v) if v else '' for k, v in r['data'].items()},
                            'errors': r['errors'],
                            'warnings': r['warnings'],
                        }
                        for r in invalid_rows
                    ],
                    'summary': summary,
                }
                
                # Redirect to preview page
                return redirect('staff_import_preview')
            
            except Exception as e:
                logger.error(f"Error processing upload: {str(e)}")
                messages.error(request, f'Error processing file: {str(e)}')
                return render(request, self.template_name, {
                    'form': form,
                    'title': 'Bulk Import Staff',
                })
        
        return render(request, self.template_name, {
            'form': form,
            'title': 'Bulk Import Staff',
        })


@method_decorator(login_required(login_url='login'), name='dispatch')
class StaffImportPreviewView(View):
    """Display preview of parsed and validated staff data."""
    
    template_name = 'staff/import_preview.html'
    
    def get_permission(self):
        """Check if user has permission to import staff."""
        return self.request.user.is_superuser or \
               (self.request.user.role and self.request.user.role.role_name == 'admin_staff')
    
    def get(self, request):
        """Display preview."""
        if not self.get_permission():
            return HttpResponseForbidden('You do not have permission to access this page.')
        
        # Get preview data from session
        preview = request.session.get('import_preview')
        if not preview:
            messages.warning(request, 'No preview data found. Please upload a file first.')
            return redirect('staff_import')
        
        form = BulkImportConfirmForm()
        
        return render(request, self.template_name, {
            'form': form,
            'preview': preview,
            'title': 'Import Preview',
        })
    
    def post(self, request):
        """Handle import confirmation."""
        if not self.get_permission():
            return HttpResponseForbidden('You do not have permission to access this page.')
        
        # Get preview data from session
        preview = request.session.get('import_preview')
        if not preview:
            messages.warning(request, 'No preview data found. Please upload a file first.')
            return redirect('staff_import')
        
        form = BulkImportConfirmForm(request.POST)
        
        if form.is_valid() and form.cleaned_data['confirm']:
            try:
                # Reconstruct valid rows for import
                importer = BulkStaffImporter(request.user, request=request)
                valid_rows = preview['valid_rows']
                
                # Import valid rows
                imported_count, import_errors, audit_log_id = importer.import_valid_rows(valid_rows)
                
                # Clear session
                del request.session['import_preview']
                
                # Redirect to results page
                request.session['import_results'] = {
                    'imported_count': imported_count,
                    'invalid_rows_count': len(preview['invalid_rows']),
                    'total_rows': preview['summary']['total_rows'],
                    'errors': import_errors,
                }
                
                return redirect('staff_import_results')
            
            except Exception as e:
                logger.error(f"Error during import: {str(e)}")
                messages.error(request, f'Error during import: {str(e)}')
        
        elif not form.cleaned_data.get('confirm', False):
            messages.warning(request, 'You must confirm the import to proceed.')
        
        return render(request, self.template_name, {
            'form': form,
            'preview': preview,
            'title': 'Import Preview',
        })


@method_decorator(login_required(login_url='login'), name='dispatch')
class StaffImportResultsView(View):
    """Display import results and summary."""
    
    template_name = 'staff/import_results.html'
    
    def get_permission(self):
        """Check if user has permission to view results."""
        return self.request.user.is_superuser or \
               (self.request.user.role and self.request.user.role.role_name == 'admin_staff')
    
    def get(self, request):
        """Display import results."""
        if not self.get_permission():
            return HttpResponseForbidden('You do not have permission to access this page.')
        
        # Get results from session
        results = request.session.get('import_results')
        if not results:
            messages.warning(request, 'No import results found.')
            return redirect('staff_import')
        
        # Clear session
        if 'import_results' in request.session:
            del request.session['import_results']
        
        # Calculate statistics
        imported_count = results['imported_count']
        invalid_count = results['invalid_rows_count']
        total_rows = results['total_rows']
        skipped_count = total_rows - imported_count - invalid_count
        
        success_rate = (imported_count / total_rows * 100) if total_rows > 0 else 0
        
        return render(request, self.template_name, {
            'title': 'Import Results',
            'results': results,
            'statistics': {
                'imported_count': imported_count,
                'invalid_count': invalid_count,
                'skipped_count': skipped_count,
                'total_rows': total_rows,
                'success_rate': f"{success_rate:.1f}%",
            },
        })
