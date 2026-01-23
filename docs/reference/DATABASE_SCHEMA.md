# RPS Database Schema

**Last Updated:** 2026-01-23 (v3.8.118)

This document provides a comprehensive map of the RPS database schema, including all tables, columns, relationships, and indexes.

## Database Overview

- **Database Type:** SQLite
- **Location:** `data/planning.db`
- **Encryption:** Profile data encrypted at rest (AES-256-GCM)
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

    -- Encryption keys
    encrypted_dek TEXT,              -- Data Encryption Key (encrypted with KEK)
    dek_iv TEXT,                     -- DEK initialization vector
    recovery_encrypted_dek TEXT,     -- Recovery-based encrypted DEK
    recovery_iv TEXT,                -- Recovery IV
    recovery_salt TEXT,              -- Recovery salt
    email_encrypted_dek TEXT,        -- Email-based encrypted DEK
    email_iv TEXT,                   -- Email IV
    email_salt TEXT,                 -- Email salt

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

### profile
User financial profiles with encrypted data.

```sql
CREATE TABLE profile (
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
    parameters TEXT,                 -- Encrypted JSON: scenario parameters
    parameters_iv TEXT,              -- IV for parameters
    results TEXT,                    -- Encrypted JSON: simulation results
    results_iv TEXT,                 -- IV for results
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
)
```

---

### action_items
User action items and tasks.

### conversations
AI advisor conversation history.

### groups
User groups for access control.

### user_groups / admin_groups
Group membership tables.

### password_reset_requests
Password reset workflow.

---

## Audit & Logging Tables

### enhanced_audit_log ⭐
**Primary source for admin reports**

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

**Used by:**
- User Activity Report (`/api/admin/reports/user-activity`)
- Users by Location Report (`/api/admin/reports/users-by-location`)
- Audit Log Viewer (`/api/admin/logs`)

---

## Admin Reports

### User Activity Report (NEW in v3.8.118)
**Endpoint:** `/api/admin/reports/user-activity`  
**UI Location:** Admin → Reports → User Activity

**Query Filters:**
- `user_ids` - Comma-separated list of user IDs
- `start_date` - ISO format (YYYY-MM-DD)
- `end_date` - ISO format (YYYY-MM-DD)
- `action_types` - Comma-separated (LOGIN_ATTEMPT, CREATE, UPDATE, DELETE, READ, ADMIN_ACCESS)
- `days` - Quick range (7, 30, 60, 90)

**Returns per user:**
- Total actions, active days
- Failed actions, login attempts
- Creates, updates, deletes, reads
- Admin actions, unique IPs
- Top 5 actions, top 5 tables
- Daily activity (last 30 days)
- First/last activity timestamps

**Summary statistics:**
- Total users analyzed
- Total actions across all users
- Average actions per user
- Failed actions count
- Most active user
- Action distribution

### Users by Location Report
**Endpoint:** `/api/admin/reports/users-by-location`  
**UI Location:** Admin → Reports → Users by Location

Analyzes `geo_location` JSON field for geographic access patterns.

---

## Entity Relationships

```
users (1) ──< (M) profile ──< (M) scenarios
          │                └──< (M) action_items
          │                └──< (M) conversations
          │
          ├──< (M) enhanced_audit_log ⭐
          ├──< (M) feedback
          └──<< (M:M) user_groups >>──< (M) groups
```

## Key Patterns

### Encryption
- Profile data encrypted with user's DEK
- DEK encrypted with password-derived KEK
- IV stored alongside encrypted data

### Cascade Deletes
User deletion cascades to all related tables except audit logs (SET NULL).

### JSON Fields
- `profile.data` - Complete financial profile (encrypted)
- `enhanced_audit_log.geo_location` - Geographic data
- `enhanced_audit_log.device_info` - Device fingerprint
- `users.preferences` - User settings

## Performance

### Indexes
- All foreign keys indexed
- username, email unique indexes
- Audit log: user_id, table_name, action, created_at, record_id

## Related Documentation

- [Admin System Guide](ADMIN_SYSTEM_GUIDE.md)
- [System Security Documentation](../security/SYSTEM_SECURITY_DOCUMENTATION.md)
- [Audit Logging](../AUDIT_LOGGING.md)
