# Staff Biodata Management System — Backend

Django 5 + PostgreSQL backend for the Customary Court of Appeal (FCT) Staff
Biodata Management System.

## Stack

- Django + Django REST Framework
- PostgreSQL (via `psycopg2-binary`)
- `Pillow` for image uploads (staff photos)
- `django-auditlog` for change tracking
- `python-decouple` for `.env` configuration
- `django-cors-headers` for the React dev server (`:5173`)

## Apps

| App         | Purpose                                                          |
|-------------|------------------------------------------------------------------|
| `accounts`  | Custom `User` model with role choices + DRF viewset              |
| `staff`     | `Department`, `StaffMember`, `StaffDocument` + REST endpoints    |
| `dashboard` | Aggregate summary endpoint for the React dashboard               |
| `audit`     | Read-only API over `auditlog.LogEntry`                           |

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
Copy-Item .env.example .env  # then edit values

# Create the database in PostgreSQL first, then:
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API root: `http://localhost:8000/api/`
Admin:    `http://localhost:8000/admin/`

## Endpoints

| Method  | Path                              | Description                  |
|---------|-----------------------------------|------------------------------|
| POST    | `/api/auth/token/`                | Obtain DRF auth token        |
| GET/POST| `/api/accounts/users/`            | Manage users (admin only)    |
| GET/POST| `/api/staff/`                     | Staff CRUD                   |
| GET/POST| `/api/staff/departments/`         | Department CRUD              |
| GET/POST| `/api/staff/documents/`           | Personnel record uploads     |
| GET     | `/api/dashboard/summary/`         | Dashboard aggregates         |
| GET     | `/api/audit/entries/`             | Audit trail (read-only)      |
