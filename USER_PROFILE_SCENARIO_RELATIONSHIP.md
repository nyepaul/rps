# User, Profile, and Scenario Relationship Guide

## Overview

The Retirement & Wealth Planning System uses a hierarchical data structure to organize and secure financial information. This document explains how users, profiles, and scenarios relate to each other and how data is securely segregated.

## Hierarchy Structure

```
System User (Login Account)
    ├── Profile 1: "Retirement at 65"
    │   ├── Scenario 1: "Base Case"
    │   ├── Scenario 2: "Early Retirement at 60"
    │   └── Scenario 3: "Work Until 70"
    │
    ├── Profile 2: "Conservative Plan"
    │   ├── Scenario 1: "Low Risk"
    │   └── Scenario 2: "Medium Risk"
    │
    └── Profile 3: "Spouse Planning"
        ├── Scenario 1: "Joint Retirement"
        └── Scenario 2: "Staggered Retirement"
```

---

## 1. System User (Login Account)

### What is a System User?

A **System User** is your login account for the application. This is the top-level identity that authenticates you and provides access to the system.

### Key Characteristics

- **Username/Email:** Your unique login identifier
- **Password:** bcrypt-hashed password for authentication
- **User ID:** Internal unique identifier (e.g., `user_id: 123`)
- **Session:** Secure server-side session after login

### One Account, Multiple Profiles

Each system user can create and manage multiple profiles:

```
User: john@example.com
  └── Can have unlimited profiles
      - "Retirement at 65"
      - "Early Retirement"
      - "Spouse Planning"
      - "Aggressive Growth"
      - "Conservative Plan"
      - etc.
```

### Security Features

- **Authentication:** Username + password required for login
- **Password Hashing:** bcrypt with unique salt per user
- **Session Management:** Server-side sessions with HttpOnly cookies
- **Rate Limiting:** Protection against brute force attacks (5 attempts per 15 minutes)
- **CSRF Protection:** Tokens prevent cross-site request forgery

---

## 2. Profiles

### What is a Profile?

A **Profile** is a distinct financial planning scenario for a person or couple. Each profile contains complete financial information including:

- Personal details (name, age, retirement date)
- All assets (retirement accounts, real estate, etc.)
- Income and expenses
- API keys for AI services
- Multiple scenarios (different planning assumptions)

### Why Multiple Profiles?

You might create multiple profiles to:

1. **Compare Different Strategies**
   - Profile A: "Retire at 65"
   - Profile B: "Retire at 60"
   - Profile C: "Work until 70"

2. **Plan for Different People**
   - Profile 1: "My Retirement"
   - Profile 2: "Spouse's Retirement"
   - Profile 3: "Joint Retirement"

3. **Test Different Approaches**
   - Profile A: "Conservative (80% bonds)"
   - Profile B: "Balanced (60/40 split)"
   - Profile C: "Aggressive (80% stocks)"

4. **Manage Life Changes**
   - Profile 1: "Before Inheritance"
   - Profile 2: "After Inheritance"
   - Profile 3: "After Real Estate Sale"

### Profile Ownership & Isolation

**Strict User Segregation:**
```sql
-- Every profile query includes user_id filter
SELECT * FROM profile
WHERE user_id = 123 AND name = 'Retirement at 65'
```

**Security Guarantees:**
- ✅ Each profile belongs to exactly ONE user
- ✅ Users can ONLY access their own profiles
- ✅ Profile names can be duplicate across different users
  - User A can have "Retirement Plan"
  - User B can also have "Retirement Plan"
  - These are completely separate
- ✅ Deleting a profile removes ALL associated scenarios
- ✅ No profile sharing between users (by design)

### Profile Data Encryption

**All profile data is encrypted at rest:**

```python
Profile: "Retirement at 65"
  └── Encrypted Data (AES-256-GCM)
      - Personal information
      - Assets and liabilities
      - Income and expenses
      - API keys
      - All financial details
```

**Encryption Details:**
- Algorithm: AES-256-GCM
- Unique IV (Initialization Vector) per profile
- User-specific encryption key (derived from credentials)
- Automatic encryption/decryption by Profile model

---

## 3. Scenarios

### What is a Scenario?

A **Scenario** is a variation within a profile that tests different assumptions while keeping the base financial data the same. Scenarios let you answer "what if" questions.

### Example Use Cases

**Profile: "Retirement at 65"**

**Scenario 1: "Base Case"**
- Assumptions:
  - Stock returns: 7% average
  - Inflation: 3%
  - Retirement age: 65
  - Life expectancy: 90

**Scenario 2: "Pessimistic"**
- Assumptions:
  - Stock returns: 5% average
  - Inflation: 4%
  - Retirement age: 65
  - Life expectancy: 95

**Scenario 3: "Optimistic"**
- Assumptions:
  - Stock returns: 9% average
  - Inflation: 2%
  - Retirement age: 63
  - Life expectancy: 85

### Scenario Ownership & Isolation

**Scenarios belong to profiles:**

```
User ID: 123
  └── Profile: "Retirement at 65" (profile_id: 456)
      └── Scenario 1: "Base Case" (scenario_id: 789)
          ├── user_id: 123 (inherited from profile)
          ├── profile_id: 456 (parent profile)
          └── assumptions: {...}
```

**Security Guarantees:**
- ✅ Scenarios belong to ONE profile
- ✅ Profiles belong to ONE user
- ✅ Transitive security: User → Profile → Scenario
- ✅ Deleting a profile cascades to scenarios
- ✅ Users can ONLY access scenarios in their profiles

### What's Different in a Scenario?

**Base Profile Contains:**
- Personal info (name, age, birth date)
- Assets and liabilities
- Income and expenses
- API keys

**Scenario Contains (Different Assumptions):**
- Retirement age
- Life expectancy
- Stock/bond return assumptions
- Inflation rate
- Social Security claiming age
- Tax assumptions
- Healthcare cost assumptions
- Market volatility assumptions

**Example:**

```
Profile: "John's Retirement"
  Base Data:
    - Age: 45
    - Assets: $500,000
    - Income: $80,000/year
    - Expenses: $60,000/year

  Scenario 1: "Retire at 65" (20 years to retirement)
    - Retirement age: 65
    - Stock returns: 7%
    - Inflation: 3%

  Scenario 2: "Retire at 60" (15 years to retirement)
    - Retirement age: 60
    - Stock returns: 7%
    - Inflation: 3%

  Scenario 3: "Bear Market" (20 years to retirement)
    - Retirement age: 65
    - Stock returns: 4%
    - Inflation: 4%
```

---

## Complete Example: John's Retirement Planning

### System User

```
Username: john@example.com
Password: [bcrypt hashed]
User ID: 42
```

### Profile 1: "Current Plan"

```yaml
Name: Current Plan
Owner: User ID 42
Created: 2025-01-15

Personal Info:
  Age: 45
  Retirement Target: 65
  Spouse Age: 43

Assets:
  - 401(k): $400,000
  - IRA: $100,000
  - Brokerage: $50,000
  - Home Equity: $200,000

Income:
  - Salary: $80,000/year
  - Spouse Salary: $60,000/year

API Keys:
  - Claude: sk-ant-... (encrypted)
  - Gemini: AIzaSy... (encrypted)

Scenarios:
  1. Base Case
  2. Early Retirement
  3. Late Retirement
```

### Profile 2: "Conservative Plan"

```yaml
Name: Conservative Plan
Owner: User ID 42
Created: 2025-01-15

Personal Info:
  [Same as Current Plan]

Assets:
  - 401(k): $400,000 (80% bonds, 20% stocks)
  - IRA: $100,000 (90% bonds, 10% stocks)
  - Brokerage: $50,000 (100% bonds)
  - Home Equity: $200,000

Income:
  [Same as Current Plan]

API Keys:
  - Claude: sk-ant-... (encrypted, separate from Profile 1)
  - Gemini: AIzaSy... (encrypted, separate from Profile 1)

Scenarios:
  1. Conservative Growth
  2. Ultra Conservative
```

### Profile 3: "Spouse Planning"

```yaml
Name: Spouse Planning
Owner: User ID 42
Created: 2025-01-15

Personal Info:
  Age: 43
  Retirement Target: 63
  [Focus on spouse's individual retirement]

Assets:
  - Spouse 401(k): $250,000
  - Spouse IRA: $80,000

Income:
  - Spouse Salary: $60,000/year

API Keys:
  - Claude: [Not configured]
  - Gemini: AIzaSy... (encrypted, separate from other profiles)

Scenarios:
  1. Retire with John at 65
  2. Retire Early at 60
```

---

## Database Schema & Relationships

### User Table

```sql
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- bcrypt hashed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### Profile Table

```sql
CREATE TABLE profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,  -- Foreign key to user
    name TEXT NOT NULL,
    birth_date TEXT,
    retirement_date TEXT,
    encrypted_data TEXT,  -- Contains all profile data (AES-256-GCM)
    encryption_iv TEXT,   -- Unique IV for this profile
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)  -- Same user can't have duplicate profile names
);
```

**Key Points:**
- `user_id` foreign key links profile to user
- `UNIQUE (user_id, name)` allows different users to have same profile names
- `ON DELETE CASCADE` removes profiles when user is deleted
- `encrypted_data` contains ALL sensitive profile information

### Scenario Table

```sql
CREATE TABLE scenario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,  -- Foreign key to profile
    user_id INTEGER NOT NULL,     -- Denormalized for quick access control
    name TEXT NOT NULL,
    description TEXT,
    encrypted_assumptions TEXT,   -- Scenario-specific assumptions (AES-256-GCM)
    encryption_iv TEXT,           -- Unique IV for this scenario
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES profile(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE (profile_id, name)  -- Same profile can't have duplicate scenario names
);
```

**Key Points:**
- `profile_id` links scenario to parent profile
- `user_id` denormalized for efficient access control
- `ON DELETE CASCADE` removes scenarios when profile is deleted
- `UNIQUE (profile_id, name)` prevents duplicate scenario names in same profile

---

## Access Control & Security

### How Access Control Works

**Every API request follows this pattern:**

```python
@profiles_bp.route('/profile/<name>', methods=['GET'])
@login_required  # 1. Check authentication
def get_profile(name: str):
    # 2. Verify ownership
    profile = Profile.get_by_name(name, current_user.id)

    if not profile:
        # Could mean:
        # - Profile doesn't exist, OR
        # - Profile exists but belongs to different user
        # We return same error for both (prevents enumeration)
        return jsonify({'error': 'Profile not found'}), 404

    # 3. Return data (automatically decrypted)
    return jsonify({'profile': profile.to_dict()}), 200
```

### Security Layers

**Layer 1: Authentication**
- User must be logged in (`@login_required`)
- Session token validated
- User identity established (`current_user`)

**Layer 2: Ownership Verification**
- Query includes `user_id` filter
- Database enforces foreign key constraints
- No cross-user data access possible

**Layer 3: Encryption**
- All sensitive data encrypted at rest
- Decryption requires valid encryption key
- User-specific encryption context

**Layer 4: Authorization**
- User can only access their own resources
- No sharing or delegation (by design)
- Profile/scenario ownership immutable

### What This Prevents

✅ **Prevents:**
- User A accessing User B's profiles
- User A accessing User B's scenarios
- User A enumerating User B's profile names
- Cross-user data leakage
- Unauthorized API key access
- Session hijacking (HttpOnly cookies)
- CSRF attacks (token validation)

---

## API Key Storage & Isolation

### API Keys Are Profile-Specific

**Important:** API keys are stored PER PROFILE, not per user.

**Example:**

```
User: john@example.com

  Profile 1: "Current Plan"
    API Keys:
      - Claude: sk-ant-key-abc123
      - Gemini: AIzaSy-key-xyz789

  Profile 2: "Conservative Plan"
    API Keys:
      - Claude: sk-ant-key-def456  (different key)
      - Gemini: [Not configured]

  Profile 3: "Spouse Planning"
    API Keys:
      - Claude: [Not configured]
      - Gemini: AIzaSy-key-uvw012  (different key)
```

### Why Profile-Specific API Keys?

1. **Isolation:** Different profiles can use different AI services
2. **Billing:** Separate API usage per profile
3. **Flexibility:** Test different AI providers per planning scenario
4. **Security:** Compromise of one profile doesn't affect others

### API Key Encryption

API keys are stored within the encrypted profile data:

```python
Profile: "Current Plan"
  └── Encrypted Data (AES-256-GCM)
      └── {
            "personal": {...},
            "assets": {...},
            "api_keys": {
                "claude_api_key": "sk-ant-...",  # Encrypted
                "gemini_api_key": "AIzaSy..."    # Encrypted
            }
          }
```

**Security Properties:**
- Encrypted with profile's unique encryption key
- Unique IV per profile
- Never stored in plaintext
- Never logged to files
- Transmitted only over HTTPS
- Only sent to official API endpoints

---

## Common Workflows

### Workflow 1: New User Sign-Up

```
1. User creates account
   - Username: john@example.com
   - Password: [securely hashed]
   - User ID assigned: 42

2. User creates first profile
   - Name: "Retirement at 65"
   - Profile ID assigned: 101
   - Data encrypted and stored

3. User creates scenarios in profile
   - Scenario 1: "Base Case" (ID: 201)
   - Scenario 2: "Early Retirement" (ID: 202)

4. User configures API keys (optional)
   - Claude key saved in Profile 101
   - Gemini key saved in Profile 101
   - Keys encrypted with profile data
```

### Workflow 2: Comparing Multiple Strategies

```
User: john@example.com (ID: 42)

Create Profile 1: "Aggressive Growth"
  - 80% stocks, 20% bonds
  - Retire at 65
  - Scenarios:
    * Base Case
    * Bull Market
    * Bear Market

Create Profile 2: "Conservative"
  - 40% stocks, 60% bonds
  - Retire at 67
  - Scenarios:
    * Base Case
    * Stable Growth

Create Profile 3: "Balanced"
  - 60% stocks, 40% bonds
  - Retire at 65
  - Scenarios:
    * Base Case
    * Mid-Course Correction

Compare results across all 3 profiles
Select optimal strategy
```

### Workflow 3: Planning for Spouse

```
User: john@example.com (ID: 42)

Profile 1: "John's Plan"
  - Focus: John's retirement
  - Assets: John's 401(k), IRA
  - Scenarios: Various retirement ages

Profile 2: "Sarah's Plan"
  - Focus: Sarah's retirement
  - Assets: Sarah's 401(k), IRA
  - Scenarios: Various retirement ages

Profile 3: "Joint Plan"
  - Focus: Combined retirement
  - Assets: All household assets
  - Scenarios: Joint retirement strategies
```

---

## Data Isolation Examples

### Example 1: Two Users, Same Profile Name

```
User A (ID: 42)
  └── Profile: "Retirement Plan"
      └── Data: User A's financial data (encrypted)

User B (ID: 43)
  └── Profile: "Retirement Plan"
      └── Data: User B's financial data (encrypted)
```

**Database Queries:**

```python
# User A requests "Retirement Plan"
profile = Profile.get_by_name("Retirement Plan", user_id=42)
# Returns: User A's profile

# User B requests "Retirement Plan"
profile = Profile.get_by_name("Retirement Plan", user_id=43)
# Returns: User B's profile

# User A tries to access User B's data
profile = Profile.get_by_name("Retirement Plan", user_id=42)
# Returns: User A's profile only (no access to User B's data)
```

### Example 2: Profile Deletion Cascade

```
User: john@example.com (ID: 42)

Profile: "Retirement at 65" (ID: 101)
  ├── Scenario 1: "Base Case" (ID: 201)
  ├── Scenario 2: "Optimistic" (ID: 202)
  └── Scenario 3: "Pessimistic" (ID: 203)

Delete Profile 101
  → Automatically deletes scenarios 201, 202, 203
  → All encrypted data removed
  → API keys permanently destroyed
```

### Example 3: Cross-Profile Isolation

```
User: john@example.com (ID: 42)

Profile 1: "Conservative" (ID: 101)
  API Keys:
    - Claude: sk-ant-key-abc123

Profile 2: "Aggressive" (ID: 102)
  API Keys:
    - Gemini: AIzaSy-key-xyz789

When using Profile 1:
  ✅ Can access Claude key from Profile 1
  ❌ Cannot access Gemini key from Profile 2

When using Profile 2:
  ✅ Can access Gemini key from Profile 2
  ❌ Cannot access Claude key from Profile 1
```

---

## Best Practices

### For Users

1. **Organize Your Profiles**
   - Use clear, descriptive names
   - Group related scenarios together
   - Keep profile count manageable

2. **Scenario Naming**
   - Use descriptive names ("Early Retirement" not "Scenario 2")
   - Document assumptions in scenario descriptions

3. **API Key Management**
   - Configure API keys per profile
   - Test keys after configuration
   - Rotate keys periodically

4. **Data Backup**
   - Export profiles regularly
   - Store exports securely
   - Test restore process

### For Developers

1. **Always Validate Ownership**
   - Include `user_id` in ALL queries
   - Use `Profile.get_by_name(name, user_id)`
   - Never trust client-provided IDs

2. **Use Cascade Deletes**
   - Foreign key constraints with ON DELETE CASCADE
   - Prevents orphaned scenarios
   - Maintains referential integrity

3. **Encrypt Sensitive Data**
   - Use Profile.data property (auto-encrypts)
   - Never store sensitive data unencrypted
   - Unique IV per record

4. **Generic Error Messages**
   - Same error for "not found" and "not authorized"
   - Prevents user enumeration
   - Protects privacy

---

## Summary

### Key Relationships

```
SYSTEM USER (Login)
  ↓ Has Many
PROFILES (Financial Plans)
  ↓ Has Many
SCENARIOS (Planning Variations)
```

### Security Principles

1. **Authentication First:** Must log in to access anything
2. **Ownership Verification:** Every query checks user_id
3. **Encryption at Rest:** All sensitive data encrypted
4. **Cascade Protection:** Deleting parent removes children
5. **No Sharing:** Resources belong to one user only
6. **Generic Errors:** Same response for not-found and not-authorized

### What You Can Do

✅ Create multiple profiles under your account
✅ Create multiple scenarios per profile
✅ Configure different API keys per profile
✅ Compare results across profiles
✅ Delete profiles/scenarios as needed
✅ Export/import data for backup

### What You Cannot Do

❌ Access another user's profiles
❌ Share profiles with other users
❌ Access scenarios from profiles you don't own
❌ View another user's API keys
❌ Enumerate another user's resources

---

**Last Updated:** 2025-01-15
**Version:** 2.0
