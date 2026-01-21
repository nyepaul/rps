"""Authentication routes."""
import os
import re
import json
import base64
from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, current_user
from src.auth.models import User
from src.extensions import limiter
from src.services.encryption_service import EncryptionService
from src.services.enhanced_audit_logger import EnhancedAuditLogger
from src.utils.error_sanitizer import sanitize_pydantic_error
from pydantic import BaseModel, EmailStr, validator, ValidationError

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

class ResetWithRecoverySchema(BaseModel):
    """Schema for password reset using recovery code."""
    username: str
    recovery_code: str
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
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid registration data'}), 400

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
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid login data'}), 400

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

    # Logout user FIRST (this removes _user_id from session)
    logout_user()

    # Clear ALL session data
    for key in list(session.keys()):
        session.pop(key)

    # Mark session as modified to force Flask to regenerate the session cookie
    session.modified = True

    # Create response
    response = make_response(jsonify({'message': 'Logout successful'}), 200)

    # DON'T manually clear cookies - let Flask handle session cookie regeneration
    # Flask will send a new session cookie with the cleared session data

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
    username: str


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

    Uses username lookup (no email required). The token is sent to the registered email.
    """
    try:
        data = PasswordResetRequestSchema(**request.json)
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid request data'}), 400

    # Get user by username
    user = User.get_by_username(data.username)

    # For security, always return success even if user doesn't exist
    # This prevents username enumeration attacks
    if not user:
        return jsonify({
            'message': 'If an account exists with that username, a password reset link has been sent to the registered email address.',
            'email_sent': False
        }), 200

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
        print(f"SECURITY WARNING: Email not sent. Reset token for {user.username}: {token}")

    # Return success message (without token)
    return jsonify({
        'message': 'If an account exists with that username, a password reset link has been sent to the registered email address.',
        'username': data.username,
        'email_sent': email_sent
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
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid request data'}), 400

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


class OfflinePasswordChangeSchema(BaseModel):
    """Schema for offline password change (using credentials)."""
    username: str
    email: EmailStr
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


@auth_bp.route('/password/offline-change', methods=['POST'])
@limiter.limit("5 per hour")
def offline_change_password():
    """
    Change password without login session using full credentials.
    
    This endpoint allows password rotation when email is unavailable or 
    login is not possible, but the user KNOWS their old credentials.
    It verifies username + email + old_password, then re-encrypts data
    with the new password.
    """
    try:
        data = OfflinePasswordChangeSchema(**request.json)
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid request data'}), 400

    # 1. Verify User exists by Username AND Email
    user = User.get_by_username(data.username)
    if not user or user.email.lower() != data.email.lower():
        # Generic error to prevent enumeration
        return jsonify({'error': 'Invalid credentials'}), 401
        
    # 2. Verify Old Password
    if not user.check_password(data.old_password):
        EnhancedAuditLogger.log(
            action='OFFLINE_PASSWORD_CHANGE_FAILED',
            table_name='users',
            user_id=user.id,
            details=json.dumps({'reason': 'Invalid old password'}),
            status_code=401
        )
        return jsonify({'error': 'Invalid credentials'}), 401
        
    try:
        # 3. Perform Password Update (handles DEK re-encryption & migration)
        # This will automatically migrate the key salt to (username+email) if it was legacy
        user.update_password(data.new_password, old_password=data.old_password)
        
        EnhancedAuditLogger.log(
            action='OFFLINE_PASSWORD_CHANGE',
            table_name='users',
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({
                'username': user.username,
                'method': 'offline_credentials'
            }),
            status_code=200
        )
        
        return jsonify({
            'message': 'Password changed successfully. You can now log in.'
        }), 200
        
    except ValueError as e:
        # Decryption failed (wrong old password for DEK?)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Error in offline password change: {e}")
        return jsonify({'error': 'Failed to change password'}), 500


@auth_bp.route('/password/change', methods=['PUT'])
@limiter.limit("5 per hour")
def change_password():
    """Change password for logged-in user (requires old password to re-encrypt data)."""
    from flask_login import login_required

    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401

    try:
        data = PasswordChangeSchema(**request.json)
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid request data'}), 400

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


@auth_bp.route('/recovery-code/generate', methods=['POST'])
@limiter.limit("3 per hour")
def generate_recovery_code():
    """Generate a recovery code for the logged-in user.
    
    This allows resetting the password without data loss.
    Returns the raw recovery code which must be saved by the user.
    """
    from flask_login import login_required
    
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Get fresh user
    user = User.get_by_id(current_user.id)
    
    # We need the DEK to encrypt it with the recovery code
    dek = None
    
    # Try getting DEK from session
    if 'user_dek' in session:
        try:
            dek = base64.b64decode(session['user_dek'])
        except:
            pass
            
    # If not in session, try to get it from DB if we have password in request (optional)
    if not dek and user.encrypted_dek:
        # If we can't get DEK, we can't generate a recovery code that recovers data
        return jsonify({'error': 'Could not access encryption keys. Please re-login.'}), 400
        
    if not dek and not user.encrypted_dek:
        # User has no encryption set up yet, generate new DEK
        dek = EncryptionService.generate_dek()
        # Note: This is an edge case where user has no DEK yet
    
    try:
        # 1. Generate new recovery code
        recovery_code = EncryptionService.generate_recovery_code()
        
        # 2. Generate salt
        recovery_salt = os.urandom(16)
        
        # 3. Derive KEK from recovery code
        recovery_kek = EncryptionService.get_recovery_kek(recovery_code, recovery_salt)
        
        # 4. Encrypt DEK with recovery KEK
        recovery_service = EncryptionService(key=recovery_kek)
        rec_enc_dek, rec_iv = recovery_service.encrypt(base64.b64encode(dek).decode('utf-8'))
        
        # 5. Save to user
        user.recovery_encrypted_dek = rec_enc_dek
        user.recovery_iv = rec_iv
        user.recovery_salt = base64.b64encode(recovery_salt).decode('utf-8')
        user.save()
        
        # 6. Log event
        EnhancedAuditLogger.log(
            action='RECOVERY_CODE_GENERATED',
            table_name='users',
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({'username': user.username}),
            status_code=200
        )
        
        return jsonify({
            'message': 'Recovery code generated successfully',
            'recovery_code': recovery_code,
            'warning': 'SAVE THIS CODE SECURELY. It is the ONLY way to recover your data if you forget your password.'
        }), 200
        
    except Exception as e:
        print(f"Error generating recovery code: {e}")
        return jsonify({'error': 'Failed to generate recovery code'}), 500


@auth_bp.route('/password-reset/recovery', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password_with_recovery():
    """Reset password using a recovery code (preserves encrypted data)."""
    try:
        data = ResetWithRecoverySchema(**request.json)
    except ValidationError as e:
        return jsonify({'error': sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Invalid request data'}), 400

    user = User.get_by_username(data.username)
    if not user:
        # Use generic error to avoid enumeration, but practically user needs to know username to use recovery code
        return jsonify({'error': 'Invalid username or recovery code'}), 400

    if not user.recovery_encrypted_dek or not user.recovery_iv or not user.recovery_salt:
        return jsonify({'error': 'Recovery code not set up for this account. Cannot recover data.'}), 400

    try:
        # 1. Derive key from recovery code
        salt = base64.b64decode(user.recovery_salt)
        recovery_kek = EncryptionService.get_recovery_kek(data.recovery_code, salt)
        
        # 2. Attempt to decrypt the DEK
        recovery_service = EncryptionService(key=recovery_kek)
        dek_b64 = recovery_service.decrypt(user.recovery_encrypted_dek, user.recovery_iv)
        
        if not dek_b64:
            # Decryption failed (wrong code)
            EnhancedAuditLogger.log(
                action='RECOVERY_FAILED',
                table_name='users',
                record_id=user.id,
                details=json.dumps({'reason': 'Invalid recovery code'}),
                status_code=400
            )
            return jsonify({'error': 'Invalid username or recovery code'}), 400
            
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
            action='PASSWORD_RESET_RECOVERY',
            table_name='users',
            record_id=user.id,
            user_id=user.id,
            details=json.dumps({'username': user.username}),
            status_code=200
        )
        
        return jsonify({'message': 'Password reset successfully. Your data has been preserved.'}), 200
        
    except Exception as e:
        print(f"Recovery error: {e}")
        return jsonify({'error': 'Failed to reset password using recovery code'}), 500
