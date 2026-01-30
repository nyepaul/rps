"""Flask extensions initialization."""

from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail

# Initialize extensions
login_manager = LoginManager()
csrf = CSRFProtect()
# Limiter initialization
limiter = Limiter(
    key_func=get_remote_address, default_limits=["5000 per day", "1000 per hour"]
)
mail = Mail()


def init_extensions(app):
    """Initialize Flask extensions with app."""
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to access this page."
    login_manager.session_protection = (
        "strong"  # Strong session protection (user-agent + IP)
    )
    login_manager.refresh_view = None  # Don't auto-refresh sessions

    csrf.init_app(app)
    # Exempt API routes from CSRF (using session-based auth + CORS instead)
    csrf.exempt("auth.register")
    csrf.exempt("auth.login")
    csrf.exempt("auth.logout")
    csrf.exempt("auth.session")
    csrf.exempt("auth.request_password_reset")
    csrf.exempt("auth.reset_password")
    csrf.exempt("auth.validate_reset_token")

    # Initialize limiter
    # If not enabled, testing, debug mode, or explicitly set to memory, use memory storage
    # This avoids Redis dependency in development/tests
    if (
        not app.config.get("RATELIMIT_ENABLED", True)
        or app.config.get("RATELIMIT_STORAGE_URI") == "memory://"
        or app.config.get("TESTING")
        or app.config.get("DEBUG")
    ):
        app.config["RATELIMIT_STORAGE_URI"] = "memory://"

    limiter.init_app(app)

    mail.init_app(app)

    # User loader for Flask-Login
    from src.auth.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(int(user_id))
