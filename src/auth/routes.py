"""Authentication routes."""
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user
from src.auth.models import User
from src.extensions import limiter
from pydantic import BaseModel, EmailStr, validator
import re

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


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    """Register a new user."""
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

    # Create user
    user = User.create_user(
        username=data.username,
        email=data.email,
        password=data.password
    )

    # Log user in
    login_user(user)

    return jsonify({
        'message': 'Registration successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Log in a user."""
    try:
        data = LoginSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Get user
    user = User.get_by_username(data.username)

    # Check if user exists and password is correct
    if not user or not user.check_password(data.password):
        return jsonify({'error': 'Invalid username or password'}), 401

    # Check if user is active
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 401

    # Update last login
    user.update_last_login()

    # Log user in
    login_user(user, remember=True)

    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Log out the current user."""
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/session', methods=['GET'])
def session():
    """Check if user is authenticated."""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'is_admin': current_user.is_admin
            }
        }), 200
    return jsonify({'authenticated': False}), 200
