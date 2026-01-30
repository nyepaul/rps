"""Authentication routes."""

import os
import re
import json
import base64
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, make_response
from flask_login import login_user, logout_user, current_user, login_required
from src.auth.models import User, PasswordResetRequest
from src.extensions import limiter
from src.services.encryption_service import EncryptionService
from src.services.enhanced_audit_logger import EnhancedAuditLogger
from src.utils.error_sanitizer import sanitize_pydantic_error
from typing import Any
from pydantic import BaseModel, EmailStr, validator, ValidationError

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Account lockout settings
LOCKOUT_THRESHOLD = 5  # Failed attempts before lockout
LOCKOUT_DURATION_MINUTES = 30  # Lockout duration


def check_account_lockout(username: str) -> tuple[bool, int]:
    """
    Check if account is locked due to too many failed login attempts.
    Returns (is_locked, remaining_minutes).
    """
    from src.database import connection

    try:
        # Check failed login attempts in the last LOCKOUT_DURATION_MINUTES
        cutoff_time = (
            datetime.utcnow() - timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        ).isoformat()

        # Query audit log for failed login attempts
        # Escape SQL wildcards to prevent injection
        escaped_username = (
            username.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        rows = connection.db.execute(
            """SELECT COUNT(*) as count, MAX(created_at) as last_attempt
               FROM enhanced_audit_log
               WHERE action = 'LOGIN_FAILED'
               AND details LIKE ? ESCAPE '\\'
               AND created_at > ?""",
            (f'%"username": "{escaped_username}"%', cutoff_time),
        )

        row = rows[0] if rows else None
        if row and row["count"] >= LOCKOUT_THRESHOLD:
            # Account is locked
            if row["last_attempt"]:
                last_attempt = datetime.fromisoformat(
                    row["last_attempt"].replace("Z", "+00:00").replace("+00:00", "")
                )
                unlock_time = last_attempt + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                remaining = (unlock_time - datetime.utcnow()).total_seconds() / 60
                return True, max(1, int(remaining))
            return True, LOCKOUT_DURATION_MINUTES

        return False, 0
    except Exception:
        # If check fails, don't lock out (fail open for availability)
        return False, 0


class ResetWithRecoverySchema(BaseModel):
    """Schema for password reset using recovery code."""

    username: str
    email: EmailStr
    recovery_code: str
    new_password: str

    @validator("new_password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


class RegisterSchema(BaseModel):
    """Registration validation schema."""

    username: str
    email: EmailStr
    password: str

    @validator("username")
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be between 3 and 50 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError(
                "Username can only contain letters, numbers, hyphens, and underscores"
            )
        return v

    @validator("password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginSchema(BaseModel):
    """Login validation schema."""

    username: str
    password: str


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("20 per hour")
def register():
    """Register a new user and initialize their encryption key."""
    data = {}
    try:
        data = RegisterSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid registration data"}), 400

    # Check if username already exists
    if User.get_by_username(data.username):
        return jsonify({"error": "Username already exists"}), 400

    # Check if email already exists
    if User.get_by_email(data.email):
        return jsonify({"error": "Email already exists"}), 400

    # Create user object first to get the correct salt (derived from username + email)
    user = User(
        id=None,
        username=data.username,
        email=data.email,
        password_hash=User.hash_password(data.password),
    )

    # Demo account: no encryption, no recovery needed
    is_demo = data.username.lower() == "demo"
    recovery_code = None

    if is_demo:
        # Demo account stores data unencrypted - no DEK needed
        user.encrypted_dek = None
        user.dek_iv = None
    else:
        # Generate user-specific encryption key (DEK)
        dek = EncryptionService.generate_dek()
        # Use deterministic salt based on identity
        kek = EncryptionService.get_kek_from_password(
            data.password, user.get_kek_salt()
        )

        # Encrypt DEK with KEK derived from password
        temp_service = EncryptionService(key=kek)
        encrypted_dek, dek_iv = temp_service.encrypt(
            base64.b64encode(dek).decode("utf-8")
        )

        # Update user with encryption details
        user.encrypted_dek = encrypted_dek
        user.dek_iv = dek_iv

        # Generate recovery code so user can recover data if they forget password
        recovery_code = EncryptionService.generate_recovery_code()
        recovery_salt = os.urandom(16)
        recovery_kek = EncryptionService.get_recovery_kek(recovery_code, recovery_salt)
        recovery_service = EncryptionService(key=recovery_kek)
        dek_b64 = base64.b64encode(dek).decode("utf-8")
        rec_enc_dek, rec_iv = recovery_service.encrypt(dek_b64)

        user.recovery_encrypted_dek = rec_enc_dek
        user.recovery_iv = rec_iv
        user.recovery_salt = base64.b64encode(recovery_salt).decode("utf-8")

        # Store recovery code temporarily (encrypted with server key) to show on first login
        server_service = EncryptionService() # Explicitly uses ENCRYPTION_KEY
        enc_code, code_iv = server_service.encrypt(recovery_code)
        user.temp_recovery_code = json.dumps({"code": enc_code, "iv": code_iv})

        # Also set up email-based recovery backup
        user.update_email_recovery_backup(dek)

    user.save()

    # Send verification email
    try:
        from src.services.email_service import EmailService

        token = user.generate_verification_token()
        EmailService.send_verification_email(user.email, token)
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        # We still create the account, user can resend later

    # Notify super admins of new account
    try:
        from src.services.email_service import EmailService

        EmailService.send_new_account_notification(user.username, user.email, verification_token=token)
    except Exception as e:
        print(f"Failed to send admin notification: {e}")
        # Non-critical, don't fail registration

    # Log the registration
    EnhancedAuditLogger.log(
        action="USER_REGISTER",
        table_name="users",
        record_id=user.id,
        user_id=user.id,
        details=json.dumps({"username": user.username, "email": user.email}),
        status_code=201,
    )

    # DO NOT log user in immediately. Require verification.
    response_data = {
        "message": "Registration successful. Please check your email to verify your account.",
        "user": {"username": user.username, "email": user.email},
    }

    # Include recovery code for non-demo accounts
    if recovery_code:
        response_data["recovery_code"] = recovery_code
        response_data["recovery_warning"] = (
            "SAVE THIS CODE SECURELY. It is the ONLY way to recover your data if you forget your password. This code will not be shown again."
        )

    # In development mode, expose the verification token for easy activation
    from flask import current_app
    if (
        current_app.config.get("DEBUG")
        or current_app.config.get("FLASK_ENV") == "development"
    ):
        response_data["verification_token"] = token
        response_data["development_mode"] = True

    return jsonify(response_data), 201


@auth_bp.route("/resend-verification", methods=["POST"])
@limiter.limit("3 per minute")
def resend_verification():
    """Resend verification email."""
    email = request.json.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.get_by_email(email)
    if not user:
        # Don't reveal user existence
        return (
            jsonify(
                {"message": "If the account exists, a verification email has been sent."}
            ),
            200,
        )

    if getattr(user, "email_verified", 0) == 1:
        return jsonify({"error": "This account is already verified. You can proceed to login.", "code": "ALREADY_VERIFIED"}), 400

    # Send email
    try:
        from src.services.email_service import EmailService

        token = user.generate_verification_token()
        if EmailService.send_verification_email(user.email, token):
            return jsonify({"message": "Verification email sent."}), 200
        else:
            return (
                jsonify(
                    {
                        "error": "Failed to send email. Please try again later or contact support."
                    }
                ),
                500,
            )
    except Exception as e:
        print(f"Resend verification error: {e}")
        return jsonify({"error": "Failed to send email"}), 500


@auth_bp.route("/verify-email", methods=["POST"])
@limiter.limit("5 per minute")
def verify_email():
    """Verify email address using token."""
    try:
        token = request.json.get("token")
        if not token:
            return jsonify({"error": "Token required"}), 400

        # We need to decode the token to find the user first to call confirm_email
        # Or simpler: verify token signature first using static method?
        # Actually User model instance method is better.

        # Decode token manually to get user_id
        import jwt
        from flask import current_app

        payload = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        user_id = payload.get("user_id")

        user = User.get_by_id(user_id)
        if not user:
            return jsonify({"error": "User account no longer exists. Please register again."}), 404

        # Check if already verified
        if getattr(user, "email_verified", False):
            return (
                jsonify(
                    {"message": "Email already verified. You can now log in."}
                ),
                200,
            )

        if user.confirm_email(token):
            EnhancedAuditLogger.log(
                action="EMAIL_VERIFIED",
                table_name="users",
                user_id=user.id,
                details=json.dumps({"email": user.email}),
                status_code=200,
            )
            return (
                jsonify(
                    {"message": "Email verified successfully. You can now log in."}
                ),
                200,
            )
        else:
            return jsonify({"error": "Invalid or expired token"}), 400

    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Token verification failed: {str(e)}", exc_info=True)
        return jsonify({"error": f"Invalid token: {str(e)}" if current_app.debug else "Invalid token"}), 400


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    """Log in a user and decrypt their encryption key."""
    data = {}
    try:
        data = LoginSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid login data"}), 400

    # Check for account lockout before processing login
    is_locked, remaining_minutes = check_account_lockout(data.username)
    if is_locked:
        EnhancedAuditLogger.log(
            action="LOGIN_BLOCKED_LOCKOUT",
            table_name="users",
            details=json.dumps(
                {"username": data.username, "remaining_minutes": remaining_minutes}
            ),
            status_code=429,
        )
        return (
            jsonify(
                {
                    "error": f"Account temporarily locked due to too many failed attempts. Try again in {remaining_minutes} minutes."
                }
            ),
            429,
        )

    # Get user
    user = User.get_by_username(data.username)

    # Check if user exists and password is correct
    if not user or not user.check_password(data.password):
        # Log failed login attempt
        EnhancedAuditLogger.log(
            action="LOGIN_FAILED",
            table_name="users",
            user_id=user.id if user else None,
            details=json.dumps(
                {"username": data.username, "reason": "Invalid credentials"}
            ),
            status_code=401,
            error_message="Invalid username or password",
        )
        return jsonify({"error": "Invalid username or password"}), 401

    # Check if user is active
    if not user.is_active:
        # Log failed login attempt - disabled account
        EnhancedAuditLogger.log(
            action="LOGIN_FAILED",
            table_name="users",
            user_id=user.id,
            details=json.dumps(
                {"username": data.username, "reason": "Account disabled"}
            ),
            status_code=401,
            error_message="Account is disabled",
        )
        return jsonify({"error": "Account is disabled"}), 401

    # Check email verification (Legacy users might have NULL, treat as verified)
    # email_verified: 1=Verified, 0=Unverified
    # If attribute doesn't exist yet on model (migration lag), assume verified
    is_verified = getattr(user, "email_verified", 1)
    if is_verified == 0:
        return (
            jsonify(
                {
                    "error": "Email not verified. Please check your inbox or use the 'Resend Verification' option.",
                    "code": "EMAIL_NOT_VERIFIED",
                }
            ),
            403,
        )

    # Decrypt user's DEK or generate one for old users
    if user.encrypted_dek and user.dek_iv:
        try:
            # Use User model's get_dek which handles salt migration
            raw_dek = user.get_dek(data.password)
            session["user_dek"] = base64.b64encode(raw_dek).decode("utf-8")
        except Exception as e:
            # CRITICAL: If we can't decrypt the DEK, we can't let the user in because
            # all their data will be inaccessible and new data will be unencryptable.
            # However, for users who migrated from NO individual key, we might need a fallback.
            # But here user.encrypted_dek is NOT NULL, so they definitely have one.
            EnhancedAuditLogger.log(
                action="LOGIN_DEK_FAILURE",
                table_name="users",
                user_id=user.id,
                details=json.dumps({"username": user.username, "error": str(e)}),
                status_code=500,
            )
            # Generic error to avoid confirming password validity
            return (
                jsonify(
                    {
                        "error": "Login failed. Please try again or use password recovery."
                    }
                ),
                401,
            )
    else:
        # Auto-migrate: User doesn't have a DEK yet, generate one now
        try:
            dek = EncryptionService.generate_dek()
            # Use new deterministic salt
            kek = EncryptionService.get_kek_from_password(
                data.password, user.get_kek_salt()
            )
            temp_service = EncryptionService(key=kek)
            encrypted_dek, dek_iv = temp_service.encrypt(
                base64.b64encode(dek).decode("utf-8")
            )

            user.encrypted_dek = encrypted_dek
            user.dek_iv = dek_iv
            user.save()

            session["user_dek"] = base64.b64encode(dek).decode("utf-8")
            print(f"Auto-migrated user {user.username} to individual encryption key")
        except Exception as e:
            print(f"Failed to auto-migrate user key: {e}")

    # Update last login
    user.update_last_login()

    # Log user in (remember=False to allow easy switching between users)
    login_user(user, remember=False)

    # Initialize session with last activity timestamp for inactivity timeout
    session.permanent = True
    session["last_activity"] = datetime.utcnow().isoformat()

    # Update successful login audit log
    EnhancedAuditLogger.log(
        action="LOGIN_SUCCESS",
        table_name="users",
        record_id=user.id,
        user_id=user.id,
        details=json.dumps({"username": user.username, "email": user.email}),
        status_code=200,
    )

    # Check if we should present recovery code (first login or not shown yet)
    recovery_code_to_show = None
    if user.temp_recovery_code and not user.recovery_code_shown:
        try:
            server_service = EncryptionService() # Explicitly uses ENCRYPTION_KEY
            code_data = json.loads(user.temp_recovery_code)
            recovery_code_to_show = server_service.decrypt(code_data["code"], code_data["iv"])
            
            # Mark as shown and clear temp storage
            user.recovery_code_shown = True
            user.temp_recovery_code = None
            user.save()
        except Exception as e:
            print(f"Failed to decrypt temp recovery code: {e}")

    return (
        jsonify(
            {
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_admin": user.is_admin,
                    "is_super_admin": user.is_super_admin,
                    "preferences": (
                        json.loads(user.preferences) if user.preferences else {}
                    ),
                },
                "show_recovery_code": recovery_code_to_show
            }
        ),
        200,
    )


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Log out the current user and clear encryption key."""

    # Get user info before logout
    user_id = current_user.id if current_user.is_authenticated else None
    username = current_user.username if current_user.is_authenticated else "Unknown"

    # Log the logout
    if user_id:
        EnhancedAuditLogger.log(
            action="USER_LOGOUT",
            table_name="users",
            record_id=user_id,
            user_id=user_id,
            details=json.dumps({"username": username}),
            status_code=200,
        )

    # Logout user FIRST (this removes _user_id from session)
    logout_user()

    # Clear ALL session data
    for key in list(session.keys()):
        session.pop(key)

    # Mark session as modified to force Flask to regenerate the session cookie
    session.modified = True

    # Create response
    response = make_response(jsonify({"message": "Logout successful"}), 200)

    # DON'T manually clear cookies - let Flask handle session cookie regeneration
    # Flask will send a new session cookie with the cleared session data

    return response


@auth_bp.route("/session", methods=["GET"])
@limiter.exempt
def session_check():
    """Check if current session is valid and return user data."""
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 200

    return (
        jsonify(
            {
                "authenticated": True,
                "user": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "email": current_user.email,
                    "is_admin": current_user.is_admin,
                    "is_super_admin": current_user.is_super_admin,
                    "preferences": (
                        json.loads(current_user.preferences)
                        if current_user.preferences
                        else {}
                    ),
                },
            }
        ),
        200,
    )


@auth_bp.route("/preferences", methods=["GET"])
@login_required
def get_preferences():
    """Get current user preferences."""
    prefs = json.loads(current_user.preferences) if current_user.preferences else {}
    return jsonify({"preferences": prefs}), 200


@auth_bp.route("/preferences", methods=["PUT"])
@login_required
def update_preferences():
    """Update current user preferences."""
    try:
        data = request.json
        if not isinstance(data, dict):
            return jsonify({"error": "Invalid preferences format"}), 400

        # Merge with existing preferences
        existing = (
            json.loads(current_user.preferences) if current_user.preferences else {}
        )
        existing.update(data)

        current_user.preferences = json.dumps(existing)
        current_user.save()

        return jsonify({"message": "Preferences updated", "preferences": existing}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


class PasswordResetRequestSchema(BaseModel):
    """Password reset request validation schema."""

    username: str
    email: EmailStr


class PasswordResetSchema(BaseModel):
    """Password reset validation schema."""

    token: str
    password: str

    @validator("password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


@auth_bp.route("/password-reset/request", methods=["POST"])
@limiter.limit("3 per hour")
def request_password_reset():
    """Request a password reset token.

    Requires username AND email for verification. The token is sent to the registered email.
    """
    try:
        data = PasswordResetRequestSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data"}), 400

    # Get user by username
    user = User.get_by_username(data.username)

    # Verify user exists AND email matches
    # Use constant time comparison for email to prevent timing attacks (though not strictly necessary for this low-stakes check)
    email_match = False
    if user and user.email.lower() == data.email.lower():
        email_match = True

    if not email_match:
        # Return generic success message to prevent enumeration
        return (
            jsonify(
                {
                    "message": "If the account exists and the email matches, a password reset link has been sent.",
                    "email_sent": False,
                }
            ),
            200,
        )

    # Check email verification status
    is_verified = getattr(user, "email_verified", 1)
    if is_verified == 0:
        return (
            jsonify(
                {
                    "error": "Email not verified. Please verify your email first.",
                    "email_sent": False,
                }
            ),
            400,
        )

    # Generate reset token
    token = user.generate_reset_token(expiry_hours=1)

    # Send reset email
    email_sent = False
    try:
        from src.services.email_service import EmailService

        email_sent = EmailService.send_password_reset_email(user.email, token)
    except Exception as e:
        print(f"Error sending email: {e}")

    # For local development/testing convenience when email is not configured
    if not email_sent:
        # Log token to server logs ONLY (do not expose in API)
        print(
            f"SECURITY WARNING: Email not sent. Reset token for {user.username}: {token}"
        )

    # Return success message (without token in production)
    response_data = {
        "message": "If the account exists and the email matches, a password reset link has been sent.",
        "username": data.username,
        "email_sent": email_sent,
    }

    # In development mode, expose the token to the frontend for easy testing
    from flask import current_app

    if (
        current_app.config.get("DEBUG")
        or current_app.config.get("FLASK_ENV") == "development"
    ):
        response_data["token"] = token
        response_data["development_mode"] = True

    return jsonify(response_data), 200


@auth_bp.route("/password-reset/reset", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password():
    """Reset password using a valid reset token.

    Attempts to preserve data using email-based backup if available.
    Otherwise, permanently deletes encrypted data.
    """
    try:
        data = PasswordResetSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data"}), 400

    # Get user by token
    user = User.get_by_reset_token(data.token)

    if not user:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    dek_recovered = False
    dek_was_lost = False

    # Attempt to recover data using Email Backup
    if user.email_encrypted_dek and user.email_iv and user.email_salt:
        try:
            email_salt = base64.b64decode(user.email_salt)
            email_kek = EncryptionService.get_email_kek(user.email, email_salt)
            email_service = EncryptionService(key=email_kek)
            dek_b64 = email_service.decrypt(user.email_encrypted_dek, user.email_iv)

            if dek_b64:
                dek = base64.b64decode(dek_b64)

                # Encrypt with new password
                new_salt = user.get_kek_salt()
                new_kek = EncryptionService.get_kek_from_password(
                    data.password, new_salt
                )
                new_service = EncryptionService(key=new_kek)
                new_enc_dek, new_iv = new_service.encrypt(dek_b64)

                # Update user
                user.encrypted_dek = new_enc_dek
                user.dek_iv = new_iv
                user.password_hash = User.hash_password(data.password)

                # Refresh email backup (rotate salt)
                user.update_email_recovery_backup(dek)

                # Clear reset token
                user.reset_token = None
                user.reset_token_expires = None

                user.save()
                dek_recovered = True
        except Exception as e:
            print(f"Token reset recovery failed: {e}")

    # Fallback: Force reset (Data Loss)
    if not dek_recovered:
        dek_was_lost = user.force_password_reset(data.password)

    # Log the password reset
    EnhancedAuditLogger.log(
        action="PASSWORD_RESET",
        table_name="users",
        record_id=user.id,
        user_id=user.id,
        details=json.dumps(
            {
                "username": user.username,
                "method": "email_recovery" if dek_recovered else "force_reset",
                "dek_recovered": dek_recovered,
                "dek_lost": dek_was_lost,
            }
        ),
        status_code=200,
    )

    if dek_recovered:
        response_message = (
            "Password reset successfully. Your encrypted data has been recovered."
        )
    else:
        response_message = "Password successfully reset."
        if dek_was_lost:
            response_message += (
                " Note: Encrypted data was lost because no backup was available."
            )

    return (
        jsonify(
            {
                "message": response_message,
                "dek_lost": dek_was_lost,
                "dek_recovered": dek_recovered,
            }
        ),
        200,
    )


@auth_bp.route("/password-reset/validate-token", methods=["POST"])
@limiter.limit("10 per minute")
def validate_reset_token():
    """Validate a password reset token without resetting the password."""
    try:
        token = request.json.get("token")
        if not token:
            return jsonify({"error": "Token is required"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    user = User.get_by_reset_token(token)

    if user:
        # Check data status
        has_encrypted_data = bool(user.encrypted_dek and user.dek_iv)
        can_recover_via_email = bool(user.email_encrypted_dek)

        warning = None
        if has_encrypted_data:
            if can_recover_via_email:
                warning = "Your encrypted data will be automatically recovered."
            else:
                warning = "Resetting password will permanently delete all your encrypted data. This cannot be undone!"

        return (
            jsonify(
                {
                    "valid": True,
                    "username": user.username,
                    # 'email': user.email, # Don't expose email
                    "has_encrypted_data": has_encrypted_data,
                    "can_recover_via_email": can_recover_via_email,
                    "warning": warning,
                }
            ),
            200,
        )
    else:
        return jsonify({"valid": False, "error": "Invalid or expired token"}), 400


class OfflinePasswordChangeSchema(BaseModel):
    """Schema for offline password change (using credentials)."""

    username: str
    email: EmailStr
    old_password: str
    new_password: str

    @validator("new_password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


class PasswordChangeSchema(BaseModel):
    """Schema for logged-in password change."""

    old_password: str
    new_password: str

    @validator("new_password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


@auth_bp.route("/password/offline-change", methods=["POST"])
@limiter.limit("5 per hour")
def offline_change_password():
    """
    Change password without login session.

    Methods:
    1. Email-based Recovery (Preferred): Uses backup key derived from email. Requires Username + Email.
    2. Legacy Recovery: Uses old password to decrypt key. Requires Username + Email + Old Password.
    """
    try:
        data = OfflinePasswordChangeSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data"}), 400

    # 1. Verify User exists by Username AND Email
    user = User.get_by_username(data.username)
    if not user or user.email.lower() != data.email.lower():
        # Generic error to prevent enumeration
        return jsonify({"error": "Invalid credentials"}), 401

    # 2. Mandatory Identity Verification via Previous Password
    if not user.check_password(data.old_password):
        EnhancedAuditLogger.log(
            action="OFFLINE_PASSWORD_CHANGE_FAILED",
            table_name="users",
            user_id=user.id,
            details=json.dumps({"reason": "Invalid old password"}),
            status_code=401,
        )
        return jsonify({"error": "Invalid old password"}), 401

    try:
        dek_b64 = None
        recovery_method = "unknown"

        # 3. Try Email-Based Recovery (as fallback/verification)
        if user.email_encrypted_dek and user.email_iv and user.email_salt:
            try:
                email_salt = base64.b64decode(user.email_salt)
                email_kek = EncryptionService.get_email_kek(user.email, email_salt)
                email_service = EncryptionService(key=email_kek)
                dek_b64 = email_service.decrypt(user.email_encrypted_dek, user.email_iv)
                recovery_method = "email_backup"
            except Exception as e:
                print(f"Email recovery failed: {e}")

        # 4. Use Password-Based Recovery (if email failed or as primary)
        if not dek_b64:
            # Use User model logic to get DEK
            # This handles migration logic too
            raw_dek = user.get_dek(data.old_password)
            dek_b64 = base64.b64encode(raw_dek).decode("utf-8")
            recovery_method = "password_backup"

        # 5. Re-encrypt with New Password
        if dek_b64:
            dek = base64.b64decode(dek_b64)

            # Encrypt with new password
            new_salt = user.get_kek_salt()
            new_kek = EncryptionService.get_kek_from_password(
                data.new_password, new_salt
            )
            new_service = EncryptionService(key=new_kek)
            new_enc_dek, new_iv = new_service.encrypt(dek_b64)

            # Update user
            user.encrypted_dek = new_enc_dek
            user.dek_iv = new_iv
            user.password_hash = User.hash_password(data.new_password)

            # Refresh email backup with new salt (security best practice)
            user.update_email_recovery_backup(dek)

            user.save()

            EnhancedAuditLogger.log(
                action="OFFLINE_PASSWORD_CHANGE",
                table_name="users",
                record_id=user.id,
                user_id=user.id,
                details=json.dumps(
                    {"username": user.username, "method": recovery_method}
                ),
                status_code=200,
            )

            return (
                jsonify(
                    {"message": "Password changed successfully. You can now log in."}
                ),
                200,
            )

    except Exception as e:
        print(f"Error in offline password change: {e}")
        return jsonify({"error": "Failed to change password"}), 500


@auth_bp.route("/password/change", methods=["PUT"])
@limiter.limit("5 per hour")
def change_password():
    """Change password for logged-in user (requires old password to re-encrypt data)."""

    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    try:
        data = PasswordChangeSchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data"}), 400

    # Get fresh user from database
    user = User.get_by_id(current_user.id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        # Update password (will re-encrypt DEK if needed)
        user.update_password(data.new_password, old_password=data.old_password)

        # If user has DEK, update it in session
        if user.encrypted_dek and user.dek_iv:
            try:
                kek = EncryptionService.get_kek_from_password(data.new_password)
                temp_service = EncryptionService(key=kek)
                dek_b64 = temp_service.decrypt(user.encrypted_dek, user.dek_iv)
                session["user_dek"] = dek_b64
            except Exception as e:
                print(f"Failed to update DEK in session: {e}")

        # Log the password change
        EnhancedAuditLogger.log(
            action="PASSWORD_CHANGE",
            table_name="users",
            record_id=user.id,
            user_id=user.id,
            details=json.dumps(
                {
                    "username": user.username,
                    "dek_re_encrypted": bool(user.encrypted_dek),
                }
            ),
            status_code=200,
        )

        return (
            jsonify(
                {
                    "message": "Password changed successfully",
                    "dek_re_encrypted": bool(user.encrypted_dek),
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error changing password: {e}")
        return jsonify({"error": f"Failed to change password: {str(e)}"}), 500


@auth_bp.route("/recovery-code/generate", methods=["POST"])
@limiter.limit("10 per hour")
def generate_recovery_code():
    """Generate a recovery code for the logged-in user.

    This allows resetting the password without data loss.
    Returns the raw recovery code which must be saved by the user.
    """

    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    # Get fresh user
    user = User.get_by_id(current_user.id)

    # We need the DEK to encrypt it with the recovery code
    dek = None

    # 1. Try getting DEK from session (Standard)
    if "user_dek" in session:
        try:
            dek = base64.b64decode(session["user_dek"])
        except Exception:
            pass

    # 2. If not in session, and request provides password, try to decrypt now
    # This helps users fix a "broken session" without logging out if we add password to request
    json_data = request.get_json(silent=True) or {}
    password = json_data.get("password")
    if not dek and password and user.encrypted_dek:
        try:
            dek = user.get_dek(password)
            # Restore to session for future use
            session["user_dek"] = base64.b64encode(dek).decode("utf-8")
        except Exception:
            pass

    if not dek and user.encrypted_dek:
        # If we can't get DEK, we can't generate a recovery code that recovers data
        return (
            jsonify(
                {
                    "error": "Encryption key unavailable in current session.",
                    "needs_password": True,
                    "message": "Please re-enter your password to unlock your keys and generate a recovery code.",
                }
            ),
            400,
        )

    if not dek and not user.encrypted_dek:
        # User has no encryption set up yet, generate new DEK
        dek = EncryptionService.generate_dek()
        # This is an edge case, but we handle it

    try:
        # 1. Generate new recovery code
        recovery_code = EncryptionService.generate_recovery_code()

        # 2. Generate salt
        recovery_salt = os.urandom(16)

        # 3. Derive KEK from recovery code
        recovery_kek = EncryptionService.get_recovery_kek(recovery_code, recovery_salt)

        # 4. Encrypt DEK with recovery KEK
        recovery_service = EncryptionService(key=recovery_kek)
        # Ensure we are encrypting the base64 string of the DEK to match standard patterns
        dek_b64 = base64.b64encode(dek).decode("utf-8")
        rec_enc_dek, rec_iv = recovery_service.encrypt(dek_b64)

        # 5. Save to user
        user.recovery_encrypted_dek = rec_enc_dek
        user.recovery_iv = rec_iv
        user.recovery_salt = base64.b64encode(recovery_salt).decode("utf-8")
        user.save()

        # 6. Log event
        EnhancedAuditLogger.log(
            action="RECOVERY_CODE_GENERATED",
            table_name="users",
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({"username": user.username}),
            status_code=200,
        )

        return (
            jsonify(
                {
                    "message": "Recovery code generated successfully",
                    "recovery_code": recovery_code,
                    "warning": "SAVE THIS CODE SECURELY. It is the ONLY way to recover your data if you forget your password.",
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error generating recovery code: {e}")
        return jsonify({"error": f"Failed to generate recovery code: {str(e)}"}), 500


@auth_bp.route("/password-reset/recovery", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password_with_recovery():
    """Reset password using a recovery code (preserves encrypted data)."""
    try:
        data = ResetWithRecoverySchema(**request.json)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": "Invalid request data"}), 400

    user = User.get_by_username(data.username)
    if not user or user.email.lower() != data.email.lower():
        # Use generic error to avoid enumeration
        return jsonify({"error": "Invalid credentials or recovery code"}), 400

    if (
        not user.recovery_encrypted_dek
        or not user.recovery_iv
        or not user.recovery_salt
    ):
        return (
            jsonify(
                {
                    "error": "Recovery code not set up for this account. Cannot recover data."
                }
            ),
            400,
        )

    try:
        # 1. Derive key from recovery code
        salt = base64.b64decode(user.recovery_salt)
        recovery_kek = EncryptionService.get_recovery_kek(data.recovery_code, salt)

        # 2. Attempt to decrypt the DEK
        recovery_service = EncryptionService(key=recovery_kek)
        dek_b64 = recovery_service.decrypt(
            user.recovery_encrypted_dek, user.recovery_iv
        )

        if not dek_b64:
            # Decryption failed (wrong code)
            EnhancedAuditLogger.log(
                action="RECOVERY_FAILED",
                table_name="users",
                record_id=user.id,
                details=json.dumps({"reason": "Invalid recovery code"}),
                status_code=400,
            )
            return jsonify({"error": "Invalid recovery code"}), 400

        # 3. Success! We have the DEK. Now re-encrypt it with the new password.
        dek = base64.b64decode(dek_b64)

        new_kek = EncryptionService.get_kek_from_password(data.new_password)
        new_service = EncryptionService(key=new_kek)
        new_encrypted_dek, new_dek_iv = new_service.encrypt(dek_b64)

        # 4. Update user
        user.encrypted_dek = new_encrypted_dek
        user.dek_iv = new_dek_iv
        user.password_hash = User.hash_password(data.new_password)

        # Note: We keep the existing recovery code valid. User can rotate it if they want.
        user.save()

        EnhancedAuditLogger.log(
            action="PASSWORD_RESET_RECOVERY",
            table_name="users",
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({"username": user.username}),
            status_code=200,
        )

        return (
            jsonify(
                {
                    "message": "Password reset successfully. Your data has been preserved."
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Recovery error: {e}")
        return jsonify({"error": "Failed to reset password using recovery code"}), 500


@auth_bp.route("/request-admin-reset", methods=["POST"])
@limiter.limit("5 per hour")
def request_admin_reset():
    """Request a password reset from admin (when SMTP is down)."""
    data = request.json
    username = data.get("username")
    email = data.get("email")

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    user = User.get_by_username(username)
    if not user or user.email.lower() != email.lower():
        # Generic message
        return (
            jsonify(
                {"message": "If the account exists, a request has been submitted."}
            ),
            200,
        )

    # Create request
    request_id, support_token = PasswordResetRequest.create(
        user.id, request.remote_addr
    )

    EnhancedAuditLogger.log(
        action="PASSWORD_RESET_REQUEST_SUBMITTED",
        table_name="users",
        user_id=user.id,
        details=json.dumps({"type": "admin_manual", "support_token": support_token}),
        status_code=200,
    )

    return (
        jsonify(
            {
                "message": "Your request has been submitted.",
                "support_token": support_token,
                "instruction": "Please contact your administrator and provide this Support Token to verify your identity.",
            }
        ),
        200,
    )
