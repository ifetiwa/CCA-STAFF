# Bulk Import Feature - Complete Guide

## Overview

The CCA Staff Biodata Management System includes a comprehensive **Bulk Import** feature that allows administrators to efficiently import staff data from Excel files. This guide provides detailed information about using and understanding the bulk import functionality.

## Features

✅ **Excel-based import** - Upload `.xlsx` files with staff data  
✅ **Pre-import validation** - Comprehensive validation before import  
✅ **Preview & confirmation** - Review data before confirming import  
✅ **Detailed error reporting** - Clear error messages for validation failures  
✅ **Audit logging** - All imports are logged for compliance  
✅ **Transaction support** - All-or-nothing consistency for database integrity  
✅ **Template download** - Download pre-formatted Excel template  
✅ **Session management** - 30-minute session timeout for security  

## User Workflow

### Step 1: Download Template

1. Navigate to **Staff → Bulk Import** (available to admins only)
2. Click **"📥 Download Template"** button
3. Excel file `Staff_Import_Template.xlsx` will be downloaded

### Step 2: Prepare Data

1. Open the downloaded template in Excel
2. Fill in staff data starting from row 2 (row 1 contains headers)
3. Ensure all **required fields** are completed:
   - Staff ID (unique)
   - First Name
   - Last Name
   - Date of Birth (DD/MM/YYYY or YYYY-MM-DD)
   - Gender (M/F/O)
   - Email (unique)
   - Phone Number
   - Residential Address
   - Residential State/City
   - Department (must exist in system)
   - Designation (must exist in system)
   - Employment Type (Permanent/Contract/Temporary/Casual)
   - Employment Status (Active/On Leave/Suspended/Retired/Terminated)
   - First Appointment Date (DD/MM/YYYY or YYYY-MM-DD)

4. Optional fields include:
   - Middle Name
   - Nationality
   - State of Origin
   - Marital Status
   - Grade Level
   - Posting Location
   - Last Promotion Date
   - Bank Account Details
   - Next of Kin Information

### Step 3: Upload File

1. On the Import page, click **"Choose File"** button
2. Select your prepared Excel file (max 5MB, 500 rows)
3. Click **"📤 Upload & Preview"** button
4. System will parse and validate the file

### Step 4: Review Preview

The preview page shows:
- **Summary cards** with total, valid, and invalid records
- **Valid Records tab** - Shows all records that passed validation
- **Invalid Records tab** (if applicable) - Shows errors with detailed descriptions

#### Valid Records Display
- Row number, staff ID, name, email, department, designation, status
- Warning badges for minor issues (won't block import)

#### Invalid Records Display
- Row number, available data
- Error messages explaining why the record failed
- Common errors include:
  - Missing required fields
  - Invalid email format
  - Department/Designation not found in system
  - Staff ID or Email already exists
  - Invalid date format
  - Invalid field values

### Step 5: Confirm & Import

1. Review the preview carefully
2. Check the checkbox: "I confirm that the data is correct and ready to import"
3. Click **"✓ Confirm & Import"** button
4. System processes the import and shows results

### Step 6: Review Results

After import, you'll see:
- **Import Summary** with:
  - Number of successfully imported records
  - Number of skipped records (with errors)
  - Success rate percentage
  - Progress visualization
  
- **Next Steps** recommendations:
  - Review imported records
  - Upload passport photos
  - Verify calculated fields
  - Update additional information

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    URL Routing (urls.py)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬─────────────┐
    │            │            │             │
    v            v            v             v
import_staff import_preview import_complete download_template
    │            │            │             │
    └────────────┼────────────┼─────────────┘
                 │            │
                 v            v
        ┌─────────────────────────────────┐
        │    Import View Classes (  │
        │  StaffImportUploadView  │
        │ StaffImportPreviewView  │
        │ StaffImportResultsView  │
        └──────────┬──────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    v              v              v
Validation    Processing      Logging
(StaffImportValidator)  (BulkStaffImporter)
```

### File Structure

```
staff/
├── models.py                 # Staff model with calculated fields
├── views.py                  # Standard CRUD views + import wrappers
├── import_views.py          # Bulk import view classes
├── import_forms.py          # Upload and confirmation forms
├── import_utils.py          # Validation and import logic
├── urls.py                  # URL routing
└── templates/
    └── staff/
        ├── import_upload.html      # Upload form
        ├── import_preview.html     # Preview & confirmation
        └── import_results.html     # Results & next steps
```

### Validation Rules

#### Required Fields
All these must be provided and valid:
- **Staff ID** - Unique, alphanumeric
- **Names** - First and Last names required
- **Date of Birth** - Valid date, must be 18+ years old
- **Gender** - M, F, or O
- **Email** - Valid format, unique, lowercase
- **Phone** - At least 10 digits
- **Address** - Residential address, state, city
- **Department** - Must exist in system
- **Designation** - Must exist in system
- **Employment Type** - One of: Permanent, Contract, Temporary, Casual
- **Employment Status** - One of: Active, On Leave, Suspended, Retired, Terminated
- **First Appointment Date** - Valid date in past, after DOB + 18 years

#### Optional Fields
These are recommended but not required:
- Middle name
- Nationality (defaults to "Nigerian")
- State of Origin
- Marital Status
- Grade Level (must exist if provided)
- Posting Location (must exist if provided)
- Last Promotion Date (must be after appointment date)
- Bank details
- Next of Kin information

#### Validation Errors vs Warnings

**Errors** (prevent import):
- Missing required fields
- Invalid email/phone format
- Non-existent department/designation
- Duplicate staff ID or email
- Invalid dates
- Age < 18
- Invalid choice values

**Warnings** (allow import but flag):
- Phone format may be non-standard
- Age > 80
- Unusual field values

### Data Processing

1. **Parse** - Read Excel file, extract headers and rows
2. **Validate** - Check each row against validation rules
3. **Separate** - Split into valid and invalid rows
4. **Preview** - Display results to user for confirmation
5. **Import** - Create Staff records in database
6. **Log** - Record import action in audit trail

### Database Transaction

Import uses `@transaction.atomic` to ensure:
- All records import successfully OR none do
- No partial/corrupted data
- Atomicity and consistency

```python
@transaction.atomic
def import_valid_rows(self, valid_rows):
    # All database changes here are atomic
    # Rolled back if any error occurs
```

### Session Management

- Session timeout: **30 minutes** of inactivity
- Preview data stored in session
- Session cleared after successful import
- Session cleared if import rejected

### Audit Logging

Every bulk import creates an audit log entry:
```json
{
  "action": "BULK_IMPORT",
  "imported_count": 25,
  "failed_count": 2,
  "staff_ids": ["CCL001", "CCL002", ...],
  "error_details": [...],
  "timestamp": "2024-01-15T10:30:45Z",
  "user": "admin@cca.gov.ng",
  "status": "SUCCESS"
}
```

## Excel Template Specification

### Required Columns
1. Staff ID
2. First Name
3. Last Name
4. Date of Birth
5. Gender
6. Email
7. Phone Number
8. Residential Address
9. Residential State
10. Residential City
11. Department
12. Designation
13. Employment Type
14. Employment Status
15. First Appointment Date

### Optional Columns
- Middle Name
- Nationality
- State of Origin
- Marital Status
- Grade Level
- Posting Location
- Last Promotion Date
- Next of Kin Name
- Next of Kin Phone
- Bank Name
- Account Number

### Date Formats Supported
- YYYY-MM-DD (ISO format) - Recommended
- DD/MM/YYYY (European)
- DD-MM-YYYY
- MM/DD/YYYY (US format)

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| File size exceeds 5MB | Uploaded file too large | Split into multiple files or remove unnecessary data |
| No headers found | Missing first row with column names | Ensure first row contains proper headers |
| Too many rows (>500) | Exceeded maximum rows | Split data into multiple imports |
| Staff ID already exists | Duplicate ID | Use unique IDs, check existing staff |
| Email already exists | Duplicate email | Use unique emails, check existing staff |
| Department not found | Department doesn't exist in system | Create department first or verify spelling |
| Invalid email format | Wrong email format | Ensure email matches pattern: name@domain.com |
| Date parsing failed | Unsupported date format | Use YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY |

### Error Recovery

1. **Fix errors** in Excel file
2. **Re-upload** the corrected file
3. **Review** the new preview
4. **Confirm** import

Invalid records from previous attempts are NOT imported.

## Best Practices

### Data Preparation
✅ Validate data before uploading  
✅ Use consistent date formats  
✅ Ensure all departments/designations exist  
✅ Use unique staff IDs and emails  
✅ Fill all required fields  
✅ Use standard values for choice fields  

### Import Process
✅ Review preview carefully before confirming  
✅ Test with small batches first (10-20 records)  
✅ Keep records of imports with timestamp  
✅ Check audit log after import  
✅ Verify imported records in the staff list  

### Data Quality
✅ Use Nigerian state names consistently  
✅ Format phone numbers with country code (+234)  
✅ Use full legal names  
✅ Verify email addresses are correct  
✅ Double-check dates of birth and appointment dates  

## Security & Permissions

### Access Control
- **Required Role**: Admin or Admin Staff
- Only authenticated users with proper permissions can import
- Non-admin users see "Permission Denied" message

### Session Security
- Session cookies: HTTPOnly, Secure (HTTPS)
- SameSite: Lax
- Timeout: 30 minutes inactivity
- Auto-logout on timeout

### Audit Trail
- All imports logged with:
  - User ID and email
  - IP address
  - User agent
  - Timestamp
  - Action details
  - Error messages (first 10)

## Performance Considerations

### File Size Limits
- **Max file size**: 5 MB
- **Max rows**: 500 per import
- **Recommended**: 50-100 rows for optimal performance

### Processing Time
- **Parsing**: ~500ms for 100 rows
- **Validation**: ~2 seconds for 100 rows
- **Import**: ~3 seconds for 100 rows
- **Total**: ~5-6 seconds for 100 rows

### Memory Usage
- ~10 MB for Excel parsing and validation
- ~50 MB for 500-row import

## Troubleshooting

### Issue: Session expired during import
**Solution**: Download template, re-prepare data, re-upload

### Issue: Some records imported, others failed
**Solution**: Check audit log and error details, fix errors, re-import

### Issue: Can't find Department/Designation in system
**Solution**: Admin needs to create these records first via admin panel

### Issue: Phone number rejected as invalid
**Solution**: Ensure at least 10 digits, use format: +234-XXX-XXX-XXXX

### Issue: Date of birth calculation error
**Solution**: Ensure date is at least 18 years before first appointment

## API Reference

### View URLs

```
POST /staff/import/                  # Upload file
GET  /staff/import/preview/          # Show preview
POST /staff/import/preview/          # Confirm import
GET  /staff/import/complete/         # Show results
GET  /staff/import/download-template/ # Download template
```

### Request Parameters

**Upload (POST /staff/import/)**
```
Form Data:
- excel_file: <file> (required)
```

**Preview Confirmation (POST /staff/import/preview/)**
```
Form Data:
- confirm: true (required checkbox)
```

### Response Format

**Preview Page**
```html
{
  "form": BulkImportConfirmForm,
  "preview": {
    "valid_rows": [
      {
        "row_number": 2,
        "data": {...staff data...},
        "warnings": [...],
        "errors": []
      }
    ],
    "invalid_rows": [...],
    "summary": {
      "total_rows": 25,
      "valid_rows": 23,
      "invalid_rows": 2
    }
  }
}
```

**Results Page**
```html
{
  "results": {
    "imported_count": 23,
    "invalid_rows_count": 2,
    "total_rows": 25,
    "errors": [...]
  },
  "statistics": {
    "imported_count": 23,
    "invalid_count": 2,
    "success_rate": "92.0%"
  }
}
```

## Advanced Features

### Customization

To customize validation rules, edit `staff/import_utils.py`:

```python
class StaffImportValidator:
    REQUIRED_FIELDS = {...}  # Add/remove fields
    OPTIONAL_FIELDS = {...}  # Add/remove fields
    
    def _validate_fields(self, row_data, row_number):
        # Add custom validation logic
```

### Extension Points

1. **Custom validation** - Override `_validate_fields()` method
2. **Data transformation** - Modify `_prepare_staff_data()` method
3. **Post-import hooks** - Add code after `import_valid_rows()`
4. **Custom template** - Create alternative Excel templates

## FAQ

**Q: What happens to invalid records?**  
A: Invalid records are shown in the preview but NOT imported. Fix errors and re-upload.

**Q: Can I modify the import template?**  
A: Yes, but keep the header row names unchanged. Additional columns are ignored.

**Q: What if import is interrupted?**  
A: Partial import won't occur (atomic transaction). Re-upload and try again.

**Q: Can imported records be edited?**  
A: Yes, like any other staff record through the normal edit interface.

**Q: Is there a limit on imports per day?**  
A: No, but large imports may impact performance. Use reasonable batches.

**Q: Can I import photos during bulk import?**  
A: No, upload photos after import through the photo upload feature.

**Q: Where are import logs stored?**  
A: In the AuditLog table, queryable through Django admin.

## Support & Contact

For issues or feature requests:
1. Check this guide and FAQ
2. Review audit logs for error details
3. Contact system administrator
4. Submit bug report with import file (anonymized)

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Author**: CCA IT Department
