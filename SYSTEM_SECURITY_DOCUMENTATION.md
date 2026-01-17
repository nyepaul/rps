# System Security & Architecture Documentation

## Overview

The Retirement & Wealth Planning System (RPS) is designed with security-first principles, implementing multiple layers of protection for sensitive financial data. This document outlines the security architecture, encryption mechanisms, and data protection strategies employed throughout the system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Encryption](#data-encryption)
4. [API Key Management](#api-key-management)
5. [Data Isolation & Multi-Tenancy](#data-isolation--multi-tenancy)
6. [Security Best Practices](#security-best-practices)
7. [Compliance & Audit](#compliance--audit)
8. [Technical Implementation Details](#technical-implementation-details)

---

## Architecture Overview

### Technology Stack

**Backend:**
- **Framework:** Flask 3.0+ (Python)
- **Database:** SQLite with encrypted fields
- **Authentication:** Flask-Login with bcrypt password hashing
- **Encryption:** AES-256-GCM via Python cryptography library
- **Session Management:** Server-side sessions with secure cookies
- **Rate Limiting:** Flask-Limiter for brute force protection

**Frontend:**
- **Framework:** Vanilla JavaScript (ES6 modules)
- **State Management:** Custom store pattern
- **API Communication:** Fetch API with CSRF protection
- **Storage:** LocalStorage for non-sensitive UI preferences only

### Deployment Architecture

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │ HTTPS
       │ (Secure Connection)
       │
┌──────▼──────┐
│  Flask App  │
│  (Server)   │
├─────────────┤
│ Auth Layer  │
│ Route Layer │
│ Service Layer│
└──────┬──────┘
       │
┌──────▼──────┐
│   SQLite    │
│  Database   │
└─────────────┘
```

---

## Authentication & Authorization

### Password Security

**Hashing Algorithm:** bcrypt with adaptive cost factor
- **Cost Factor:** Automatically adjusts with computational power
- **Salt:** Unique per-user salt generated automatically
- **Rainbow Table Resistance:** Salting prevents pre-computed attacks
- **Implementation:** Flask-Login with custom User model

**Password Requirements:**
- Minimum 8 characters (configurable)
- Validated on registration
- Never stored in plaintext
- Never logged or exposed in error messages

### Session Management

**Flask-Login Configuration:**
- **Session Type:** Server-side sessions
- **Cookie Security:**
  - `HttpOnly` flag prevents JavaScript access
  - `Secure` flag requires HTTPS in production
  - `SameSite=Lax` prevents CSRF attacks
- **Session Timeout:** Configurable (default: 24 hours)
- **Remember Me:** Optional persistent sessions with secure tokens

### CSRF Protection

- **Token Generation:** Unique per-session CSRF tokens
- **Validation:** All state-changing requests validate CSRF token
- **Implementation:** Flask-WTF CSRF protection
- **Token Rotation:** Tokens rotate on authentication state changes

### Rate Limiting

**Flask-Limiter Configuration:**
- **Login Attempts:** 5 attempts per 15 minutes per IP
- **API Requests:** 100 requests per minute per user
- **Password Reset:** 3 attempts per hour per email
- **Automatic Lockout:** Temporary account lockout after excessive failures

---

## Data Encryption

### Encryption Architecture

All sensitive data is encrypted at rest using **AES-256-GCM** (Advanced Encryption Standard in Galois/Counter Mode).

### Encryption Service

**Location:** `src/services/encryption_service.py`

**Key Features:**
- **Algorithm:** AES-256-GCM
- **Key Size:** 256 bits
- **Mode:** Galois/Counter Mode (authenticated encryption)
- **IV Size:** 12 bytes (96 bits) - unique per record
- **Authentication:** Built-in message authentication (GMAC)

### Key Derivation

**PBKDF2 (Password-Based Key Derivation Function 2):**
- **Hash Function:** SHA-256
- **Iterations:** 100,000 (configurable)
- **Salt:** Master salt from environment variable
- **Output:** 256-bit encryption key

```python
# Key derivation pseudocode
def derive_key(password, salt, iterations=100000):
    key = PBKDF2(
        password=password,
        salt=salt,
        iterations=iterations,
        hash_function=SHA256,
        key_length=32  # 256 bits
    )
    return key
```

### Encryption Process

**For Each Record:**

1. **Generate IV:** Random 12-byte initialization vector
2. **Encrypt Data:** AES-256-GCM with key and IV
3. **Generate Tag:** GMAC authentication tag (automatic)
4. **Store:** Base64-encoded ciphertext + IV in database

```python
# Encryption pseudocode
def encrypt(plaintext, key):
    iv = generate_random_bytes(12)
    cipher = AES_GCM(key)
    ciphertext, tag = cipher.encrypt(plaintext, iv)
    return base64_encode(ciphertext), base64_encode(iv)
```

### Decryption Process

1. **Retrieve:** Get ciphertext and IV from database
2. **Decode:** Base64 decode both values
3. **Decrypt:** AES-256-GCM decryption with key and IV
4. **Verify:** Automatic authentication tag verification
5. **Return:** Original plaintext data

### Encrypted Fields

**Profile Model:**
- `data` - All profile information (JSON encrypted as string)
  - Personal details (name, age, retirement date)
  - Financial data (assets, liabilities, income, expenses)
  - Retirement scenarios and assumptions
  - **API keys** (Claude, Gemini)

**Scenario Model:**
- `assumptions` - Scenario-specific assumptions (JSON)

**Action Items Model:**
- `details` - Action item details and context (JSON)

### Key Management

**Master Encryption Key:**
- **Source:** Environment variable `ENCRYPTION_KEY`
- **Production:** Must be set to strong random value
- **Development:** Falls back to default (for testing only)
- **Rotation:** Requires re-encryption of all data (not yet automated)

**User-Specific DEK (Data Encryption Key):**
- **Storage:** Session-only, never persisted
- **Derivation:** Derived from user credentials
- **Scope:** Unique per user
- **Lifecycle:** Generated on login, destroyed on logout

---

## API Key Management

### Storage Architecture

API keys for external services (Claude, Gemini) are stored securely within each profile's encrypted data field.

**Storage Location:**
```json
{
  "profile": {
    "data": {
      "api_keys": {
        "claude_api_key": "sk-ant-...",
        "gemini_api_key": "AIzaSy..."
      }
    }
  }
}
```

### Security Guarantees

1. **Encryption at Rest:** API keys encrypted with AES-256-GCM
2. **Per-Profile Isolation:** Keys stored within profile data structure
3. **User Segregation:** Keys accessible only by owning user
4. **Transmission Security:** Keys sent only to official API endpoints
5. **No Logging:** Keys never logged to files or console
6. **Session-Only Caching:** Keys cached in encrypted session only

### API Key Management Endpoints

**GET `/api/profiles/<name>/api-keys`**
- **Purpose:** Retrieve masked API keys for display
- **Response:** Last 4 characters only (e.g., `"••••••••1234"`)
- **Authentication:** Required (user must own profile)

**POST `/api/profiles/<name>/api-keys`**
- **Purpose:** Save new encrypted API keys
- **Validation:** Minimum length, format checks
- **Encryption:** Automatic via profile data property
- **Authentication:** Required (user must own profile)

**POST `/api/test-api-key`**
- **Purpose:** Validate API key without storing
- **Providers:** Claude, Gemini
- **Method:** Minimal API request to verify key validity
- **Result:** Success/failure + model information

### API Key Rotation

**Process:**
1. User enters new API key via Settings modal
2. New key validated (optional test connection)
3. New key encrypted and stored in profile
4. Old key immediately invalidated
5. All future requests use new key

**No Downtime:** Key rotation is atomic - new key active immediately

---

## Data Isolation & Multi-Tenancy

### User Segregation

**Database Level:**
- All user data includes `user_id` foreign key
- SQLite queries always filter by `current_user.id`
- No cross-user data access possible

**Profile Ownership:**
- Each profile belongs to exactly one user
- Profiles cannot be shared (by design)
- Ownership verified on every API request

### Query Pattern

All data access follows this pattern:

```python
@login_required
def get_profile(name: str):
    # Ownership check built into query
    profile = Profile.get_by_name(name, current_user.id)
    if not profile:
        return 404  # Not found OR not owned by user
```

**Security Benefit:** User cannot determine if profile exists for another user (prevents enumeration attacks)

### Session Isolation

- **Session Data:** Stored server-side, not in cookies
- **Session ID:** Cryptographically random, 128-bit
- **Session Binding:** IP address and User-Agent checked
- **Concurrent Sessions:** Allowed but tracked separately

---

## Security Best Practices

### Input Validation

**Pydantic Schemas:**
- All API inputs validated with Pydantic models
- Type checking, length limits, format validation
- SQL injection prevention via parameterized queries
- XSS prevention via proper escaping

**Example:**
```python
class ProfileCreateSchema(BaseModel):
    name: str
    birth_date: Optional[str] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Profile name required')
        if len(v) > 100:
            raise ValueError('Name too long')
        return v.strip()
```

### SQL Injection Prevention

**Parameterized Queries:**
```python
# GOOD: Parameterized query
cursor.execute(
    "SELECT * FROM profile WHERE user_id = ? AND name = ?",
    (user_id, name)
)

# BAD: String formatting (NEVER DO THIS)
cursor.execute(
    f"SELECT * FROM profile WHERE name = '{name}'"
)
```

**All queries in codebase use parameterized approach**

### XSS Prevention

**Frontend:**
- All user input sanitized before display
- DOM manipulation uses `textContent` (not `innerHTML`)
- Template literals properly escape variables

**Backend:**
- JSON responses with proper Content-Type headers
- No user-generated content rendered as HTML

### HTTPS Enforcement

**Production:**
- All traffic over HTTPS required
- HTTP redirects to HTTPS (web server configuration)
- HSTS headers enabled
- Secure cookie flags set

**Development:**
- HTTP allowed for localhost only
- Environment-based configuration

---

## Compliance & Audit

### Audit Logging

**Logged Events:**
- User authentication (login/logout)
- Profile creation/update/deletion
- Scenario creation/modification
- API key updates
- Data exports

**Audit Log Structure:**
```python
{
    "timestamp": "2025-01-15T10:30:00Z",
    "user_id": 123,
    "action": "profile_update",
    "resource": "Profile:retirement_plan",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "result": "success"
}
```

**Location:** `audit_log` table in database

### Data Retention

**Active Data:**
- Retained indefinitely while user account active
- User can delete profiles/scenarios at any time

**Deleted Data:**
- Hard delete (no soft delete currently)
- Deleted records immediately removed from database
- Encryption keys destroyed, making recovery impossible

### Backup Security

**Backup Process:**
- Database backups include encrypted data
- Backups maintain same encryption
- Backup access requires encryption key
- Backups stored with restricted permissions

---

## Technical Implementation Details

### Encryption Service API

**Location:** `src/services/encryption_service.py`

**Main Functions:**

```python
class EncryptionService:
    def __init__(self, key: Optional[bytes] = None):
        """Initialize with encryption key."""

    def encrypt(self, plaintext: str) -> Tuple[str, str]:
        """Encrypt string, return (ciphertext, iv)."""

    def decrypt(self, ciphertext: str, iv: str) -> str:
        """Decrypt string with IV."""

    def encrypt_dict(self, data: dict) -> Tuple[str, str]:
        """Encrypt dictionary (JSON), return (ciphertext, iv)."""

    def decrypt_dict(self, ciphertext: str, iv: str) -> dict:
        """Decrypt to dictionary."""
```

**Global Instance:**
```python
from src.services.encryption_service import get_encryption_service

encryption = get_encryption_service()
ciphertext, iv = encryption.encrypt("sensitive data")
```

### Profile Model Encryption

**Location:** `src/models/profile.py`

**Automatic Encryption:**
```python
class Profile:
    @property
    def data(self) -> dict:
        """Decrypt and return data as dict."""
        if not self._encrypted_data:
            return {}
        return encryption.decrypt_dict(
            self._encrypted_data,
            self._encryption_iv
        )

    @data.setter
    def data(self, value: dict):
        """Encrypt and store data."""
        ciphertext, iv = encryption.encrypt_dict(value)
        self._encrypted_data = ciphertext
        self._encryption_iv = iv
```

**Usage:**
```python
profile = Profile.get_by_name("retirement_plan", user_id)
data = profile.data  # Automatically decrypts
data['api_keys'] = {'claude_api_key': 'sk-ant-...'}
profile.data = data  # Automatically encrypts
profile.save()
```

### Database Schema

**Profile Table:**
```sql
CREATE TABLE profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    birth_date TEXT,
    retirement_date TEXT,
    encrypted_data TEXT,  -- Base64 encoded ciphertext
    encryption_iv TEXT,   -- Base64 encoded IV
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    UNIQUE (user_id, name)
);
```

### API Request Flow

**Authenticated API Request:**

```
1. Browser → Flask: POST /api/profiles/retirement_plan
   Headers: Cookie: session=abc123, X-CSRF-Token: xyz789

2. Flask Middleware:
   - Verify session cookie
   - Check CSRF token
   - Load current_user from session

3. Route Handler:
   - @login_required decorator checks authentication
   - Profile.get_by_name(name, current_user.id) checks ownership

4. Profile Model:
   - Retrieves encrypted data from database
   - Automatically decrypts using encryption service
   - Returns plaintext data to route handler

5. Route Handler:
   - Processes request
   - Modifies data as needed
   - profile.data = updated_data (auto-encrypts)
   - profile.save()

6. Flask → Browser: JSON response
   Status: 200 OK
   Body: {"message": "Success", "profile": {...}}
```

---

## Environment Configuration

### Required Environment Variables

**Production:**

```bash
# Flask Configuration
SECRET_KEY=<strong-random-secret>          # Flask session encryption
FLASK_ENV=production

# Database
DATABASE_PATH=/path/to/data/planning.db

# Encryption
ENCRYPTION_KEY=<strong-random-key>         # AES-256 master key

# Optional: API Keys (if not stored per-profile)
GEMINI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
```

**Key Generation:**
```bash
# Generate strong random keys
python -c "import secrets; print(secrets.token_hex(32))"
```

### Security Checklist

**Before Production Deployment:**

- [ ] Set strong `SECRET_KEY` (32+ random bytes)
- [ ] Set strong `ENCRYPTION_KEY` (32+ random bytes)
- [ ] Enable HTTPS only (no HTTP)
- [ ] Set secure cookie flags (`Secure`, `HttpOnly`)
- [ ] Enable HSTS headers
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Restrict database file permissions
- [ ] Review audit logging configuration
- [ ] Test session timeout
- [ ] Verify CSRF protection
- [ ] Perform security scan / penetration test

---

## Threat Model & Mitigations

### Threat 1: Unauthorized Access

**Attack Vectors:**
- Password guessing
- Session hijacking
- CSRF attacks

**Mitigations:**
- bcrypt password hashing
- Rate limiting on login
- Server-side sessions
- HttpOnly cookies
- CSRF tokens

### Threat 2: Data Breach

**Attack Vectors:**
- Database file stolen
- Backup file leaked
- Memory dump

**Mitigations:**
- AES-256-GCM encryption at rest
- Encrypted backups
- No plaintext sensitive data in memory
- Encryption key stored separately

### Threat 3: API Key Compromise

**Attack Vectors:**
- Logged in error messages
- Exposed in client-side code
- Network interception

**Mitigations:**
- Keys encrypted in database
- Keys never logged
- Keys transmitted over HTTPS only
- Keys never sent to client
- Keys only used server-side

### Threat 4: Enumeration Attacks

**Attack Vectors:**
- Username enumeration
- Profile name enumeration

**Mitigations:**
- Generic error messages
- Same response time for valid/invalid
- 404 for both "not found" and "not authorized"

---

## Future Security Enhancements

### Planned Improvements

1. **Two-Factor Authentication (2FA)**
   - TOTP-based 2FA
   - Backup codes
   - SMS/Email fallback

2. **Encryption Key Rotation**
   - Automated re-encryption
   - Zero-downtime rotation
   - Key versioning

3. **Hardware Security Module (HSM)**
   - External key storage
   - FIPS 140-2 compliance

4. **Security Monitoring**
   - Anomaly detection
   - Failed login alerting
   - Suspicious activity notifications

5. **Data Export Encryption**
   - Encrypted CSV exports
   - Password-protected archives
   - PGP encryption support

---

## Support & Security Reporting

### Security Issues

If you discover a security vulnerability, please report it to:

- **Email:** security@example.com (replace with actual email)
- **Do Not:** Open public GitHub issues for security issues
- **Response Time:** 48 hours for initial response

### Security Updates

- Security patches released immediately
- Users notified via in-app notifications
- Critical updates deployed automatically

---

## Conclusion

The Retirement & Wealth Planning System implements defense-in-depth security with multiple layers of protection. From bcrypt password hashing to AES-256-GCM encryption, from CSRF protection to rate limiting, every component is designed with security as a primary concern.

**Key Takeaways:**
- ✅ All sensitive data encrypted at rest (AES-256-GCM)
- ✅ Strong authentication with bcrypt hashing
- ✅ Session-based authorization with CSRF protection
- ✅ Per-user data isolation at database level
- ✅ API keys stored encrypted, never exposed
- ✅ Comprehensive audit logging
- ✅ Input validation with Pydantic schemas
- ✅ SQL injection prevention via parameterized queries
- ✅ Production-ready security configuration

**Last Updated:** 2025-01-15
**Version:** 2.0
