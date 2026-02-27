# RPS Database Schema

**Last Updated:** 2026-02-27 (v3.10.0)

This document provides a comprehensive map of the RPS database schema, including all tables, columns, relationships, and indexes.

## Database Overview

- **Database Type:** SQLite
- **Location:** `data/planning.db`
- **Encryption:** Profile data and API keys encrypted at rest (AES-256-GCM)
- **Migration Tool:** Alembic

## Core Application Tables

### users
Primary user authentication and authorization table.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    is_super_admin INTEGER DEFAULT 0,
    is_demo_account BOOLEAN DEFAULT 0,

    -- Encryption keys
    encrypted_dek TEXT,              -- Data Encryption Key (encrypted with KEK)
    dek_iv TEXT,                     -- DEK initialization vector
    recovery_encrypted_dek TEXT,     -- Recovery-based encrypted DEK
    recovery_iv TEXT,                -- Recovery IV
    recovery_salt TEXT,              -- Recovery salt
    email_encrypted_dek TEXT,        -- Email-based encrypted DEK
    email_iv TEXT,                   -- Email IV
    email_salt TEXT,                 -- Email salt
    
    -- API Keys (Encrypted)
    api_keys TEXT,                   -- Encrypted JSON: provider API keys
    api_keys_iv TEXT,                -- IV for API keys

    -- Email Verification
    email_verified BOOLEAN DEFAULT 0,
    email_verification_sent_at TIMESTAMP,
    temp_recovery_code TEXT,
    recovery_code_shown BOOLEAN DEFAULT 0,

    -- Password reset
    reset_token TEXT,
    reset_token_expires TEXT,

    -- User preferences
    preferences TEXT,                -- JSON: user settings and preferences

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
)
```

**Indexes:**
- `idx_users_username` ON username
- `idx_users_email` ON email

---

### profiles (Renamed from profile in v3.9)
User financial profiles with encrypted data.

```sql
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    birth_date TEXT,
    retirement_date TEXT,
    data TEXT,                       -- Encrypted JSON: complete financial profile
    data_iv TEXT,                    -- Initialization vector for encryption
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
)
```

---

### scenarios
Monte Carlo simulation scenarios and results.

```sql
CREATE TABLE scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    parameters TEXT,                 -- Encrypted JSON: scenario parameters
    parameters_iv TEXT,              -- IV for parameters
    results TEXT,                    -- Encrypted JSON: simulation results
    results_iv TEXT,                 -- IV for results
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
)
```

---

### action_items
User action items and tasks.

```sql
CREATE TABLE action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER,
    category TEXT,
    description TEXT NOT NULL,
    priority TEXT,                   -- 'high', 'medium', 'low'
    status TEXT DEFAULT 'pending',   -- 'pending', 'in_progress', 'completed'
    due_date TEXT,
    action_data TEXT,                -- Encrypted JSON
    action_data_iv TEXT,
    subtasks TEXT,                   -- Encrypted JSON (list)
    subtasks_iv TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
)
```

---

### conversations
AI advisor conversation history per profile.

```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER,
    role TEXT NOT NULL,              -- 'user', 'assistant'
    content TEXT NOT NULL,           -- Encrypted ciphertext
    content_iv TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
)
```

---

### groups
User groups for access control and delegation.

```sql
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### user_groups / admin_groups
Membership and management mapping.

- `user_groups`: Links users to groups (user_id, group_id)
- `admin_groups`: Links admin users to groups they manage (user_id, group_id)

---

## Feedback & Planning

### feedback
User-submitted feedback and system information.

```sql
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,              -- 'comment', 'feature', 'bug'
    status TEXT DEFAULT 'pending',   -- 'pending', 'reviewed', 'resolved', 'closed'
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
```

### feedback_content
Separated content table for feedback (optimized for text storage).

```sql
CREATE TABLE feedback_content (
    feedback_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
)
```

### feature_roadmap
Product roadmap and feature planning (Super Admin only).

```sql
CREATE TABLE feature_roadmap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,          -- Healthcare, Tax Planning, etc.
    priority TEXT DEFAULT 'medium',  -- critical, high, medium, low
    phase TEXT DEFAULT 'backlog',    -- phase1, phase2, phase3, backlog
    status TEXT DEFAULT 'planned',   -- planned, in_progress, completed, etc.
    impact TEXT,                     -- high, medium, low
    effort TEXT,                     -- small, medium, large, xl
    target_version TEXT,
    assigned_to TEXT,
    notes TEXT,
    related_items TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
)
```

---

## Audit & Logging Tables

### enhanced_audit_log ⭐
**Primary source for security and admin reports.**

```sql
CREATE TABLE enhanced_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,            -- CREATE, READ, UPDATE, DELETE, LOGIN_ATTEMPT, etc.
    table_name TEXT,
    record_id INTEGER,
    user_id INTEGER,
    details TEXT,                    -- JSON
    status_code INTEGER,
    error_message TEXT,
    response_time_ms REAL,
    ip_address TEXT,
    user_agent TEXT,
    request_method TEXT,
    request_endpoint TEXT,
    request_query TEXT,
    request_size INTEGER,
    request_headers TEXT,
    referrer TEXT,
    session_id TEXT,
    geo_location TEXT,               -- JSON: {country, region, city, lat, lon}
    device_info TEXT,                -- JSON: {browser, os, device, is_mobile}
    fingerprint_hash INTEGER,
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    timezone_offset INTEGER,
    color_scheme TEXT,
    device_pixel_ratio REAL,
    is_touch_device INTEGER,
    is_webdriver INTEGER,
    network_type TEXT,
    engagement_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
)
```

### audit_config
Configuration storage for the audit logging system.

```sql
CREATE TABLE audit_config (
    id INTEGER PRIMARY KEY,          -- Usually 1
    config_data TEXT,                -- JSON: collection and display settings
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

## Entity Relationships

```
users (1) ──< (M) profiles ──< (M) scenarios
          │                 └──< (M) action_items
          │                 └──< (M) conversations
          │
          ├──< (M) enhanced_audit_log ⭐
          ├──< (M) feedback ─── (1) feedback_content
          ├──< (M) feedback_replies
          └──<< (M:M) user_groups >>──< (M) groups
```

## Related Documentation

- [Admin System Guide](ADMIN_SYSTEM_GUIDE.md)
- [System Security Documentation](../security/SYSTEM_SECURITY_DOCUMENTATION.md)
- [Audit Logging](../security/AUDIT_LOGGING.md)
