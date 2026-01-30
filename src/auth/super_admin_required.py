"""Super admin decorator - for main admin account only."""

from functools import wraps
from flask import jsonify
from flask_login import current_user


def super_admin_required(f):
    """
    Decorator that restricts access to super admin accounts only.

    Super admins have is_super_admin flag set to True.
    This is used for highly sensitive operations like viewing feedback content.
    Super admins can grant/revoke super admin status to other admins.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "Authentication required"}), 401

        # Check if user has super admin flag
        if (
            not hasattr(current_user, "is_super_admin")
            or not current_user.is_super_admin
        ):
            return jsonify({"error": "Super admin privileges required"}), 403

        return f(*args, **kwargs)

    return decorated_function
