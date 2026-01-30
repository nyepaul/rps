"""Application configuration."""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Database paths
if os.path.exists("/app/data"):
    # Docker environment
    DB_PATH = "/app/data/planning.db"
    BACKUP_DIR = "/app/backups"
    DATA_DIR = "/app/data"
else:
    # Local environment
    DB_PATH = str(BASE_DIR / "data" / "planning.db")
    BACKUP_DIR = str(BASE_DIR / "backups")
    DATA_DIR = str(BASE_DIR / "data")

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(BASE_DIR / "logs", exist_ok=True)


class Config:
    """Base configuration."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-change-in-production"

    # Database
    DATABASE_PATH = DB_PATH
    BACKUP_DIR = BACKUP_DIR
    DATA_DIR = DATA_DIR

    # Security
    # CRITICAL: Secure flag should always be True for production
    # Only disable for local development over HTTP (set SESSION_COOKIE_SECURE=false)
    SESSION_COOKIE_SECURE = (
        os.environ.get("SESSION_COOKIE_SECURE", "true").lower() == "true"
    )
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Set to None to allow cookies across different hostnames (IP, domain, local hostname)
    SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN", None)
    PERMANENT_SESSION_LIFETIME = 1800  # 30 minutes inactivity timeout

    # CSRF - Exempt API endpoints (REST API uses session auth + CORS)
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None  # No time limit
    WTF_CSRF_CHECK_DEFAULT = False  # Disable by default, enable for HTML forms

    # CORS
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

    # Rate Limiting
    # Use Redis for rate limit storage (required for multi-worker Gunicorn setup)
    # Falls back to memory:// if Redis is not available (dev mode only)
    RATELIMIT_STORAGE_URI = os.environ.get("REDIS_URL", "redis://localhost:6379")
    RATELIMIT_ENABLED = True

    # Encryption
    ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")  # Must be set in production

    # File Upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

    # Logging
    LOG_FILE = str(BASE_DIR / "logs" / "app.log")
    LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 5

    # Email Configuration
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "127.0.0.1")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "25"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
    MAIL_USE_SSL = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "RPS <noreply@pan2.app>")
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://rps.pan2.app")


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False

    # Require encryption key in production
    @classmethod
    def init_app(cls, app):
        if not cls.ENCRYPTION_KEY:
            raise ValueError(
                "ENCRYPTION_KEY environment variable must be set in production"
            )


class TestingConfig(Config):
    """Testing configuration."""

    TESTING = True
    DEBUG = False
    WTF_CSRF_ENABLED = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
