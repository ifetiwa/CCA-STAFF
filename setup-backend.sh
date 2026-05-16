#!/bin/bash
# Backend Setup Script

echo "========================================"
echo "Django Backend Setup Script"
echo "========================================"

cd backend

# Create virtual environment
echo "Creating virtual environment..."
python -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/Scripts/activate  # On Windows: venv\Scripts\activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
SECRET_KEY=your-secret-key-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_ENGINE=django.db.backends.postgresql
DATABASE_NAME=cca_staff_biodata
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
EOF
    echo ".env file created. Please update with your settings."
fi

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Create superuser
echo "Creating superuser..."
echo "Please enter superuser credentials:"
python manage.py createsuperuser

echo ""
echo "========================================"
echo "Backend setup complete!"
echo "========================================"
echo ""
echo "To start the development server, run:"
echo "  cd backend"
echo "  source venv/Scripts/activate"
echo "  python manage.py runserver"
echo ""
