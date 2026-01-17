# API Key Security Architecture

## Overview

RPS implements a **per-user, per-profile API key storage system** for AI services (Google Gemini and Anthropic Claude). This document explains how API keys are securely stored and managed.

## Key Design Principles

1. **User-Owned Keys**: Each user provides their own API keys
2. **Profile-Level Storage**: Keys are stored per profile, not system-wide
3. **Encrypted at Rest**: All keys are encrypted using AES-256-GCM
4. **Zero Trust**: No system-wide fallback keys in environment variables
5. **Principle of Least Privilege**: Keys are only transmitted to official API endpoints

## Architecture

### Storage Location

API keys are stored in the Profile model's `data` field:
```
Profile
  └─ data (encrypted JSON)
      └─ api_keys
          ├─ gemini_api_key
          └─ claude_api_key
```

The entire `data` field is encrypted as a single JSON blob, providing:
- Confidentiality for all sensitive profile data
- Integrity verification via GCM authentication
- Per-record encryption with unique IVs

### Encryption Specifications

**Algorithm**: AES-256-GCM
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 96 bits (12 bytes, randomly generated per encryption)
- **Authentication Tag**: 128 bits (included in GCM ciphertext)

**Key Derivation**: PBKDF2-HMAC-SHA256
- **Iterations**: 100,000
- **Salt**: Fixed application salt (for base encryption key)
- **Output**: 32-byte encryption key

**Data Format**:
```
Profile Table:
  - data: base64(AES-GCM-ciphertext)
  - data_iv: base64(12-byte-IV)
```

### Code Implementation

#### 1. Profile Model (`src/models/profile.py`)
```python
@property
def data_dict(self):
    """Automatically decrypts data when accessed."""
    if self._data and self.data_iv:
        return decrypt_dict(self._data, self.data_iv)
    return {}

def save(self):
    """Automatically encrypts data when saved."""
    if self._decrypted_data is not None:
        encrypted_data, data_iv = encrypt_dict(self._decrypted_data)
        self._data = encrypted_data
        self.data_iv = data_iv
```

#### 2. API Key Retrieval (`src/routes/ai_services.py`)
```python
# Get profile with ownership check
profile = Profile.get_by_name(profile_name, current_user.id)

# Extract API keys from encrypted data
data_dict = profile.data_dict
api_keys = data_dict.get('api_keys', {})
api_key = api_keys.get('gemini_api_key')

if not api_key:
    return jsonify({'error': 'API key not configured'}), 400
```

#### 3. API Key Storage (`src/routes/profiles.py`)
```python
@profiles_bp.route('/profiles/<name>/api-keys', methods=['POST'])
@login_required
def save_api_keys(name: str):
    """Save encrypted API keys."""
    profile = Profile.get_by_name(name, current_user.id)

    data_dict = profile.data_dict
    if 'api_keys' not in data_dict:
        data_dict['api_keys'] = {}

    # Update keys
    if data.claude_api_key:
        data_dict['api_keys']['claude_api_key'] = data.claude_api_key
    if data.gemini_api_key:
        data_dict['api_keys']['gemini_api_key'] = data.gemini_api_key

    # Save (encryption happens automatically)
    profile.data = data_dict
    profile.save()
```

## Security Features

### 1. Encryption at Rest
- All profile data including API keys encrypted in SQLite database
- Master encryption key stored in `ENCRYPTION_KEY` environment variable
- Never stored in plaintext anywhere on disk

### 2. User Isolation
- API keys scoped to individual profiles
- Ownership checks enforce that users can only access their own keys
- No cross-user key sharing or visibility

### 3. Minimal Exposure
- Keys only decrypted when needed for API calls
- Never logged or included in error messages
- UI shows only last 4 characters for verification

### 4. Secure Transmission
- Keys transmitted over HTTPS only
- Sent directly to official API endpoints (api.anthropic.com, generativelanguage.googleapis.com)
- Never sent to intermediate proxies or third parties

### 5. Access Control
- `@login_required` decorator on all API key endpoints
- Profile ownership verified on every access
- Flask-Login session management with secure cookies

## User Experience

### Setting Up API Keys

1. User navigates to Settings tab in the application
2. Enters API keys in password-masked input fields
3. Optional: Tests key connectivity with "Test" button
4. Saves keys (encrypted and stored in database)
5. Keys are cleared from UI after save
6. UI shows masked version (last 4 chars) for verification

### Using AI Features

1. User attempts to use AI Advisor or Asset Extraction
2. Backend retrieves API key from user's profile
3. If key not found, returns error requesting configuration
4. If key found, decrypts and uses for API call
5. Key never exposed to frontend or logs

## Comparison to Environment Variable Approach

| Aspect | Per-User Storage (RPS) | Environment Variables |
|--------|---------------------------|----------------------|
| **User Privacy** | ✅ Each user owns their keys | ❌ Single shared key |
| **Cost Control** | ✅ Users control their usage | ❌ Shared quota/billing |
| **Security** | ✅ Encrypted per-user | ⚠️ Visible to all processes |
| **Isolation** | ✅ Profile-level isolation | ❌ Global to application |
| **Scalability** | ✅ No system-wide limits | ❌ Bottlenecked by one key |
| **Compliance** | ✅ No PII sent to admin's API account | ❌ All data through admin's account |

## Migration from Legacy Code

The codebase includes `app_legacy.py` which used environment variables for API keys. This has been replaced with the modular v2 architecture (`app.py`) that implements per-user storage.

**Key changes**:
- ❌ Old: `os.environ.get('GEMINI_API_KEY')`
- ✅ New: `profile.data_dict.get('api_keys', {}).get('gemini_api_key')`

## Threat Model

### Threats Mitigated

1. **Database Compromise**: Encrypted storage prevents plaintext key exposure
2. **Memory Dumps**: Keys decrypted only when needed, not stored in long-lived memory
3. **Log Analysis**: Keys never logged or included in error messages
4. **Unauthorized Access**: Ownership checks prevent cross-user access
5. **Man-in-the-Middle**: HTTPS enforced for all API calls

### Residual Risks

1. **Compromised ENCRYPTION_KEY**: If master key is exposed, all profile data can be decrypted
   - **Mitigation**: Store ENCRYPTION_KEY securely, never commit to git
2. **Memory Access**: Keys briefly in memory during API calls
   - **Mitigation**: Use short-lived request contexts, avoid long-lived variables
3. **User Phishing**: Users could be tricked into providing keys to malicious sites
   - **Mitigation**: User education, clear security messaging in UI

## Best Practices for Deployment

1. **Generate Strong ENCRYPTION_KEY**:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. **Secure Environment File**:
   ```bash
   chmod 600 /var/www/rps.pan2.app/.env
   chown www-data:www-data /var/www/rps.pan2.app/.env
   ```

3. **Never Commit Secrets**:
   - `.env` files are in `.gitignore`
   - Use `.env.production.example` as template only

4. **Regular Backups**:
   - Backup database with encrypted profile data
   - Store backup encryption keys separately from backups

5. **Monitor Access**:
   - Review audit logs for API key access patterns
   - Alert on unusual API usage or access patterns

## Compliance Considerations

### GDPR / Privacy
- API keys are personal data (user-specific credentials)
- Encrypted storage meets "appropriate technical measures" requirement
- Users have full control over their data (can view/update/delete)

### SOC 2 / Security
- Encryption at rest with industry-standard algorithms
- Access controls with authentication and authorization
- Audit logging of profile modifications

### Financial Services
- No sharing of sensitive financial data with third-party APIs using admin credentials
- User-controlled API keys ensure data sovereignty
- Encrypted storage protects against data breaches

## Troubleshooting

### User reports "API key not configured"
1. Verify user has saved keys in Settings tab
2. Check profile ownership (user must own the profile)
3. Verify encryption key is correctly set in environment

### Keys not persisting after save
1. Check database permissions (www-data must have write access)
2. Verify ENCRYPTION_KEY is consistent across restarts
3. Review logs for encryption/decryption errors

### API calls failing despite valid keys
1. Test key connectivity using "Test" button in Settings
2. Check for network/firewall issues blocking API endpoints
3. Verify API key hasn't been revoked at provider

## Related Documentation

- [SYSTEM_SECURITY_DOCUMENTATION.md](../SYSTEM_SECURITY_DOCUMENTATION.md) - Overall security architecture
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment guide
- [CLAUDE.md](../CLAUDE.md) - Development guide
