"""Flask application factory."""
from flask import Flask, send_from_directory
from src.config import config
from src.extensions import init_extensions
from src.auth.routes import auth_bp
from src.routes.profiles import profiles_bp
from src.routes.analysis import analysis_bp
from src.routes.scenarios import scenarios_bp
from src.routes.action_items import action_items_bp
from src.routes.ai_services import ai_services_bp
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

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(profiles_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(scenarios_bp)
    app.register_blueprint(action_items_bp)
    app.register_blueprint(ai_services_bp)

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

    # Error handlers
    @app.errorhandler(500)
    def server_error(e):
        app.logger.error(f"Server Error: {e}", exc_info=True)
        return {'error': 'Internal server error'}, 500

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Not found'}, 404

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

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=8080, debug=True)
