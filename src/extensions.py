"""Flask extensions initialization."""
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail

# Initialize extensions
login_manager = LoginManager()
csrf = CSRFProtect()
# Limiter will read storage_uri from app.config['RATELIMIT_STORAGE_URL'] during init_app
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
mail = Mail()


def init_extensions(app):
    """Initialize Flask extensions with app."""
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.session_protection = 'basic'  # Basic session protection (user-agent only)
    login_manager.refresh_view = None  # Don't auto-refresh sessions

    csrf.init_app(app)
    # Exempt API routes from CSRF (using session-based auth + CORS instead)
    csrf.exempt('auth.register')
    csrf.exempt('auth.login')
    csrf.exempt('auth.logout')
    csrf.exempt('auth.session')
    csrf.exempt('auth.request_password_reset')
    csrf.exempt('auth.reset_password')
    csrf.exempt('auth.validate_reset_token')

    # Initialize limiter (will read RATELIMIT_STORAGE_URL from app.config)
    limiter.init_app(app)
    mail.init_app(app)

    # User loader for Flask-Login
    from src.auth.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(int(user_id))
