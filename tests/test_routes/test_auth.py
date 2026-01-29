"""
Integration tests for authentication routes
"""
import pytest


def test_register_new_user(client, test_db):
    """Test registering a new user."""
    response = client.post('/api/auth/register', json={
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'NewPass123'
    })

    assert response.status_code == 201
    data = response.get_json()
    assert 'Registration successful' in data['message']
    assert 'user' in data
    assert data['user']['username'] == 'newuser'
    assert data['user']['email'] == 'new@example.com'
    assert 'password' not in data['user']


def test_register_duplicate_username(client, test_user):
    """Test that duplicate usernames are rejected."""
    response = client.post('/api/auth/register', json={
        'username': 'testuser',  # Already exists
        'email': 'different@example.com',
        'password': 'Pass1234'
    })

    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data
    assert 'exists' in data['error'].lower()


def test_register_duplicate_email(client, test_user):
    """Test that duplicate emails are rejected."""
    response = client.post('/api/auth/register', json={
        'username': 'differentuser',
        'email': 'test@example.com',  # Already exists
        'password': 'Pass123'
    })

    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_register_invalid_data(client, test_db):
    """Test registration with invalid data."""
    # Missing username
    response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'Pass123'
    })
    assert response.status_code == 400

    # Missing email
    response = client.post('/api/auth/register', json={
        'username': 'testuser',
        'password': 'Pass123'
    })
    assert response.status_code == 400

    # Missing password
    response = client.post('/api/auth/register', json={
        'username': 'testuser',
        'email': 'test@example.com'
    })
    assert response.status_code == 400


def test_login_success(client, test_user):
    """Test successful login."""
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })

    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Login successful'
    assert 'user' in data
    assert data['user']['username'] == 'testuser'

    # Should set session cookie
    assert 'Set-Cookie' in response.headers


def test_login_wrong_password(client, test_user):
    """Test login with wrong password."""
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'WrongPassword'
    })

    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_login_nonexistent_user(client, test_db):
    """Test login with non-existent user."""
    response = client.post('/api/auth/login', json={
        'username': 'nonexistent',
        'password': 'SomePass123'
    })

    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_login_missing_credentials(client, test_db):
    """Test login with missing credentials."""
    # Missing password
    response = client.post('/api/auth/login', json={
        'username': 'testuser'
    })
    assert response.status_code == 400

    # Missing username
    response = client.post('/api/auth/login', json={
        'password': 'TestPass123'
    })
    assert response.status_code == 400


def test_logout(client, test_user):
    """Test logout."""
    # Login first
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })
    assert response.status_code == 200

    # Logout
    response = client.post('/api/auth/logout')
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Logout successful'


def test_session_check_authenticated(client, test_user):
    """Test session check for authenticated user."""
    # Login
    client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })

    # Check session
    response = client.get('/api/auth/session')
    assert response.status_code == 200
    data = response.get_json()
    assert data['authenticated'] is True
    assert 'user' in data
    assert data['user']['username'] == 'testuser'


def test_session_check_unauthenticated(client, test_db):
    """Test session check for unauthenticated user."""
    response = client.get('/api/auth/session')
    assert response.status_code == 200
    data = response.get_json()
    assert data['authenticated'] is False
    assert 'user' not in data


def test_protected_route_requires_auth(client, test_db):
    """Test that protected routes require authentication."""
    # Try to access profiles without logging in
    response = client.get('/api/profiles')
    # Flask-Login returns 302 (redirect) for unauthorized API requests
    assert response.status_code == 302


def test_protected_route_with_auth(client, test_user):
    """Test that protected routes work with authentication."""
    # Login
    client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })

    # Access protected route
    response = client.get('/api/profiles')
    assert response.status_code == 200


def test_login_case_sensitive(client, test_user):
    """Test that login is case-sensitive."""
    response = client.post('/api/auth/login', json={
        'username': 'TestUser',  # Wrong case
        'password': 'TestPass123'
    })

    assert response.status_code == 401


def test_multiple_login_attempts(client, test_user):
    """Test multiple login attempts."""
    # First login
    response1 = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })
    assert response1.status_code == 200

    # Logout
    client.post('/api/auth/logout')

    # Second login
    response2 = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'TestPass123'
    })
    assert response2.status_code == 200
