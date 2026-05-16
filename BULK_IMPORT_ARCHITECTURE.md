# Bulk Import Architecture & Data Flow

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                         │
│                   (Templates & HTML/CSS)                        │
├────────────────────────────────────────────────────────────────┤
│  import_upload.html    import_preview.html    import_results.html│
│      ↓                      ↓                       ↓            │
│   Upload Form          Preview & Confirm      Results Display   │
└─────────────┬──────────────────────┬──────────────────┬────────┘
              │                      │                  │
              v                      v                  v
┌────────────────────────────────────────────────────────────────┐
│                    VIEW LAYER (Django CBV)                      │
├────────────────────────────────────────────────────────────────┤
│  StaffImportUploadView  StaffImportPreviewView  StaffImportResultsView│
│      ├─ get()              ├─ get()               └─ get()      │
│      └─ post()             └─ post()              (read-only)   │
└─────────────┬──────────────────────┬───────────────────────────┘
              │                      │
              v                      v
┌────────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                          │
├────────────────────────────────────────────────────────────────┤
│                    BulkStaffImporter                            │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ parse_excel_file()                                        │ │
│   │  └─ ExcelFile.load_workbook()                             │ │
│   │  └─ Extract headers & rows                                │ │
│   │  └─ Type conversions (dates, numbers)                     │ │
│   └──────────────────────────────────────────────────────────┘ │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ validate_and_preview()                                    │ │
│   │  └─ For each row:                                         │ │
│   │     ├─ StaffImportValidator.validate_row()                │ │
│   │     ├─ Separate: valid_rows[] / invalid_rows[]            │ │
│   │     └─ Compile summary statistics                         │ │
│   └──────────────────────────────────────────────────────────┘ │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ import_valid_rows()                                       │ │
│   │  └─ @transaction.atomic                                   │ │
│   │  └─ For each valid row:                                   │ │
│   │     ├─ _prepare_staff_data()  # Resolve FKs               │ │
│   │     ├─ Staff.objects.create()  # Insert DB                │ │
│   │     └─ Log success/failure                                │ │
│   │  └─ _log_bulk_import()  # Audit trail                     │ │
│   └──────────────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────┬───────────────────────────┘
              │                      │
              v                      v
┌────────────────────────────────────────────────────────────────┐
│                 VALIDATION & UTILITY LAYER                      │
├────────────────────────────────────────────────────────────────┤
│  StaffImportValidator        ExcelTemplateGenerator             │
│  ├─ validate_row()           ├─ generate_template()            │
│  ├─ _validate_fields()       └─ Create XLSX with:              │
│  ├─ _is_valid_email()            ├─ Headers                    │
│  ├─ _is_valid_phone()            ├─ Sample data               │
│  ├─ _parse_date()                ├─ Instructions              │
│  ├─ _staff_id_exists()           └─ Formatting               │
│  └─ _email_exists()                                           │
└─────────────────────────────────────────────────────────────────┘
              │
              v
┌────────────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER (ORM)                       │
├────────────────────────────────────────────────────────────────┤
│  Django ORM Models:                                             │
│  ├─ Staff                 # Main model, with calculations      │
│  ├─ Department            # FK constraint                      │
│  ├─ Designation           # FK constraint                      │
│  ├─ GradeLevel            # Optional FK                        │
│  ├─ PostingLocation        # Optional FK                        │
│  └─ AuditLog              # Import logging                     │
└─────────────────────────────────────────────────────────────────┘
              │
              v
┌────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
├────────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                     │
│  ├─ staff_staff                 # 200+ columns               │
│  ├─ departments_department      # ~50 records              │
│  ├─ departments_designation     # ~150 records             │
│  ├─ departments_gradelevel      # ~20 records              │
│  ├─ departments_postinglocation # ~10 records              │
│  └─ audit_auditlog             # Import audit trail        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence Diagram

```
User          Browser      Django         Excel Parser   Database
│              │             │               │             │
│─ Click ────→ │             │               │             │
│ Download     │             │               │             │
│ Template     │             │               │             │
│              │ GET /import/│               │             │
│              │download-temp │               │             │
│              │──────────→  │               │             │
│              │             │ create XLSX  │             │
│              │             │──────────→  │             │
│              │             │ ExcelTemplateGenerator    │
│              │             │←──────────  │             │
│              │             │ return file │             │
│              │←────────────│               │             │
│ Save .xlsx   │             │               │             │
│←─────────────│             │               │             │
│              │             │               │             │
│ Prepare      │             │               │             │
│ Excel data   │             │               │             │
│ (30 mins)    │             │               │             │
│              │             │               │             │
│ Upload       │             │               │             │
│ Excel file   │             │               │             │
│─────────────→│             │               │             │
│              │ POST /      │               │             │
│              │ import/     │               │             │
│              │────────────→│               │             │
│              │             │ parse_excel_file()        │
│              │             │──────────→  │             │
│              │             │ load_workbook()          │
│              │             │ read headers & rows      │
│              │             │←──────────  │ .xlsx     │
│              │             │ parsed_rows []          │
│              │             │ validate_and_preview()   │
│              │             │ For each row:            │
│              │             │ ├─ validate_row()       │
│              │             │ ├─ separate valid/invalid│
│              │             │ └─ compile summary      │
│              │             │ (valid_rows[],          │
│              │             │  invalid_rows[],        │
│              │             │  summary{})             │
│              │             │ store in session        │
│              │             │ return preview.html     │
│              │←────────────│               │         │
│ Review       │             │               │         │
│ Preview      │             │               │         │
│ Show:        │             │               │         │
│ - Valid: 23  │             │               │         │
│ - Invalid: 2 │             │               │         │
│ - Errors: [...] │             │               │         │
│              │             │               │         │
│ Confirm?     │             │               │         │
│ Check: ☑     │             │               │         │
│─────────────→│             │               │         │
│              │ POST /      │               │         │
│              │ preview/    │               │         │
│              │────────────→│               │         │
│              │             │ import_valid_rows()    │
│              │             │ @transaction.atomic:   │
│              │             │ ├─ For each valid row: │
│              │             │ │  ├─ prepare_staff_data() │
│              │             │ │  ├─ Staff.create() │
│              │             │ ├─ log_bulk_import()   │
│              │             │────────────────────→  │
│              │             │ INSERT Staff records   │
│              │             │ INSERT AuditLog       │
│              │             │←────────────────────  │
│              │             │ Results: {            │
│              │             │   imported: 23        │
│              │             │   invalid: 2          │
│              │             │ }                     │
│              │ Redirect to │               │         │
│              │ /complete/ │               │         │
│              │←────────────│               │         │
│              │ GET /      │               │         │
│              │ complete/  │               │         │
│              │────────────→│               │         │
│              │             │ Calculate stats        │
│              │             │ return results.html    │
│              │←────────────│               │         │
│ ✅ Done!     │             │               │         │
│ 23 imported  │             │               │         │
│ View Staff   │             │               │         │
│─────────────→│             │               │         │
│              │ GET /staff/ │               │         │
│              │────────────→│               │         │
│              │             │ Query Staff │         │
│              │             │──────────→  │         │
│              │             │ (23 new records)        │
│              │             │←──────────  │         │
│              │ Display     │               │         │
│              │←────────────│               │         │
│ ✓ Verify     │             │               │         │
│              │             │               │         │
```

## Request/Response Flow

### 1. Download Template

```
GET /staff/import/download-template/

Response: Excel file (Staff_Import_Template.xlsx)
Headers:
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="Staff_Import_Template.xlsx"
Body: Binary Excel file
```

### 2. Upload & Parse

```
POST /staff/import/
Content-Type: multipart/form-data

Request body:
  excel_file: <binary file>

Internal processing:
  1. Write temp file: /tmp/upload_xxxxx.xlsx
  2. Load workbook
  3. Extract headers
  4. Parse rows (up to 500)
  5. Type conversions
  6. Validate each row
  7. Store in session: request.session['import_preview']

Response: 302 Redirect to /staff/import/preview/
```

### 3. Show Preview

```
GET /staff/import/preview/

Internal processing:
  1. Retrieve from session: request.session['import_preview']
  2. Build context:
     {
       'form': BulkImportConfirmForm(),
       'preview': {
         'valid_rows': [...],
         'invalid_rows': [...],
         'summary': {...}
       }
     }

Response: 200 OK
Template: import_preview.html
Shows:
  - Summary cards (total, valid, invalid)
  - Tabs (Valid | Invalid)
  - Data tables with row numbers
  - Confirmation checkbox
  - Buttons (Confirm & Import | Back)
```

### 4. Confirm & Import

```
POST /staff/import/preview/
Content-Type: application/x-www-form-urlencoded

Request body:
  confirm: on  (checkbox value)

Internal processing:
  1. Validate form (confirm must be true)
  2. Get valid_rows from session
  3. @transaction.atomic:
     - For each valid_row:
       - _prepare_staff_data() → resolve FKs
       - Staff.objects.create() → INSERT
       - Log success/failure
     - AuditLog.objects.create() → log action
  4. Clear session['import_preview']
  5. Store results in session['import_results']

Response: 302 Redirect to /staff/import/complete/
Status: Success or Rollback (atomic)
```

### 5. Show Results

```
GET /staff/import/complete/

Internal processing:
  1. Retrieve from session: request.session['import_results']
  2. Calculate statistics:
     - imported_count
     - invalid_count
     - total_rows
     - success_rate = imported/total * 100
  3. Build context:
     {
       'results': {...},
       'statistics': {...}
     }
  4. Clear session['import_results']

Response: 200 OK
Template: import_results.html
Shows:
  - Success icon/message
  - Statistics cards
  - Progress bar
  - Import summary
  - Error details (if any)
  - Next steps
  - Action buttons
```

## Session Data Storage

### Session Structure

```python
# After upload & parse (import_preview)
request.session['import_preview'] = {
    'valid_rows': [
        {
            'row_number': 2,
            'data': {
                'staff_id': 'CCL001',
                'first_name': 'John',
                'last_name': 'Okafor',
                'email': 'john@cca.gov.ng',
                'department': 'Legal',
                'designation': 'Senior Registrar',
                # ... 30+ fields
            },
            'errors': [],
            'warnings': [],
        },
        # ... more valid rows
    ],
    'invalid_rows': [
        {
            'row_number': 5,
            'data': {...},
            'errors': [
                'Email is required',
                'Email "invalid-email" is invalid'
            ],
            'warnings': [],
        },
    ],
    'summary': {
        'total_rows': 25,
        'valid_rows': 23,
        'invalid_rows': 2,
    }
}

# After confirmation (import_results)
request.session['import_results'] = {
    'imported_count': 23,
    'invalid_rows_count': 2,
    'total_rows': 25,
    'errors': [
        'Row 5: Failed to create staff - duplicate email',
        # ... up to 10 errors logged
    ]
}
```

## Transaction Flow

### Atomic Transaction During Import

```python
@transaction.atomic  # Start transaction
def import_valid_rows(self, valid_rows):
    imported_count = 0
    import_errors = []
    
    try:
        for row_info in valid_rows:
            # Point A: Open transaction
            staff_data = self._prepare_staff_data(row_info['data'])
            staff = Staff.objects.create(**staff_data)  # INSERT
            imported_count += 1
            
            # If any error occurs here ↓
            # ...error handling...
        
        # Log the import
        audit_log = AuditLog.objects.create(...)  # INSERT
        
        # Point B: Commit (all inserts applied)
        return imported_count, import_errors, audit_log.id
    
    except Exception as e:
        # Point C: Rollback (all inserts undone)
        import_errors.append(str(e))
        # Transaction is automatically rolled back
        return 0, import_errors, None
```

## Validation Rules Priority

```
1. Required Field Check
   ↓
2. Basic Format Validation
   ├─ Email format
   ├─ Phone format  
   ├─ Date parsing
   └─ Choice fields
   ↓
3. Foreign Key Existence
   ├─ Department exists
   ├─ Designation exists
   ├─ Grade Level exists
   └─ Posting Location exists
   ↓
4. Uniqueness Checks
   ├─ Staff ID not duplicate
   └─ Email not duplicate
   ↓
5. Cross-Field Validation
   ├─ Age >= 18
   ├─ Appointment > DOB + 18
   └─ Promotion > Appointment
   ↓
6. Warning Detection
   ├─ Age > 80
   ├─ Non-standard formats
   └─ Optional field issues
```

## Error Handling Strategy

```
Input
  ↓
Excel Parser
  ├─ File not found? → return parse error
  ├─ Invalid format? → return parse error
  ├─ No headers? → return parse error
  └─ >500 rows? → return validation error
  ↓
Validator
  ├─ Required field missing? → add to errors
  ├─ Invalid format? → add to errors
  ├─ FK not exists? → add to errors
  ├─ Duplicate ID/Email? → add to errors
  ├─ Cross-field fail? → add to errors
  ├─ Minor issue? → add to warnings
  └─ is_valid = len(errors) == 0
  ↓
Row Classification
  ├─ Errors exist? → invalid_rows[]
  └─ No errors? → valid_rows[]
  ↓
Preview Display
  ├─ Show valid_rows in green
  └─ Show invalid_rows with red error messages
  ↓
User Confirmation
  ├─ User rejects? → return to upload
  └─ User confirms? → proceed to import
  ↓
Import Process
  ├─ For each valid_row:
  │  ├─ Prepare data
  │  ├─ Create Staff record
  │  └─ Count success
  ├─ Log audit trail
  └─ Return statistics
  ↓
Results Display
  ├─ Show import count
  ├─ Show errors (if any)
  └─ Suggest next steps
```

## Memory Usage Profile

```
Typical 100-row import:

Parsing Phase:
  - Excel in memory: ~2 MB
  - parsed_rows list: ~500 KB
  - Total: ~2.5 MB

Validation Phase:
  - Validator instance: ~100 KB
  - valid_rows list: ~300 KB
  - invalid_rows list: ~100 KB
  - session storage: ~500 KB
  - Total: ~1 MB

Import Phase:
  - Staff ORM objects: ~500 KB (in transaction)
  - AuditLog entry: ~50 KB
  - Total: ~550 KB

Peak Memory: ~4 MB (well within limits)
```

## Database Connections & Queries

```
Per import action:

Upload:
  0 DB queries (file only)

Parse:
  0 DB queries (Excel parsing only)

Validate:
  - Check Staff.objects.filter(staff_id=...) → 25 queries
  - Check Staff.objects.filter(email=...) → 25 queries
  - Check Department.objects.filter(name=...) → 25 queries
  - Check Designation.objects.filter(title=...) → 25 queries
  - Total: ~100 queries (parallelizable with select_related)

Import (transaction):
  - INSERT Staff (1 per valid row) → 25 inserts
  - INSERT AuditLog (1) → 1 insert
  - Total: ~26 queries

Optimization opportunity:
  - Cache Department/Designation lookups
  - Use select_for_update() for concurrent imports
  - Batch inserts with bulk_create()
```

## Security Boundaries

```
1. Authentication
   @login_required decorator
   ↓
2. Authorization
   Role-based check (admin_staff)
   ↓
3. Input Validation
   File extension check
   File size limit (5MB)
   Row count limit (500)
   ↓
4. Data Validation
   All field type validation
   Email/phone format
   FK existence checks
   ↓
5. Transaction Safety
   Atomic transaction
   Rollback on any error
   ↓
6. Session Security
   Session timeout (30 min)
   HTTPOnly cookies
   CSRF token validation
   ↓
7. Logging & Audit
   Every action logged
   User & IP recorded
   Timestamps captured
```

## Testing Scenarios

### Happy Path
```
1. ✓ Download template
2. ✓ Fill valid data
3. ✓ Upload file
4. ✓ Review preview (all valid)
5. ✓ Confirm import
6. ✓ See success (25/25 imported)
7. ✓ Verify in staff list
```

### Error Path
```
1. ✓ Download template
2. ✓ Fill data with 2 errors
3. ✓ Upload file
4. ✓ Review preview (23 valid, 2 invalid)
5. ✓ See error details
6. ✓ Fix errors in Excel
7. ✓ Re-upload
8. ✓ Confirm import
9. ✓ See success (25/25 imported)
```

### Edge Cases
```
1. ✓ Empty file → error
2. ✓ 1000 rows → error (max 500)
3. ✓ Missing headers → error
4. ✓ Wrong file format (.csv) → error
5. ✓ Session timeout → redirect to upload
6. ✓ Duplicate staff IDs → show errors
7. ✓ Non-existent department → show error
8. ✓ Invalid date format → show error
```

---

This architecture ensures:
- **Scalability**: Can handle 500-row batches efficiently
- **Reliability**: Atomic transactions prevent partial imports
- **Maintainability**: Clear separation of concerns
- **Security**: Multi-layer validation and audit logging
- **User Experience**: Interactive preview before commit
