"""Flask application factory.

Authored by: pan
"""
from flask import Flask, send_from_directory, jsonify, request, g, session
from flask_login import current_user, logout_user
from datetime import datetime, timedelta
from src.config import config
from src.extensions import init_extensions
import time
from src.auth.routes import auth_bp
from src.routes.profiles import profiles_bp
from src.routes.analysis import analysis_bp
from src.routes.scenarios import scenarios_bp
from src.routes.action_items import action_items_bp
from src.routes.ai_services import ai_services_bp
from src.routes.skills import skills_bp
from src.routes.reports import reports_bp
from src.routes.admin import admin_bp
from src.routes.feedback import feedback_bp
from src.routes.roadmap import roadmap_bp
from src.routes.tax_optimization import tax_optimization_bp
from src.routes.fingerprint import fingerprint_bp
from src.routes.events import events_bp
from src.routes.user_backups import user_backups_bp
from src.__version__ import __version__, __release_date__, __release_notes__
from src.services.enhanced_audit_logger import EnhancedAuditLogger
import os
import logging
from logging.handlers import RotatingFileHandler


def _get_endpoint_description(path, method):
    """Generate human-readable description for network access based on endpoint."""
    # API endpoint mappings
    endpoint_descriptions = {
        # Auth endpoints
        ('/api/auth/login', 'POST'): 'User login attempt',
        ('/api/auth/logout', 'POST'): 'User logout',
        ('/api/auth/register', 'POST'): 'New user registration',
        ('/api/auth/check', 'GET'): 'Check authentication status',
        ('/api/auth/me', 'GET'): 'Get current user info',

        # Profile endpoints
        ('/api/profiles', 'GET'): 'List user profiles',
        ('/api/profiles', 'POST'): 'Create new profile',

        # Analysis endpoints
        ('/api/analysis/run', 'POST'): 'Run retirement simulation',
        ('/api/analysis/monte-carlo', 'POST'): 'Run Monte Carlo simulation',

        # AI service endpoints
        ('/api/ai/advice', 'POST'): 'Request AI financial advice',
        ('/api/ai/chat', 'POST'): 'AI chat conversation',

        # Admin endpoints
        ('/api/admin/users', 'GET'): 'Admin: List all users',
        ('/api/admin/audit-logs', 'GET'): 'Admin: View audit logs',
        ('/api/admin/statistics', 'GET'): 'Admin: View system statistics',

        # Events endpoints
        ('/api/events/batch', 'POST'): 'Track user interactions',

        # Page loads
        ('/', 'GET'): 'Load main application',
        ('/login', 'GET'): 'View login page',
        ('/register', 'GET'): 'View registration page',
    }

    # Check for exact match
    key = (path, method)
    if key in endpoint_descriptions:
        return endpoint_descriptions[key]

    # Check for pattern matches
    if path.startswith('/api/profiles/') and method == 'GET':
        return 'View profile details'
    elif path.startswith('/api/profiles/') and method == 'PUT':
        return 'Update profile'
    elif path.startswith('/api/profiles/') and method == 'DELETE':
        return 'Delete profile'
    elif path.startswith('/api/scenarios'):
        return f'Scenario management ({method})'
    elif path.startswith('/api/action-items'):
        return f'Action items ({method})'
    elif path.startswith('/api/admin/'):
        return f'Admin operation: {path.split("/")[-1]}'
    elif path.startswith('/api/reports'):
        return f'Generate report ({method})'
    elif path.startswith('/api/'):
        # Generic API call
        parts = path.split('/')
        resource = parts[2] if len(parts) > 2 else 'unknown'
        return f'API: {resource} ({method})'
    elif method == 'GET':
        return f'Page request: {path}'
    else:
        return f'{method} request to {path}'


def create_app(config_name='development'):
    """Create and configure Flask application."""
    app = Flask(__name__, static_folder='static', static_url_path='')

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    init_extensions(app)

    # Request timing tracking
    @app.before_request
    def track_request_start():
        """Track request start time for response timing measurement."""
        g.request_start_time = time.time()
        request._start_time = g.request_start_time

    # Session inactivity timeout - log out users after 30 minutes of inactivity
    @app.before_request
    def check_session_timeout():
        """Check for session inactivity and log out if exceeded."""
        # Skip for static assets and non-authenticated requests
        if request.path.startswith('/css/') or \
           request.path.startswith('/js/') or \
           request.path.startswith('/images/') or \
           request.path.endswith('.ico'):
            return

        # Make session permanent so PERMANENT_SESSION_LIFETIME applies
        session.permanent = True

        if current_user.is_authenticated:
            last_activity = session.get('last_activity')
            now = datetime.utcnow()

            if last_activity:
                # Parse the stored timestamp
                try:
                    last_activity_time = datetime.fromisoformat(last_activity)
                    inactive_duration = now - last_activity_time

                    # Check if inactive for more than 30 minutes
                    if inactive_duration > timedelta(minutes=30):
                        # Log the timeout
                        import json as json_module
                        EnhancedAuditLogger.log(
                            action='SESSION_TIMEOUT',
                            table_name='users',
                            record_id=current_user.id,
                            user_id=current_user.id,
                            details=json_module.dumps({
                                'username': current_user.username,
                                'inactive_minutes': round(inactive_duration.total_seconds() / 60, 1)
                            }),
                            status_code=401
                        )

                        # Clear session and log out
                        logout_user()
                        for key in list(session.keys()):
                            session.pop(key)
                        session.modified = True

                        # For API requests, return JSON error
                        if request.path.startswith('/api/'):
                            from flask import abort
                            abort(401)
                        return
                except (ValueError, TypeError):
                    pass

            # Update last activity timestamp
            session['last_activity'] = now.isoformat()

    # Network access logging - log all requests including unauthenticated
    @app.before_request
    def log_network_access():
        """Log all network access to the application, even without user interaction."""
        # Skip logging for static assets to avoid excessive logs
        if request.path.startswith('/css/') or \
           request.path.startswith('/js/') or \
           request.path.startswith('/images/') or \
           request.path.startswith('/fonts/') or \
           request.path.endswith('.ico') or \
           request.path.endswith('.png') or \
           request.path.endswith('.jpg') or \
           request.path.endswith('.svg') or \
           request.path.endswith('.woff') or \
           request.path.endswith('.woff2'):
            return

        # Determine user_id (None for unauthenticated)
        user_id = None
        if current_user and current_user.is_authenticated:
            user_id = current_user.id

        # Generate human-readable description based on endpoint
        path = request.path
        method = request.method
        description = _get_endpoint_description(path, method)

        # Log the network access with details
        EnhancedAuditLogger.log(
            action='NETWORK_ACCESS',
            table_name=None,
            record_id=None,
            user_id=user_id,
            details={
                'endpoint': path,
                'method': method,
                '_description': description
            },
            status_code=None  # Will be set in after_request
        )

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(profiles_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(scenarios_bp)
    app.register_blueprint(action_items_bp)
    app.register_blueprint(ai_services_bp)
    app.register_blueprint(skills_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(roadmap_bp)
    app.register_blueprint(tax_optimization_bp)
    app.register_blueprint(fingerprint_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(user_backups_bp)

    # Configure logging
    if not app.debug:
        if not os.path.exists(os.path.dirname(app.config['LOG_FILE'])):
            os.makedirs(os.path.dirname(app.config['LOG_FILE']))

        file_handler = RotatingFileHandler(
            app.config['LOG_FILE'],
            maxBytes=app.config['LOG_MAX_BYTES'],
            backupCount=app.config['LOG_BACKUP_COUNT']
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Retirement Planning System startup')

    # Security headers - prevent caching of sensitive data
    @app.after_request
    def set_security_headers(response):
        """Add comprehensive security headers to all responses."""
        # Calculate and add response timing header
        if hasattr(g, 'request_start_time'):
            response_time_ms = (time.time() - g.request_start_time) * 1000
            response.headers['X-Response-Time'] = f'{response_time_ms:.2f}ms'
            # Store for potential logging
            g.response_time_ms = response_time_ms

        # Add response size header for tracking
        response.headers['X-Content-Length'] = response.content_length or len(response.get_data())

        # Prevent caching of sensitive pages
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        # CRITICAL: HTTP Strict Transport Security (HSTS)
        # Force HTTPS for 1 year, include subdomains
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

        # Security headers (set once, no duplicates)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'  # Changed from DENY to SAMEORIGIN for iframe support
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Modern security headers
        response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=(), payment=()'
        response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
        response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
        response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'

        # Content Security Policy
        # NOTE: 'unsafe-inline' is still required for current inline scripts
        # TODO: Move inline scripts to external files and use nonces for better security
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
            "style-src 'self' 'unsafe-inline' https://unpkg.com",
            "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests"
        ]
        response.headers['Content-Security-Policy'] = "; ".join(csp_directives)

        return response

    # Error handlers
    @app.errorhandler(500)
    def server_error(e):
        app.logger.error(f"Server Error: {e}", exc_info=True)
        # Never expose internal error details in production
        if app.config.get('DEBUG'):
            return {'error': f'Internal server error: {str(e)}'}, 500
        return {'error': 'Internal server error'}, 500

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Not found'}, 404

    @app.errorhandler(400)
    def bad_request(e):
        # Sanitize error messages to avoid exposing framework details
        error_msg = str(e)
        # Remove Pydantic URLs and technical details
        if 'pydantic.dev' in error_msg or 'pydantic_core' in error_msg:
            # Extract just the user-friendly part before the technical details
            lines = error_msg.split('\n')
            clean_errors = []
            for line in lines:
                if 'https://' not in line and 'pydantic' not in line.lower():
                    if line.strip() and not line.strip().startswith('['):
                        clean_errors.append(line.strip())
            if clean_errors:
                return {'error': clean_errors[0] if len(clean_errors) == 1 else '; '.join(clean_errors[:3])}, 400
        return {'error': 'Invalid request data'}, 400

    # Routes
    @app.route('/')
    def index():
        # Serve modular HTML
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/login')
    def login_page():
        return send_from_directory(app.static_folder, 'login.html')

    @app.route('/account-recovery')
    def account_recovery_page():
        return send_from_directory(app.static_folder, 'account-recovery.html')

    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200

    @app.route('/api/version')
    def version():
        """Get application version information."""
        return jsonify({
            'version': __version__,
            'release_date': __release_date__,
            'release_notes': __release_notes__
        }), 200

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5137, debug=True)
