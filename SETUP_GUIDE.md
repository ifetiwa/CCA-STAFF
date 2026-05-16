# Staff Biodata Management System - Complete Setup Guide

## 📋 Prerequisites

### Frontend
- Node.js 16+ with npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Backend
- Python 3.9+
- PostgreSQL 12+
- pip (Python package manager)

---

## 🚀 Quick Start (Windows)

### Frontend Setup (5 minutes)
```powershell
cd "c:\Users\hp\Documents\CCA STAFF"
npm install
npm run dev
# Access at: http://localhost:5174/
```

### Backend Setup (10 minutes)
```powershell
cd "c:\Users\hp\Documents\CCA STAFF"

# Run the setup script
.\setup-backend.bat

# If prompted, follow the steps:
# 1. Wait for virtual environment to be created
# 2. Wait for dependencies to install
# 3. Django check should complete without errors
```

### Manual Backend Setup (If script doesn't work)
```powershell
cd "c:\Users\hp\Documents\CCA STAFF\backend"

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Check Django
python manage.py check

# Create database
# Using psql or pgAdmin:
# CREATE DATABASE cca_staff_biodata;
# CREATE USER biodata_user WITH PASSWORD 'secure_password';
# GRANT ALL PRIVILEGES ON DATABASE cca_staff_biodata TO biodata_user;

# Update settings.py with database credentials, then run:
python manage.py migrate

# Create superuser
python manage.py createsuperuser
# Follow prompts for username, email, password

# Run development server
python manage.py runserver
# Access at: http://localhost:8000/
# Admin: http://localhost:8000/admin/
```

---

## 🏗️ Project Structure

```
CCA STAFF/
├── src/
│   ├── components/          # React components
│   ├── pages/               # React pages
│   ├── styles/              # CSS files
│   ├── utils/               # Helper functions (api.js)
│   ├── context/             # React Context (AuthContext.jsx)
│   ├── App.jsx              # Main app with routing
│   └── main.jsx             # Entry point
├── backend/
│   ├── biodata_management/  # Django settings
│   ├── departments/         # Department app (models created)
│   ├── staff/               # Staff app (models created)
│   ├── users/               # Users app (models created)
│   ├── audit/               # Audit app (models created)
│   ├── manage.py            # Django CLI
│   └── requirements.txt      # Python dependencies
├── package.json             # Node dependencies
├── vite.config.js           # Vite configuration
├── DATABASE_SCHEMA.md       # Schema documentation
├── IMPLEMENTATION_SUMMARY.md # What's been done
└── DEVELOPER_GUIDE.md       # Developer reference
```

---

## 🔧 Technology Stack

### Frontend
✅ React 19.2.6
✅ Vite 8.0.12
✅ React Router 7.15.1
✅ Lucide React (icons)
✅ Axios (HTTP client)

### Backend
✅ Django 4.2.0
✅ Django REST Framework 3.14.0
✅ PostgreSQL (database)
✅ Pillow (image handling)
✅ drf-spectacular (API docs)

---

## 📱 Pages & Features

### ✅ COMPLETED
- **Dashboard** - Overview with stats and recent staff
- **Staff List** - Browse, search, and filter staff
- **Add Staff** - Form to create new staff records
- **Login** - Authentication page
- **Settings** - User preferences and password change

### 🔄 IN PROGRESS (API Integration Needed)
- **Personnel Records** - View/edit individual staff
- **Reports & Analytics** - Staff data reports
- **Audit Trail** - System change history

---

## 🔐 Authentication

### Current Status
- Login UI is ready
- AuthContext manages user state
- API integration ready (awaiting backend)

### Login Credentials (Demo)
```
Email: admin@cca.gov.ng
Password: any password (demo mode)
```

### Real Authentication (After Backend Setup)
Backend provides JWT tokens via `/api/users/login/` endpoint

---

## 🎨 Branding Colors

The system uses the official CCA colors:
- **Primary Blue**: #1a3a52
- **Primary Dark**: #0f2538
- **Primary Light**: #2d5a7b
- **Accent Gold**: #d4a574
- **Success**: #27ae60
- **Danger**: #e74c3c
- **Warning**: #f39c12

---

## 📡 API Endpoints (To Be Implemented)

### Authentication
```
POST   /api/users/login/              # Login
POST   /api/users/logout/             # Logout
POST   /api/users/change-password/    # Change password
```

### Staff Management
```
GET    /api/staff/                    # List all staff
POST   /api/staff/                    # Create staff
GET    /api/staff/{id}/               # Get staff details
PUT    /api/staff/{id}/               # Update staff
DELETE /api/staff/{id}/               # Delete staff
GET    /api/staff/due-for-promotion/  # Staff due for promotion
GET    /api/staff/due-for-retirement/ # Staff due for retirement
```

### Other Resources
```
GET    /api/departments/              # List departments
GET    /api/audit-logs/               # Get audit logs
GET    /api/reports/                  # Various reports
```

---

## 🧪 Testing

### Frontend Development
```powershell
cd "c:\Users\hp\Documents\CCA STAFF"
npm run dev
# Visit http://localhost:5174/ in browser
```

### Backend Development
```powershell
cd "c:\Users\hp\Documents\CCA STAFF\backend"
python manage.py runserver
# Visit http://localhost:8000/admin/ in browser
```

### API Testing
Use Postman or similar tool with:
- **Base URL**: http://localhost:8000/api/
- **Headers**: 
  - Authorization: Bearer {token}
  - Content-Type: application/json

---

## 📚 Useful Commands

### Frontend
```bash
npm install              # Install dependencies
npm run dev             # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
```

### Backend
```bash
python manage.py runserver           # Start dev server
python manage.py migrate             # Apply migrations
python manage.py makemigrations      # Create migrations
python manage.py createsuperuser     # Create admin user
python manage.py shell               # Interactive Python shell
python manage.py collectstatic       # Collect static files
```

---

## 🐛 Troubleshooting

### Port Already in Use
```powershell
# Frontend (Vite tries next available port automatically)
npm run dev

# Backend (use different port)
python manage.py runserver 8001
```

### Database Connection Error
```
Error: could not connect to server: No such file or directory

Solution:
1. Ensure PostgreSQL is running
2. Check credentials in backend/.env
3. Verify database exists: CREATE DATABASE cca_staff_biodata;
```

### Module Not Found (Python)
```
Error: ModuleNotFoundError: No module named 'django'

Solution:
1. Ensure virtual environment is activated
2. Install dependencies: pip install -r requirements.txt
```

### Module Not Found (JavaScript)
```
Error: Cannot find module 'react-router-dom'

Solution:
1. Install dependencies: npm install
2. Clear node_modules: rm -r node_modules && npm install
```

---

## 📝 Database Setup

### PostgreSQL Installation
1. Download PostgreSQL from https://www.postgresql.org/download/
2. Install with default settings
3. Note the password you set for 'postgres' user

### Create Database
```sql
-- Connect as postgres user
CREATE DATABASE cca_staff_biodata;

-- Optional: Create specific user
CREATE USER biodata_user WITH PASSWORD 'secure_password';
ALTER ROLE biodata_user SET client_encoding TO 'utf8';
ALTER ROLE biodata_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE biodata_user SET timezone TO 'Africa/Lagos';
GRANT ALL PRIVILEGES ON DATABASE cca_staff_biodata TO biodata_user;
```

### Update Django Settings
Edit `backend/biodata_management/settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'cca_staff_biodata',
        'USER': 'postgres',  # or biodata_user
        'PASSWORD': 'your_password_here',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

---

## 🚢 Deployment Checklist

### Before Going to Production
- [ ] Change SECRET_KEY in Django settings
- [ ] Set DEBUG = False
- [ ] Configure ALLOWED_HOSTS
- [ ] Set up HTTPS/SSL
- [ ] Configure email backend
- [ ] Setup database backups
- [ ] Configure static files serving
- [ ] Setup error logging
- [ ] Configure CORS properly
- [ ] Use production database

### Deployment Options
1. **Heroku** - Easiest for beginners
2. **AWS** - Scalable and reliable
3. **DigitalOcean** - Affordable and simple
4. **VPS** - Full control, requires more setup

---

## 📖 Documentation Files

- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database schema
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What's implemented
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Quick reference for developers
- **[README.md](backend/README.md)** - Backend specific documentation

---

## 🤝 Contributing

### Code Style
- Use meaningful variable names
- Comment complex logic
- Follow existing patterns
- Test before committing

### Branching
```bash
git checkout -b feature/your-feature
# Make changes
git commit -m "Add your feature"
git push origin feature/your-feature
# Create Pull Request
```

---

## 📞 Support

For issues or questions:
1. Check documentation files
2. Review existing issues
3. Check browser console for errors
4. Check Django server logs
5. Create detailed issue report

---

## 📄 License

This project is proprietary software for the Customary Court of Appeal, FCT.

---

**Last Updated**: May 14, 2026
**Version**: 1.0.0 Beta
**Status**: ✅ Frontend Ready • 🔄 Backend Requires Database Setup
