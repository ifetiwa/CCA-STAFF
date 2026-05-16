# Developer Quick Reference Guide

## Project Overview
- **Project**: Staff Biodata Management System
- **Organization**: Customary Court of Appeal (FCT)
- **Status**: Phase 2 Complete (Models Created)
- **Next**: Phase 3 (API Serializers, ViewSets, Integration)

---

## Directory Structure

```
CCA STAFF/
├── frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── StaffList.jsx
│   │   │   └── AddStaff.jsx
│   │   ├── styles/
│   │   │   ├── index.css (global styles + CCA branding)
│   │   │   └── layout.css (layout structure)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
└── backend (Django + DRF)
    ├── biodata_management/
    │   ├── settings.py (PostgreSQL, DRF, CORS configured)
    │   ├── urls.py
    │   ├── wsgi.py
    │   └── asgi.py
    ├── departments/
    │   ├── models.py (Department, PostingLocation, Designation, GradeLevel)
    │   ├── admin.py
    │   ├── views.py
    │   ├── serializers.py
    │   ├── urls.py
    │   └── apps.py
    ├── staff/
    │   ├── models.py (Staff [30+ fields], StaffPromotion)
    │   ├── admin.py
    │   ├── views.py
    │   ├── serializers.py
    │   ├── urls.py
    │   └── apps.py
    ├── users/
    │   ├── models.py (CustomUser extends AbstractUser, Role, UserActivity)
    │   ├── admin.py
    │   ├── views.py
    │   ├── serializers.py
    │   ├── urls.py
    │   └── apps.py
    ├── audit/
    │   ├── models.py (AuditLog [18 fields], AuditLogArchive, AuditSettings)
    │   ├── admin.py
    │   ├── views.py
    │   ├── serializers.py
    │   ├── middleware.py
    │   ├── urls.py
    │   └── apps.py
    ├── manage.py
    ├── requirements.txt
    ├── DATABASE_SCHEMA.md
    └── README.md
```

---

## Database Schema Summary

### 12 Models Across 4 Apps

#### **departments/** (4 Models)
| Model | Fields | Purpose |
|-------|--------|---------|
| Department | name, code, head, contact, location | Organization structure |
| PostingLocation | name, address, state, city, code | Physical work locations |
| Designation | title, rank_order, type, min_exp, education | Job titles/ranks |
| GradeLevel | grade_level, salary, steps, increment | Salary classification |

#### **staff/** (2 Models)
| Model | Fields | Purpose |
|-------|--------|---------|
| Staff | **30+ fields**: personal, contact, identification, employment, service dates, calculated fields | Core personnel biodata |
| StaffPromotion | staff, promotion_date, prev/new designation, grade | Promotion history |

**Staff Model Highlights:**
- Auto-calculated: years_of_service, retirement_date, next_promotion_date
- Passport photo upload support
- Emergency contact & banking details
- Properties: age, is_due_for_promotion, is_due_for_retirement, time_to_retirement

#### **users/** (3 Models)
| Model | Fields | Purpose |
|-------|--------|---------|
| Role | role_name, permissions (JSON), active | RBAC definitions |
| CustomUser | extends AbstractUser, staff FK, role FK | User authentication |
| UserActivity | user, activity_type, ip_address, timestamp | Action tracking |

#### **audit/** (3 Models)
| Model | Fields | Purpose |
|-------|--------|---------|
| AuditLog | user, action, model_name, old_values, new_values | Change tracking |
| AuditLogArchive | same as AuditLog | Long-term retention |
| AuditSettings | retention_days, archive_old_logs, critical_models | Configuration |

---

## Key Features

### ✅ Staff Auto-Calculations
```python
# Auto-calculated on save():
years_of_service = (today - first_appointment_date) / 365.25
retirement_date = MIN(age 60, first_appointment + 35 years)
next_promotion_date = last_promotion_date + 3 years (or first appointment + 3 if never promoted)
```

### ✅ 5 Role Types
1. **admin_staff** - Full access to all features
2. **director** - Manage staff, approve promotions
3. **chief_registrar** - View all, export data
4. **president** - Approve major decisions
5. **staff** - View own record only

### ✅ Audit Trail
- Tracks: Who changed what, when, where (IP), and how
- Stores: old_values and new_values in JSON
- Archives: old logs after retention period
- Supports: compliance and forensic analysis

---

## Frontend Setup

```bash
# Navigate to project root
cd "c:\Users\hp\Documents\CCA STAFF"

# Install dependencies
npm install

# Run development server (port 5173)
npm run dev

# Build for production
npm run build
```

**Frontend Colors (CCA Branding):**
- Primary Blue: #1a3a52
- Primary Dark: #0f2538
- Primary Light: #2d5a7b
- Accent Gold: #d4a574

---

## Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create PostgreSQL database
# CREATE DATABASE cca_staff_biodata;
# (Update settings.py with credentials first)

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server (port 8000)
python manage.py runserver
```

**Important Settings (biodata_management/settings.py):**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'cca_staff_biodata',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

INSTALLED_APPS = [
    # ... django apps ...
    'rest_framework',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    
    # Local apps
    'users',
    'departments',
    'staff',
    'audit',
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
```

---

## API Endpoints (To Be Implemented)

### Staff Management
```
GET    /api/staff/                          # List all staff
POST   /api/staff/                          # Create new staff
GET    /api/staff/{id}/                     # Retrieve staff details
PUT    /api/staff/{id}/                     # Update staff
DELETE /api/staff/{id}/                     # Delete staff (soft delete)
GET    /api/staff/due-for-promotion/        # Get staff due for promotion
GET    /api/staff/due-for-retirement/       # Get staff near retirement
POST   /api/staff/{id}/promote/             # Record promotion
```

### Departments
```
GET    /api/departments/                    # List departments
POST   /api/departments/                    # Create department
GET    /api/departments/{id}/               # Retrieve department
PUT    /api/departments/{id}/               # Update department
```

### Users & Authentication
```
POST   /api/users/login/                    # Obtain auth token
POST   /api/users/logout/                   # Logout
POST   /api/users/change-password/          # Change password
GET    /api/users/                          # List users (admin only)
POST   /api/users/                          # Create user (admin only)
```

### Audit & Reporting
```
GET    /api/audit-logs/                     # Get audit logs
GET    /api/audit-logs/staff/{id}/          # Get logs for specific staff
GET    /api/reports/retirement-forecast/    # Retirement forecast
GET    /api/reports/promotions/             # Promotion history
```

---

## Common Development Tasks

### Add New Staff Member (Django Shell)
```bash
python manage.py shell
```

```python
from staff.models import Staff
from departments.models import Department, Designation, GradeLevel
from datetime import date

dept = Department.objects.get(name='Legal')
desig = Designation.objects.get(title='Legal Officer')
grade = GradeLevel.objects.get(grade_level='GL12')

staff = Staff.objects.create(
    staff_id='CCA/2025/001',
    first_name='John',
    last_name='Doe',
    date_of_birth=date(1990, 5, 15),
    gender='M',
    state_of_origin='Lagos',
    email='john.doe@cca.gov.ng',
    phone_number='08012345678',
    residential_address='123 Main St',
    residential_state='Lagos',
    residential_city='Lagos',
    marital_status='Married',
    department=dept,
    designation=desig,
    grade_level=grade,
    employment_type='Permanent',
    first_appointment_date=date(2020, 3, 15),
)
# Automatically calculates: years_of_service, retirement_date, next_promotion_date
```

### View Staff Due for Promotion
```python
from staff.models import Staff
from datetime import date

due = Staff.objects.filter(
    next_promotion_date__lte=date.today(),
    is_active=True
).order_by('next_promotion_date')

for s in due:
    print(f"{s.get_full_name()} - Due: {s.next_promotion_date}")
```

### View Audit Trail
```python
from audit.models import AuditLog

logs = AuditLog.objects.filter(
    model_name='Staff',
    record_id='1'
).order_by('-timestamp')

for log in logs:
    print(f"{log.user} - {log.action} at {log.timestamp}")
    print(f"  Changes: {log.get_changes_summary()}")
```

---

## Important Code References

### Staff Model Location
📄 `backend/staff/models.py` - Lines 1-450+

**Key Methods:**
- `get_full_name()` - Returns formatted full name
- `calculate_years_of_service()` - Calculates service duration
- `calculate_retirement_date()` - Auto-calculates retirement date
- `calculate_next_promotion_date()` - Auto-calculates next promotion
- `save()` - Overridden to call auto-calculations

**Properties:**
- `age` - Current age
- `is_due_for_promotion` - Boolean
- `is_due_for_retirement` - Boolean
- `time_to_retirement` - Days remaining

### Department Models Location
📄 `backend/departments/models.py` - 4 models with relationships

### User Models Location
📄 `backend/users/models.py` - CustomUser extends AbstractUser

### Audit Models Location
📄 `backend/audit/models.py` - Comprehensive change tracking

---

## Frontend Components Reference

### Header Component
📄 `src/components/Header.jsx`
- Search box functionality
- User dropdown menu (Settings, Logout)
- Icons from lucide-react

### Sidebar Component
📄 `src/components/Sidebar.jsx`
- 7 navigation menu items
- Active link highlighting
- CCA brand logo
- Navigation icons

### Dashboard Page
📄 `src/pages/Dashboard.jsx`
- 4 stat cards (with mock data)
- Recent staff table
- Upcoming events sidebar
- Quick action buttons

### Staff List Page
📄 `src/pages/StaffList.jsx`
- Search by name/email/position
- Filter by department and status
- 8-column staff table
- Action buttons (View, Edit, Delete)

### Add Staff Page
📄 `src/pages/AddStaff.jsx`
- Multi-section form (3 sections)
- Form validation
- Success/error messages
- All required fields for staff creation

---

## Git Workflow (When Ready)

```bash
# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Phase 2 complete - All models created"

# Add remote
git remote add origin https://github.com/your-org/cca-staff-biodata.git

# Push to GitHub
git push -u origin main
```

---

## Testing Quick Commands

### Run Django Tests
```bash
python manage.py test
```

### Run Frontend Tests (when added)
```bash
npm test
```

### Check Django Health
```bash
python manage.py check
```

### Verify Database Connection
```bash
python manage.py dbshell
# SELECT version();
```

---

## Debugging Tips

### Django Debug
- Use `python manage.py shell` for interactive testing
- Use Django admin at `/admin/` to view data
- Check `logs/` directory for application logs

### Frontend Debug
- Use browser DevTools (F12)
- Check React DevTools extension
- Check Network tab for API calls
- Check Console for JavaScript errors

### Database Debug
- Use pgAdmin (PostgreSQL GUI client)
- Use DBeaver for SQL queries
- Check PostgreSQL logs for errors

---

## Next Phase Checklist

### Before Starting Phase 3
- [ ] Verify all models created successfully
- [ ] Test Django shell with Staff model
- [ ] Verify PostgreSQL connection
- [ ] Check all imports work without errors
- [ ] Run migrations: `python manage.py migrate`

### Phase 3 Tasks
- [ ] Create DRF Serializers for all 12 models
- [ ] Create ViewSets with CRUD operations
- [ ] Create API endpoints with proper filtering/searching
- [ ] Connect React frontend to API
- [ ] Implement authentication flow
- [ ] Add file upload for passport photos
- [ ] Create remaining pages (Personnel Records, Reports, Audit Trail, Settings)

---

**Last Updated**: January 2025
**Status**: ✅ Phase 2 Complete - All 12 Models Implemented
**Next**: Phase 3 - API Serializers & ViewSets
