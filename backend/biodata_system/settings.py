"""
Django settings for biodata_system.

Staff Biodata Management System for the Customary Court of Appeal (FCT).
Reads sensitive values from environment via python-decouple.
"""
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Core security
# ---------------------------------------------------------------------------
SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

CSRF_TRUSTED_ORIGINS = config(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)

# Render injects RENDER_EXTERNAL_HOSTNAME at runtime (e.g.
# "cca-staff-backend.onrender.com"). Auto-allow it so the platform's
# health probe doesn't get a 400 DisallowedHost — that 400 is what
# Render escalates into the 503 the user sees in the browser. Same
# for CSRF trusted origins so admin POSTs work without manual setup.
_render_host = config("RENDER_EXTERNAL_HOSTNAME", default="")
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = list(ALLOWED_HOSTS) + [_render_host]
    CSRF_TRUSTED_ORIGINS = list(CSRF_TRUSTED_ORIGINS) + [f"https://{_render_host}"]

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "auditlog",
    "crispy_forms",
    "crispy_bootstrap5",
    "cloudinary",
    "cloudinary_storage",
]

# crispy-forms template pack
CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap5"
CRISPY_TEMPLATE_PACK = "bootstrap5"

LOCAL_APPS = [
    "accounts",
    "departments",
    "staff",
    "dashboard",
    "audit",
    "notifications",
    "reports",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "accounts.middleware.SessionTimeoutMiddleware",
    "accounts.password_change.ForcePasswordChangeMiddleware",
    "accounts.middleware.ContentSecurityPolicyMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "auditlog.middleware.AuditlogMiddleware",
]

# ---------------------------------------------------------------------------
# Session timeout (security policy: 1 hour inactivity)
# ---------------------------------------------------------------------------
SESSION_INACTIVITY_TIMEOUT = timedelta(
    minutes=config("SESSION_INACTIVITY_MINUTES", default=60, cast=int)
)
SESSION_COOKIE_AGE = int(SESSION_INACTIVITY_TIMEOUT.total_seconds())
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # SPA must read the cookie to send X-CSRFToken
CSRF_COOKIE_SAMESITE = "Lax"

LOGIN_URL = "/api/accounts/login/"
LOGIN_REDIRECT_URL = "/"

ROOT_URLCONF = "biodata_system.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "biodata_system.wsgi.application"
ASGI_APPLICATION = "biodata_system.asgi.application"

# ---------------------------------------------------------------------------
# Database
# Priority:
#   1. DATABASE_URL (e.g. Neon, Render Postgres) — used in production.
#   2. USE_SQLITE=1 (default) — local dev SQLite.
#   3. Discrete DB_* vars — legacy local Postgres setup.
# ---------------------------------------------------------------------------
import dj_database_url  # noqa: E402

DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=config("DB_CONN_MAX_AGE", default=60, cast=int),
            ssl_require=config("DB_SSL_REQUIRE", default=True, cast=bool),
        )
    }
elif config("USE_SQLITE", default=True, cast=bool):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME"),
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
            "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
        }
    }

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# Session timeout, LOGIN_URL, and SESSION_INACTIVITY_TIMEOUT are configured
# in the Middleware / Session-timeout block above.
LOGOUT_REDIRECT_URL = LOGIN_URL

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {
        "NAME": "accounts.validators.StrongPasswordValidator",
        "OPTIONS": {"min_length": 10},
    },
]

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ---------------------------------------------------------------------------
# CORS (development against Vite at :5173)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-ng"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media files
#
# Static: WhiteNoise serves collected static files directly from gunicorn,
# with hashed filenames + gzip/brotli compression.
#
# Media: Cloudinary in production (Render's filesystem is ephemeral —
# anything written locally vanishes on redeploy). Falls back to local
# MEDIA_ROOT in dev when CLOUDINARY_URL is not set.
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

CLOUDINARY_URL = config("CLOUDINARY_URL", default="")

STORAGES = {
    "default": {
        "BACKEND": (
            "cloudinary_storage.storage.MediaCloudinaryStorage"
            if CLOUDINARY_URL
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

FILE_UPLOAD_MAX_MEMORY_SIZE = config(
    "FILE_UPLOAD_MAX_MEMORY_SIZE", default=5 * 1024 * 1024, cast=int
)
DATA_UPLOAD_MAX_MEMORY_SIZE = config(
    "DATA_UPLOAD_MAX_MEMORY_SIZE", default=10 * 1024 * 1024, cast=int
)

# ---------------------------------------------------------------------------
# Reports module — court branding shown in PDF/Excel headers.
# COURT_LOGO_PATH may point to a file on disk (e.g. inside MEDIA_ROOT or
# a STATICFILES_DIR). Leave unset to print only the court name.
# ---------------------------------------------------------------------------
COURT_NAME = config("COURT_NAME", default="Customary Court of Appeal, FCT")
COURT_LOGO_PATH = config("COURT_LOGO_PATH", default="")

# ---------------------------------------------------------------------------
# Pillow image handling defaults (used by ImageField in staff models)
# ---------------------------------------------------------------------------
STAFF_PHOTO_MAX_WIDTH = config("STAFF_PHOTO_MAX_WIDTH", default=800, cast=int)
STAFF_PHOTO_MAX_HEIGHT = config("STAFF_PHOTO_MAX_HEIGHT", default=800, cast=int)

# ---------------------------------------------------------------------------
# django-auditlog
# ---------------------------------------------------------------------------
AUDITLOG_INCLUDE_ALL_MODELS = config("AUDITLOG_INCLUDE_ALL_MODELS", default=False, cast=bool)
if AUDITLOG_INCLUDE_ALL_MODELS:
    AUDITLOG_EXCLUDE_TRACKING_MODELS = (
        "sessions.session",
        "admin.logentry",
        "contenttypes.contenttype",
        "authtoken.token",
        "audit.auditlog",
        "audit.loginattempt",
        "audit.userknownip",
        "audit.suspiciousactivity",
    )

# ---------------------------------------------------------------------------
# Suspicious activity detector (used by audit.services)
# ---------------------------------------------------------------------------
AUDIT_VIEWS_PER_HOUR_THRESHOLD = config(
    "AUDIT_VIEWS_PER_HOUR_THRESHOLD", default=50, cast=int
)
AUDIT_FAILED_LOGIN_THRESHOLD = config(
    "AUDIT_FAILED_LOGIN_THRESHOLD", default=5, cast=int
)
AUDIT_FAILED_LOGIN_WINDOW_MIN = config(
    "AUDIT_FAILED_LOGIN_WINDOW_MIN", default=15, cast=int
)

# ---------------------------------------------------------------------------
# Email (defaults to console backend in dev)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="no-reply@cca.gov.ng")

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------
# Always-on baseline (safe in both dev & prod).
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# CSP — override via env if a permissive policy is needed during integration.
CONTENT_SECURITY_POLICY = config(
    "CONTENT_SECURITY_POLICY",
    default=(
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "object-src 'none';"
    ),
)

# Production-only hardening.
if not DEBUG:
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
    # Render's internal health probe may hit the service over HTTP — don't
    # 301-redirect it, or the probe records a redirect and marks the
    # service unhealthy (which surfaces as a 503 to clients).
    SECURE_REDIRECT_EXEMPT = [r"^health/$"]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---------------------------------------------------------------------------
# Account-lockout policy (cache-backed, see accounts.lockout)
# ---------------------------------------------------------------------------
LOGIN_MAX_FAILED_ATTEMPTS = config("LOGIN_MAX_FAILED_ATTEMPTS", default=5, cast=int)
LOGIN_LOCKOUT_MINUTES = config("LOGIN_LOCKOUT_MINUTES", default=30, cast=int)

# Cache backend — locmem is fine for single-process dev. In production set
# DJANGO_CACHE_URL (e.g. redis://...) so lockouts are shared across workers.
CACHES = {
    "default": {
        "BACKEND": config(
            "DJANGO_CACHE_BACKEND",
            default="django.core.cache.backends.locmem.LocMemCache",
        ),
        "LOCATION": config("DJANGO_CACHE_LOCATION", default="biodata-cache"),
    }
}

# Upload safety — keep the per-process memory ceiling but also cap total
# request size and refuse parsers from accepting anything larger.
DATA_UPLOAD_MAX_NUMBER_FIELDS = config(
    "DATA_UPLOAD_MAX_NUMBER_FIELDS", default=1000, cast=int
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("DJANGO_LOG_LEVEL", default="INFO"),
    },
}
