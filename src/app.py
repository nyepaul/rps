"""Flask application factory.

Authored by: pan
"""
from flask import Flask, send_from_directory, jsonify, request
from flask_login import current_user
from src.config import config
from src.extensions import init_extensions
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
from src.__version__ import __version__, __release_date__, __release_notes__
from src.services.enhanced_audit_logger import EnhancedAuditLogger
import os
import logging
from logging.handlers import RotatingFileHandler


def create_app(config_name='development'):
    """Create and configure Flask application."""
    app = Flask(__name__, static_folder='static', static_url_path='')

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    init_extensions(app)

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

        # Log the network access
        EnhancedAuditLogger.log(
            action='NETWORK_ACCESS',
            table_name=None,
            record_id=None,
            user_id=user_id,
            details=None,
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
            "img-src 'self' data: https://*.tile.openstreetmap.org",
            "font-src 'self' data:",
            "connect-src 'self' https://*.tile.openstreetmap.org",
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
