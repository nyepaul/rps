"""Flask extensions initialization."""
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize extensions
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)


def init_extensions(app):
    """Initialize Flask extensions with app."""
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.session_protection = 'strong'  # Protect against session hijacking
    login_manager.refresh_view = None  # Don't auto-refresh sessions

    csrf.init_app(app)
    # Exempt API routes from CSRF (using session-based auth + CORS instead)
    csrf.exempt('auth.register')
    csrf.exempt('auth.login')
    csrf.exempt('auth.logout')
    csrf.exempt('auth.session')

    limiter.init_app(app)

    # User loader for Flask-Login
    from src.auth.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(int(user_id))
