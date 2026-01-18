"""Authentication routes."""
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user
from src.auth.models import User
from src.extensions import limiter
from src.services.enhanced_audit_logger import EnhancedAuditLogger
from pydantic import BaseModel, EmailStr, validator
import re
import json

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


class RegisterSchema(BaseModel):
    """Registration validation schema."""
    username: str
    email: EmailStr
    password: str

    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
        return v

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v


class LoginSchema(BaseModel):
    """Login validation schema."""
    username: str
    password: str


from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, current_user
from src.auth.models import User
from src.extensions import limiter
from src.services.encryption_service import EncryptionService
import base64

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    """Register a new user and initialize their encryption key."""
    try:
        data = RegisterSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Check if username already exists
    if User.get_by_username(data.username):
        return jsonify({'error': 'Username already exists'}), 400

    # Check if email already exists
    if User.get_by_email(data.email):
        return jsonify({'error': 'Email already exists'}), 400

    # Generate user-specific encryption key (DEK)
    dek = EncryptionService.generate_dek()
    kek = EncryptionService.get_kek_from_password(data.password)
    
    # Encrypt DEK with KEK derived from password
    temp_service = EncryptionService(key=kek)
    encrypted_dek, dek_iv = temp_service.encrypt(base64.b64encode(dek).decode('utf-8'))

    # Create user
    user = User(
        id=None,
        username=data.username,
        email=data.email,
        password_hash=User.hash_password(data.password),
        encrypted_dek=encrypted_dek,
        dek_iv=dek_iv
    )
    user.save()

    # Log the registration
    EnhancedAuditLogger.log(
        action='USER_REGISTER',
        table_name='users',
        record_id=user.id,
        user_id=user.id,
        details=json.dumps({
            'username': user.username,
            'email': user.email
        }),
        status_code=201
    )

    # Log user in
    login_user(user)

    # Store decrypted DEK in session (base64)
    session['user_dek'] = base64.b64encode(dek).decode('utf-8')

    return jsonify({
        'message': 'Registration successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'is_super_admin': user.is_super_admin
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Log in a user and decrypt their encryption key."""
    try:
        data = LoginSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Get user
    user = User.get_by_username(data.username)

    # Check if user exists and password is correct
    if not user or not user.check_password(data.password):
        # Log failed login attempt
        EnhancedAuditLogger.log(
            action='LOGIN_FAILED',
            table_name='users',
            user_id=user.id if user else None,
            details=json.dumps({
                'username': data.username,
                'reason': 'Invalid credentials'
            }),
            status_code=401,
            error_message='Invalid username or password'
        )
        return jsonify({'error': 'Invalid username or password'}), 401

    # Check if user is active
    if not user.is_active:
        # Log failed login attempt - disabled account
        EnhancedAuditLogger.log(
            action='LOGIN_FAILED',
            table_name='users',
            user_id=user.id,
            details=json.dumps({
                'username': data.username,
                'reason': 'Account disabled'
            }),
            status_code=401,
            error_message='Account is disabled'
        )
        return jsonify({'error': 'Account is disabled'}), 401

    # Decrypt user's DEK or generate one for old users
    if user.encrypted_dek and user.dek_iv:
        try:
            kek = EncryptionService.get_kek_from_password(data.password)
            temp_service = EncryptionService(key=kek)
            dek_b64 = temp_service.decrypt(user.encrypted_dek, user.dek_iv)
            session['user_dek'] = dek_b64
        except Exception as e:
            print(f"Failed to decrypt DEK: {e}")
    else:
        # Auto-migrate: User doesn't have a DEK yet, generate one now
        try:
            dek = EncryptionService.generate_dek()
            kek = EncryptionService.get_kek_from_password(data.password)
            temp_service = EncryptionService(key=kek)
            encrypted_dek, dek_iv = temp_service.encrypt(base64.b64encode(dek).decode('utf-8'))
            
            user.encrypted_dek = encrypted_dek
            user.dek_iv = dek_iv
            user.save()
            
            session['user_dek'] = base64.b64encode(dek).decode('utf-8')
            print(f"Auto-migrated user {user.username} to individual encryption key")
        except Exception as e:
            print(f"Failed to auto-migrate user key: {e}")

    # Update last login
    user.update_last_login()

    # Log user in (remember=False to allow easy switching between users)
    login_user(user, remember=False)

    # Log successful login
    EnhancedAuditLogger.log(
        action='LOGIN_SUCCESS',
        table_name='users',
        record_id=user.id,
        user_id=user.id,
        details=json.dumps({
            'username': user.username,
            'email': user.email
        }),
        status_code=200
    )

    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'is_super_admin': user.is_super_admin
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Log out the current user and clear encryption key."""
    from flask import make_response

    # Get user info before logout
    user_id = current_user.id if current_user.is_authenticated else None
    username = current_user.username if current_user.is_authenticated else 'Unknown'

    # Log the logout
    if user_id:
        EnhancedAuditLogger.log(
            action='USER_LOGOUT',
            table_name='users',
            record_id=user_id,
            user_id=user_id,
            details=json.dumps({
                'username': username
            }),
            status_code=200
        )

    # Clear session data
    session.pop('user_dek', None)
    session.clear()

    # Logout user (clears Flask-Login session and remember me cookie)
    logout_user()

    # Create response and explicitly clear remember me cookie
    response = make_response(jsonify({'message': 'Logout successful'}), 200)
    response.set_cookie('remember_token', '', expires=0, path='/')
    response.set_cookie('session', '', expires=0, path='/')

    return response


@auth_bp.route('/session', methods=['GET'])
def check_session():
    """Check if user is authenticated."""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'is_admin': current_user.is_admin,
                'is_super_admin': current_user.is_super_admin
            }
        }), 200
    return jsonify({'authenticated': False}), 200


class PasswordResetRequestSchema(BaseModel):
    """Password reset request validation schema."""
    email: EmailStr


class PasswordResetSchema(BaseModel):
    """Password reset validation schema."""
    token: str
    password: str

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v


@auth_bp.route('/password-reset/request', methods=['POST'])
@limiter.limit("3 per hour")
def request_password_reset():
    """Request a password reset token.

    NOTE: Email sending is not configured yet. In development, the token
    is returned in the response. In production, this should send an email.
    """
    try:
        data = PasswordResetRequestSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Get user by email
    user = User.get_by_email(data.email)

    # For security, always return success even if user doesn't exist
    # This prevents email enumeration attacks
    if not user:
        return jsonify({
            'message': 'If an account exists with that email, a password reset link has been sent.',
            'development_mode': True,
            'token': None
        }), 200

    # Generate reset token
    token = user.generate_reset_token(expiry_hours=1)

    # TODO: Send email with reset link
    # For now, return token in response (DEVELOPMENT MODE ONLY)
    # In production, this should send an email and NOT return the token

    return jsonify({
        'message': 'If an account exists with that email, a password reset link has been sent.',
        'development_mode': True,
        'token': token,
        'email': data.email,
        'note': 'Email not configured. Use this token to reset password. Token expires in 1 hour.'
    }), 200


@auth_bp.route('/password-reset/reset', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password():
    """Reset password using a valid reset token.

    ⚠️ WARNING: Password reset without old password will permanently delete
    encrypted data for users with password-based encryption enabled.
    """
    try:
        data = PasswordResetSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Get user by token
    user = User.get_by_reset_token(data.token)

    if not user:
        return jsonify({'error': 'Invalid or expired reset token'}), 400

    # Force password reset (will lose encrypted data if user had DEK)
    dek_was_lost = user.force_password_reset(data.password)

    # Log the password reset
    EnhancedAuditLogger.log(
        action='PASSWORD_RESET',
        table_name='users',
        record_id=user.id,
        user_id=user.id,
        details=json.dumps({
            'username': user.username,
            'dek_lost': dek_was_lost
        }),
        status_code=200
    )

    response_message = 'Password successfully reset. You can now log in with your new password.'
    if dek_was_lost:
        response_message += ' Note: Encrypted data was lost because old password was not available.'

    return jsonify({
        'message': response_message,
        'dek_lost': dek_was_lost
    }), 200


@auth_bp.route('/password-reset/validate-token', methods=['POST'])
@limiter.limit("10 per minute")
def validate_reset_token():
    """Validate a password reset token without resetting the password."""
    try:
        token = request.json.get('token')
        if not token:
            return jsonify({'error': 'Token is required'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    user = User.get_by_reset_token(token)

    if user:
        # Check if user will lose data
        has_encrypted_data = bool(user.encrypted_dek and user.dek_iv)

        return jsonify({
            'valid': True,
            'email': user.email,
            'has_encrypted_data': has_encrypted_data,
            'warning': 'Resetting password will permanently delete all your encrypted data. This cannot be undone!' if has_encrypted_data else None
        }), 200
    else:
        return jsonify({
            'valid': False,
            'error': 'Invalid or expired token'
        }), 400


class PasswordChangeSchema(BaseModel):
    """Password change validation schema (requires old password)."""
    old_password: str
    new_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v


@auth_bp.route('/password/change', methods=['PUT'])
@limiter.limit("5 per hour")
def change_password():
    """Change password for logged-in user (requires old password to re-encrypt data)."""
    from flask_login import login_required

    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401

    try:
        data = PasswordChangeSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Get fresh user from database
    user = User.get_by_id(current_user.id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    try:
        # Update password (will re-encrypt DEK if needed)
        user.update_password(data.new_password, old_password=data.old_password)

        # If user has DEK, update it in session
        if user.encrypted_dek and user.dek_iv:
            try:
                kek = EncryptionService.get_kek_from_password(data.new_password)
                temp_service = EncryptionService(key=kek)
                dek_b64 = temp_service.decrypt(user.encrypted_dek, user.dek_iv)
                session['user_dek'] = dek_b64
            except Exception as e:
                print(f"Failed to update DEK in session: {e}")

        # Log the password change
        EnhancedAuditLogger.log(
            action='PASSWORD_CHANGE',
            table_name='users',
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({
                'username': user.username,
                'dek_re_encrypted': bool(user.encrypted_dek)
            }),
            status_code=200
        )

        return jsonify({
            'message': 'Password changed successfully',
            'dek_re_encrypted': bool(user.encrypted_dek)
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Error changing password: {e}")
        return jsonify({'error': f'Failed to change password: {str(e)}'}), 500
