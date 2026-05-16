@echo off
REM Backend Setup Script for Windows

echo.
echo ========================================
echo Django Backend Setup Script (Windows)
echo ========================================
echo.

cd backend

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    (
        echo SECRET_KEY=your-secret-key-change-this-in-production
        echo DEBUG=True
        echo ALLOWED_HOSTS=localhost,127.0.0.1
        echo DATABASE_ENGINE=django.db.backends.postgresql
        echo DATABASE_NAME=cca_staff_biodata
        echo DATABASE_USER=postgres
        echo DATABASE_PASSWORD=postgres
        echo DATABASE_HOST=localhost
        echo DATABASE_PORT=5432
    ) > .env
    echo .env file created. Please update with your settings.
)

REM Check Django
echo Checking Django installation...
python manage.py check

echo.
echo ========================================
echo Backend setup complete!
echo ========================================
echo.
echo Next steps:
echo 1. Update .env with your database credentials
echo 2. Create PostgreSQL database "cca_staff_biodata"
echo 3. Run: python manage.py migrate
echo 4. Run: python manage.py createsuperuser
echo 5. Run: python manage.py runserver
echo.
pause
