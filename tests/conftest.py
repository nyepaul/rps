"""
Pytest configuration and fixtures for testing
"""

import pytest
import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.app import create_app
from src.database.connection import Database
from src.auth.models import User
from src.models.profile import Profile
from src.services.encryption_service import EncryptionService


@pytest.fixture(scope="session")
def test_db_dir():
    """Create temporary directory for test databases."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture(scope="function")
def test_db(test_db_dir, request):
    """Create a fresh test database for each test."""
    # Create unique database file for each test
    test_name = request.node.name
    db_path = os.path.join(test_db_dir, f"{test_name}.db")

    # Set environment variable for test database
    os.environ["DATABASE_PATH"] = db_path

    # Initialize database
    test_db_instance = Database(db_path)

    # Update the global db instance to use test database
    # This ensures all imports of `db` use the test database
    import src.database.connection as connection_module
    import importlib

    # Save original for cleanup
    original_db = connection_module.db

    # Set test database globally
    connection_module.db = test_db_instance

    # Reload modules that import db so they pick up the test instance
    # This is critical - modules cache the db reference at import time
    if "src.auth.models" in sys.modules:
        importlib.reload(sys.modules["src.auth.models"])
    if "src.models.profile" in sys.modules:
        importlib.reload(sys.modules["src.models.profile"])
    if "src.models.action_item" in sys.modules:
        importlib.reload(sys.modules["src.models.action_item"])
    if "src.models.scenario" in sys.modules:
        importlib.reload(sys.modules["src.models.scenario"])
    if "src.models.conversation" in sys.modules:
        importlib.reload(sys.modules["src.models.conversation"])
    if 'src.models.group' in sys.modules:
        importlib.reload(sys.modules['src.models.group'])
    if 'src.services.user_backup_service' in sys.modules:
        importlib.reload(sys.modules['src.services.user_backup_service'])
    if 'src.services.selective_backup_service' in sys.modules:
        importlib.reload(sys.modules['src.services.selective_backup_service'])

    # Create tables
    with test_db_instance.get_connection() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                is_admin BOOLEAN DEFAULT 0,
                is_super_admin BOOLEAN DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login TEXT,
                encrypted_dek TEXT,
                dek_iv TEXT,
                reset_token TEXT,
                reset_token_expires TEXT,
                recovery_encrypted_dek TEXT,
                recovery_iv TEXT,
                recovery_salt TEXT,
                email_encrypted_dek TEXT,
                email_iv TEXT,
                email_salt TEXT,
                preferences TEXT,
                email_verified BOOLEAN DEFAULT 0,
                email_verification_sent_at TEXT
            )
        """)

        # Profile table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                birth_date TEXT,
                retirement_date TEXT,
                data TEXT,
                data_iv TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        """)

        # Scenarios table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scenarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                parameters TEXT,
                parameters_iv TEXT,
                results TEXT,
                results_iv TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
            )
        """)

        # Action items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_id INTEGER,
                description TEXT,
                priority TEXT,
                status TEXT,
                category TEXT,
                due_date TEXT,
                action_data TEXT,
                action_data_iv TEXT,
                subtasks TEXT,
                subtasks_iv TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
            )
        """)

        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                content_iv TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
            )
        """)

        # Audit log table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id INTEGER,
                user_id INTEGER,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # Enhanced Audit Log
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS enhanced_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                table_name TEXT,
                record_id INTEGER,
                user_id INTEGER,
                details TEXT,
                status_code INTEGER,
                error_message TEXT,
                ip_address TEXT,
                user_agent TEXT,
                request_method TEXT,
                request_endpoint TEXT,
                request_query TEXT,
                request_headers TEXT,
                request_size INTEGER,
                referrer TEXT,
                session_id TEXT,
                geo_location TEXT,
                device_info TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                response_time_ms REAL,
                fingerprint_hash INTEGER,
                engagement_score INTEGER,
                screen_width INTEGER,
                screen_height INTEGER,
                viewport_width INTEGER,
                viewport_height INTEGER,
                timezone_offset INTEGER,
                network_type TEXT,
                color_scheme TEXT,
                device_pixel_ratio REAL,
                is_touch_device INTEGER,
                is_webdriver INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        # Audit Config
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                config_data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Feedback
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                admin_notes TEXT,
                ip_address TEXT,
                user_agent TEXT,
                browser_name TEXT,
                browser_version TEXT,
                os_name TEXT,
                os_version TEXT,
                device_type TEXT,
                screen_resolution TEXT,
                viewport_size TEXT,
                timezone TEXT,
                language TEXT,
                referrer TEXT,
                current_url TEXT,
                session_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                email_sent BOOLEAN DEFAULT 0,
                last_reply_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)

        # Feedback Content
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feedback_id INTEGER NOT NULL UNIQUE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
            )
        """)

        # Feedback Replies
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feedback_id INTEGER NOT NULL,
                admin_id INTEGER NOT NULL,
                reply_text TEXT NOT NULL,
                is_private BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL
            )
        """)

        # Feature Roadmap
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feature_roadmap (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'medium',
                phase TEXT DEFAULT 'backlog',
                status TEXT DEFAULT 'planned',
                impact TEXT,
                effort TEXT,
                target_version TEXT,
                assigned_to TEXT,
                notes TEXT,
                related_items TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)

        # Password Reset Requests
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending' NOT NULL,
                request_ip TEXT,
                support_token TEXT,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                processed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (processed_by) REFERENCES users (id) ON DELETE SET NULL
            )
        """)

        # Groups
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # User-Group mapping
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_groups (
                user_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
            )
        """)

        # Admin-Group management mapping
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_groups (
                user_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
            )
        """)

        # User Backups
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_backups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                label TEXT,
                size_bytes INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)

        conn.commit()

    yield test_db_instance

    # Restore original db
    connection_module.db = original_db

    # Cleanup database file
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture(scope="function")
def app(test_db):
    """Create Flask app for testing."""
    app = create_app("testing")
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False  # Disable CSRF for testing
    app.config["RATELIMIT_ENABLED"] = False  # Disable Rate Limiting for testing
    app.config["RATELIMIT_STORAGE_URI"] = "memory://"  # Use memory storage for testing
    return app


@pytest.fixture(scope="function")
def client(app):
    """Create Flask test client."""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """Create Flask CLI test runner."""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def test_user(test_db):
    """Create a test user."""
    user = User(
        id=None,
        username="testuser",
        email="test@example.com",
        password_hash=User.hash_password("TestPass123"),
        email_verified=True,
    )
    user.save()
    return user


@pytest.fixture(scope="function")
def test_admin(test_db):
    """Create a test admin user."""
    user = User(
        id=None,
        username="admin",
        email="admin@example.com",
        password_hash=User.hash_password("AdminPass123"),
        is_admin=True,
        email_verified=True,
    )
    user.save()
    return user


@pytest.fixture(scope="function")
def test_super_admin(test_db):
    """Create a test super admin user."""
    user = User(
        id=None,
        username="superadmin",
        email="super@example.com",
        password_hash=User.hash_password("SuperPass123"),
        is_admin=True,
        is_super_admin=True,
        email_verified=True,
    )
    user.save()
    return user


@pytest.fixture(scope="function")
def test_profile(test_db, test_user, encryption_service):
    """Create a test profile."""
    profile = Profile(
        user_id=test_user.id,
        name="Test Profile",
        birth_date="1980-01-15",
        retirement_date="2050-01-15",
        data={
            "person": {"current_age": 44, "retirement_age": 70, "life_expectancy": 95},
            "financial": {
                "annual_income": 120000,
                "annual_expenses": 80000,
                "liquid_assets": 250000,
                "retirement_assets": 450000,
                "social_security_benefit": 2500,
            },
        },
    )
    profile.save()
    return profile


@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    """Get authentication headers for test user."""
    response = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    assert response.status_code == 200

    # Extract session cookie
    return {"Cookie": response.headers.get("Set-Cookie")}


@pytest.fixture(scope="function")
def encryption_service():
    """Create encryption service for testing."""
    # Use fixed key for testing
    test_key = b"0" * 32  # 32 bytes for AES-256

    # Patch the global instance in the module
    import src.services.encryption_service as es_module

    original_service = es_module._encryption_service
    original_get_service = es_module.get_encryption_service

    service = EncryptionService(key=test_key)
    es_module._encryption_service = service
    es_module.get_encryption_service = lambda: service

    yield service

    # Restore
    es_module._encryption_service = original_service
    es_module.get_encryption_service = original_get_service


from tests.fixtures.demo_seed import demo_data
