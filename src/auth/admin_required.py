"""Admin authorization decorator."""

from functools import wraps
from flask import jsonify
from flask_login import current_user
from src.services.enhanced_audit_logger import enhanced_audit_logger


def admin_required(f):
    """
    Decorator to require admin privileges for a route.

    Usage:
        @app.route('/admin/users')
        @login_required
        @admin_required
        def admin_users():
            ...
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated
        if not current_user.is_authenticated:
            enhanced_audit_logger.log(
                action="ADMIN_ACCESS_DENIED",
                table_name="admin",
                details={"reason": "Not authenticated"},
                status_code=401,
            )
            return jsonify({"error": "Authentication required"}), 401

        # Check if user is admin
        if not current_user.is_admin:
            enhanced_audit_logger.log(
                action="ADMIN_ACCESS_DENIED",
                table_name="admin",
                user_id=current_user.id,
                details={"reason": "Not admin", "attempted_endpoint": str(f.__name__)},
                status_code=403,
            )
            return jsonify({"error": "Admin privileges required"}), 403

        # Log successful admin access
        enhanced_audit_logger.log(
            action="ADMIN_ACCESS",
            table_name="admin",
            user_id=current_user.id,
            details={"endpoint": str(f.__name__)},
            status_code=200,
        )

        return f(*args, **kwargs)

    return decorated_function
