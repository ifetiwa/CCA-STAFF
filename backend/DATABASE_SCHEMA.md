# Staff Biodata Management System - Database Schema

## Overview
This document outlines the complete PostgreSQL database schema for the Staff Biodata Management System of the Customary Court of Appeal, FCT.

## Architecture
- **Database**: PostgreSQL
- **ORM**: Django ORM
- **Framework**: Django 4.2 + Django REST Framework
- **Language**: Python 3.9+

## Tables and Models

### 1. **departments_department**
Stores department information for the organization.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `name` (VARCHAR 100, UNIQUE): Department name
- `description` (TEXT): Department description
- `department_code` (VARCHAR 10, UNIQUE): Short code
- `head_of_department` (VARCHAR 200): Department head name
- `contact_email` (EMAIL): Department email
- `phone_number` (VARCHAR 20): Contact phone
- `office_location` (VARCHAR 200): Physical location
- `is_active` (BOOLEAN): Active status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Indexes:**
- name
- department_code
- is_active

---

### 2. **departments_postinglocation**
Represents physical posting locations.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `name` (VARCHAR 200, UNIQUE): Location name
- `address` (TEXT): Full address
- `state` (VARCHAR 50): State
- `city` (VARCHAR 100): City
- `location_code` (VARCHAR 10, UNIQUE): Short code
- `contact_person` (VARCHAR 200): Contact person
- `phone_number` (VARCHAR 20): Phone
- `email` (EMAIL): Email
- `description` (TEXT): Location details
- `is_active` (BOOLEAN): Active status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Indexes:**
- name
- state
- location_code

---

### 3. **departments_designation**
Job designations/ranks in the organization.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `title` (VARCHAR 150, UNIQUE): Job title
- `description` (TEXT): Designation description
- `rank_order` (INTEGER): Hierarchical rank for sorting
- `designation_type` (VARCHAR 50): Category (executive, managerial, professional, administrative, support)
- `min_experience_required` (INTEGER): Minimum years of experience
- `educational_requirement` (TEXT): Required qualifications
- `is_active` (BOOLEAN): Active status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Indexes:**
- title
- rank_order

---

### 4. **departments_gradelevel**
Salary grade levels.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `grade_level` (VARCHAR 10, UNIQUE): Grade code (e.g., GL10, GL12)
- `description` (TEXT): Grade description
- `step_1_amount` (DECIMAL 12,2): Starting salary
- `number_of_steps` (INTEGER, DEFAULT 15): Number of steps
- `increment_amount` (DECIMAL 12,2): Annual increment per step
- `is_active` (BOOLEAN): Active status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Methods:**
- `get_salary_for_step(step)`: Calculate salary for given step

**Indexes:**
- grade_level

---

### 5. **staff_staff** (MAIN BIODATA TABLE)
Core staff member information - the most comprehensive table.

**Personal Information:**
- `id` (PK): Auto-incrementing primary key
- `staff_id` (VARCHAR 20, UNIQUE): Unique staff ID
- `first_name` (VARCHAR 100): First name
- `middle_name` (VARCHAR 100, NULL): Middle name(s)
- `last_name` (VARCHAR 100): Last name/surname
- `date_of_birth` (DATE): Date of birth
- `gender` (VARCHAR 1): M/F/O
- `nationality` (VARCHAR 100, DEFAULT 'Nigerian'): Nationality
- `state_of_origin` (VARCHAR 100): State of origin
- `local_government_area` (VARCHAR 150, NULL): LGA

**Contact Information:**
- `email` (EMAIL, UNIQUE): Official email
- `phone_number` (VARCHAR 20): Primary phone
- `alternate_phone` (VARCHAR 20, NULL): Secondary phone
- `residential_address` (TEXT): Home address
- `residential_state` (VARCHAR 100): State of residence
- `residential_city` (VARCHAR 100): City of residence

**Identification:**
- `passport_photo` (IMAGE): Passport-size photo
- `passport_number` (VARCHAR 50, NULL): International passport
- `national_identification` (VARCHAR 50, NULL): National ID
- `nin` (VARCHAR 20, NULL): National Identification Number

**Personal Details:**
- `marital_status` (VARCHAR 50): Single/Married/Divorced/Widowed
- `number_of_dependents` (INTEGER): Number of dependents

**Employment Information:**
- `department_id` (FK → departments_department): Current department
- `designation_id` (FK → departments_designation): Current designation
- `posting_location_id` (FK → departments_postinglocation, NULL): Posting location
- `grade_level_id` (FK → departments_gradelevel, NULL): Salary grade
- `grade_step` (INTEGER, DEFAULT 1): Current step in grade
- `employment_type` (VARCHAR 50): Permanent/Contract/Temporary/Casual
- `employment_status` (VARCHAR 50): Active/On Leave/Suspended/Retired/Terminated

**Service Dates:**
- `first_appointment_date` (DATE): Initial appointment date
- `last_promotion_date` (DATE, NULL): Last promotion date
- `next_promotion_date` (DATE, NULL): **AUTO-CALCULATED** (3 years from last promotion)
- `contract_start_date` (DATE, NULL): Contract start
- `contract_end_date` (DATE, NULL): Contract end

**Calculated Fields (Auto-calculated on save):**
- `years_of_service` (INTEGER): Auto-calculated from first_appointment_date
- `retirement_date` (DATE, NULL): **AUTO-CALCULATED** (age 60 OR 35 years service, whichever comes first)

**Education & Qualifications:**
- `highest_qualification` (VARCHAR 200, NULL): Highest education level
- `professional_certifications` (TEXT, NULL): Professional certificates/licenses

**Emergency Contact:**
- `next_of_kin_name` (VARCHAR 200, NULL): NOK name
- `next_of_kin_relationship` (VARCHAR 50, NULL): Relationship
- `next_of_kin_phone` (VARCHAR 20, NULL): NOK phone
- `next_of_kin_address` (TEXT, NULL): NOK address
- `emergency_contact_name` (VARCHAR 200, NULL): Emergency contact
- `emergency_contact_phone` (VARCHAR 20, NULL): Emergency contact phone

**Bank Details:**
- `bank_name` (VARCHAR 100, NULL): Bank name
- `account_number` (VARCHAR 50, NULL): Account number
- `account_holder_name` (VARCHAR 200, NULL): Account holder name

**System Fields:**
- `is_active` (BOOLEAN): Active status
- `remarks` (TEXT, NULL): Additional notes
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `created_by` (VARCHAR 200, NULL): User who created
- `updated_by` (VARCHAR 200, NULL): User who last updated

**Indexes:**
- staff_id
- email
- department
- designation
- is_active
- (first_name, last_name)

**Custom Permissions:**
- can_view_all_staff
- can_export_staff_records
- can_approve_promotions
- can_manage_staff_documents

**Properties/Methods:**
- `get_full_name()`: Returns full name
- `calculate_years_of_service()`: Calculates service duration
- `calculate_retirement_date()`: Auto-calculates retirement date
- `calculate_next_promotion_date()`: Auto-calculates next promotion
- `save()`: Overridden to auto-calculate fields
- `age` (property): Current age
- `is_due_for_promotion` (property): Boolean check
- `is_due_for_retirement` (property): Boolean check
- `time_to_retirement` (property): Days remaining

---

### 6. **staff_staffpromotion**
History of staff promotions.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `staff_id` (FK → staff_staff): Staff member
- `promotion_date` (DATE): Promotion effective date
- `previous_designation` (VARCHAR 150): Previous designation
- `new_designation_id` (FK → departments_designation, NULL): New designation
- `previous_grade` (VARCHAR 10, NULL): Previous grade
- `new_grade_id` (FK → departments_gradelevel, NULL): New grade
- `new_grade_step` (INTEGER, DEFAULT 1): Step in new grade
- `promotion_letter_ref` (VARCHAR 100, NULL): Letter reference
- `remarks` (TEXT, NULL): Promotion remarks
- `created_at` (TIMESTAMP): Record creation timestamp

**Indexes:**
- (staff, -promotion_date)

---

### 7. **users_role**
Custom role definitions for user access control.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `role_name` (VARCHAR 50, UNIQUE): Role identifier
  - Choices: admin_staff, director, chief_registrar, president, staff
- `display_name` (VARCHAR 100): Display name
- `description` (TEXT, NULL): Role description
- `permissions` (JSON): Role permissions object
- `is_active` (BOOLEAN): Active status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

---

### 8. **users_customuser**
Extended Django User model with staff integration.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `username` (VARCHAR 150, UNIQUE): Username
- `email` (EMAIL, UNIQUE): Email address
- `first_name` (VARCHAR 150): First name
- `last_name` (VARCHAR 150): Last name
- `is_active` (BOOLEAN): Active status
- `is_staff` (BOOLEAN): Django staff status
- `is_superuser` (BOOLEAN): Superuser status
- `staff_id` (FK → staff_staff, NULL, UNIQUE): Associated staff record
- `role_id` (FK → users_role, NULL): User role
- `employee_id` (VARCHAR 20, UNIQUE, NULL): Employee ID
- `phone_number` (VARCHAR 20, NULL): Phone number
- `department` (VARCHAR 100, NULL): Department name
- `is_staff_user` (BOOLEAN): Is organization staff
- `last_login_ip` (IP): Last login IP address
- `failed_login_attempts` (INTEGER): Failed login counter
- `account_locked_until` (TIMESTAMP, NULL): Account lock timestamp
- `is_account_locked` (BOOLEAN): Account lock status
- `password_changed_at` (TIMESTAMP, NULL): Password change timestamp
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `created_by` (VARCHAR 200, NULL): Creating user

**Custom Permissions:**
- can_view_audit_logs
- can_export_data
- can_manage_users
- can_view_reports

**Methods:**
- `has_role(role_name)`: Check user role
- `has_permission(permission)`: Check specific permission

---

### 9. **users_useractivity**
User activity and login audit trail.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `user_id` (FK → users_customuser): User
- `activity_type` (VARCHAR 50): Activity type
  - Choices: login, logout, password_change, account_lock, account_unlock, data_export, record_view, record_create, record_update, record_delete, other
- `description` (TEXT, NULL): Activity description
- `ip_address` (IP, NULL): IP address
- `user_agent` (TEXT, NULL): Browser user agent
- `timestamp` (TIMESTAMP): Activity timestamp

**Indexes:**
- (user, -timestamp)
- (activity_type, -timestamp)

---

### 10. **audit_auditlog** (COMPREHENSIVE AUDIT TRAIL)
Tracks all system changes for compliance and security.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `user` (VARCHAR 200): Username who performed action
- `user_email` (EMAIL, NULL): User's email
- `action` (VARCHAR 50): Action type
  - Choices: CREATE, UPDATE, DELETE, VIEW, EXPORT, LOGIN, LOGOUT, APPROVE, REJECT, OTHER
- `model_name` (VARCHAR 100): Affected model/table name
- `record_id` (VARCHAR 200): ID of affected record
- `record_identifier` (VARCHAR 500, NULL): Human-readable record ID (e.g., staff name)
- `old_values` (JSON, NULL): Previous field values
- `new_values` (JSON, NULL): New field values
- `changed_fields` (JSON, NULL): List of modified fields
- `ip_address` (IP, NULL): Request IP address
- `user_agent` (TEXT, NULL): Browser information
- `request_method` (VARCHAR 10, NULL): HTTP method
- `request_path` (VARCHAR 500, NULL): Request URL path
- `remarks` (TEXT, NULL): Additional context
- `status` (VARCHAR 50, DEFAULT 'SUCCESS'): Action status (SUCCESS/FAILURE/PARTIAL)
- `error_message` (TEXT, NULL): Error details if failed
- `timestamp` (TIMESTAMP): Action timestamp

**Indexes:**
- (user, -timestamp)
- (model_name, record_id)
- (action, -timestamp)
- (ip_address, -timestamp)
- (-timestamp)

**Methods:**
- `get_changes_summary()`: Human-readable change summary

---

### 11. **audit_auditlogarchive**
Archives old audit logs for long-term retention.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `audit_log_id` (BIGINT): Original audit log ID
- `user` (VARCHAR 200): Username
- `user_email` (EMAIL, NULL): Email
- `action` (VARCHAR 50): Action type
- `model_name` (VARCHAR 100): Model name
- `record_id` (VARCHAR 200): Record ID
- `record_identifier` (VARCHAR 500, NULL): Record identifier
- `old_values` (JSON, NULL): Previous values
- `new_values` (JSON, NULL): New values
- `ip_address` (IP, NULL): IP address
- `timestamp` (TIMESTAMP): Original timestamp
- `archived_at` (TIMESTAMP): Archive timestamp

**Indexes:**
- (model_name, record_id)
- (-timestamp)

---

### 12. **audit_auditsettings**
Configuration for audit logging behavior.

**Fields:**
- `id` (PK): Auto-incrementing primary key
- `retention_days` (INTEGER, DEFAULT 365): Log retention period
- `archive_old_logs` (BOOLEAN, DEFAULT TRUE): Archive instead of delete
- `log_all_views` (BOOLEAN, DEFAULT FALSE): Log all view actions
- `log_failed_logins` (BOOLEAN, DEFAULT TRUE): Log failed logins
- `notify_on_critical_changes` (BOOLEAN, DEFAULT TRUE): Send notifications
- `critical_models` (JSON): List of critical model names
- `last_updated` (TIMESTAMP): Last update timestamp

---

## Key Features

### Auto-Calculated Fields
1. **years_of_service**: Calculated from first_appointment_date to today
2. **retirement_date**: MIN(age 60, 35 years of service)
3. **next_promotion_date**: last_promotion_date + 3 years (or first_appointment_date + 3 years if never promoted)

### Relationships
- **Staff → Department**: Many-to-One (Required)
- **Staff → Designation**: Many-to-One (Required)
- **Staff → PostingLocation**: Many-to-One (Optional)
- **Staff → GradeLevel**: Many-to-One (Optional)
- **Staff → StaffPromotion**: One-to-Many
- **CustomUser → Staff**: One-to-One (Optional)
- **CustomUser → Role**: Many-to-One (Optional)
- **UserActivity → CustomUser**: Many-to-One

### Data Validation
- Email addresses must be unique at Staff and CustomUser level
- Staff IDs must be unique
- Date of birth must be reasonable (historical date)
- first_appointment_date cannot be in the future
- Employment status has controlled choices
- Grade level must have positive step amounts

### Security Features
- Complete audit trail via AuditLog table
- User activity tracking via UserActivity table
- Role-based access control (RBAC)
- Custom permissions per role
- Account lockout mechanism
- IP address tracking
- Failed login attempt tracking
- Password change tracking

### Compliance
- 365-day audit log retention
- Archive old logs to separate table
- Comprehensive change tracking
- User action logging
- Supports compliance and forensic analysis

## Django Apps Structure

```
biodata_management/  (Project)
├── manage.py
├── requirements.txt
├── departments/      (App for organization structure)
│   └── models.py     (Department, PostingLocation, Designation, GradeLevel)
├── staff/            (App for staff biodata)
│   └── models.py     (Staff, StaffPromotion)
├── users/            (App for authentication & access control)
│   └── models.py     (CustomUser, Role, UserActivity)
└── audit/            (App for logging & compliance)
    └── models.py     (AuditLog, AuditLogArchive, AuditSettings)
```

## Installation & Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure database in settings.py
# Update PostgreSQL credentials

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Create default roles
python manage.py shell
# Then create Role objects for: admin_staff, director, chief_registrar, president, staff

# Run development server
python manage.py runserver
```

## Query Examples

```python
# Get all active staff
staff = Staff.objects.filter(is_active=True).order_by('last_name')

# Get staff due for promotion
due_for_promotion = Staff.objects.filter(next_promotion_date__lte=date.today())

# Get staff near retirement (within 1 year)
from datetime import timedelta
retirement_soon = Staff.objects.filter(
    retirement_date__lte=date.today() + timedelta(days=365)
).order_by('retirement_date')

# Get staff by department
legal_staff = Staff.objects.filter(department__name='Legal')

# Get audit trail for specific staff
audit_logs = AuditLog.objects.filter(
    model_name='Staff',
    record_id=staff.id
).order_by('-timestamp')

# Get user activity for specific user
user_activities = UserActivity.objects.filter(user=user).order_by('-timestamp')
```

## Performance Considerations
- Indexes on frequently queried fields (staff_id, email, department)
- Composite indexes for common filter combinations
- Archive audit logs to separate table after retention period
- Consider database connection pooling
- Use pagination for list endpoints
- Implement caching for read-heavy operations
