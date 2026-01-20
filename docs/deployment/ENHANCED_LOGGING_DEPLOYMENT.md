# Enhanced Audit Logging - Deployment Guide

## Overview
Enhanced comprehensive audit logging has been implemented to track user activities including:
- Login/logout events with IP addresses and geolocation
- Registration events
- Failed login attempts
- Device and browser information
- Request details (method, endpoint, headers)
- Session tracking

## What Was Done

### 1. Database Migration Created
**File**: `migrations/versions/e7a4f8d9c1b2_add_enhanced_audit_logging.py`

Creates two new tables:
- `enhanced_audit_log` - Comprehensive audit log with all tracking fields
- `audit_config` - Configuration for audit logging behavior

**Fields tracked in enhanced_audit_log**:
- action, table_name, record_id, user_id
- status_code, error_message
- ip_address, user_agent
- geo_location (city, region, country, timezone)
- device_info (browser, OS, device type)
- request_method, request_endpoint, request_query
- request_size, referrer, session_id
- request_headers (optional, privacy-sensitive)
- created_at timestamp

### 2. Authentication Routes Enhanced
**File**: `src/auth/routes.py`

Added comprehensive logging for:
- **User Registration** (`USER_REGISTER`) - Tracks new account creation
- **Successful Login** (`LOGIN_SUCCESS`) - Tracks user login with location/device info
- **Failed Login** (`LOGIN_FAILED`) - Tracks failed attempts with reason (invalid credentials, disabled account)
- **User Logout** (`USER_LOGOUT`) - Tracks when users log out

### 3. Enhanced Audit Logger Service
**File**: `src/services/enhanced_audit_logger.py` (already exists)

Provides:
- Automatic IP address and user agent collection
- Geolocation lookup via ip-api.com (free tier)
- Device/browser parsing via user-agents library
- Configurable logging levels
- Statistics and reporting functions

## Deployment Steps

### Step 1: Deploy Files to Production
```bash
# Copy migration file (requires sudo/www-data permissions)
sudo cp /home/paul/src/rps/migrations/versions/e7a4f8d9c1b2_add_enhanced_audit_logging.py \
        /var/www/rps.pan2.app/migrations/versions/
sudo chown www-data:www-data /var/www/rps.pan2.app/migrations/versions/e7a4f8d9c1b2_add_enhanced_audit_logging.py

# Copy updated auth routes
sudo cp /home/paul/src/rps/src/auth/routes.py /var/www/rps.pan2.app/src/auth/routes.py
sudo chown www-data:www-data /var/www/rps.pan2.app/src/auth/routes.py
```

### Step 2: Run Database Migration
```bash
cd /var/www/rps.pan2.app
./venv/bin/python -m alembic upgrade head
```

### Step 3: Restart Application
```bash
sudo systemctl restart rps
```

### Step 4: Verify Logging is Working
```bash
# Check that tables were created
sqlite3 /var/www/rps.pan2.app/data/planning.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%audit%';"

# Expected output:
# audit_log
# enhanced_audit_log
# audit_config
```

## Checking Audit Logs

### Via Database
```bash
# View recent logins
sqlite3 /var/www/rps.pan2.app/data/planning.db "SELECT action, user_id, ip_address, geo_location, created_at FROM enhanced_audit_log WHERE action LIKE '%LOGIN%' ORDER BY created_at DESC LIMIT 10;"

# View failed logins
sqlite3 /var/www/rps.pan2.app/data/planning.db "SELECT user_id, details, ip_address, error_message, created_at FROM enhanced_audit_log WHERE action='LOGIN_FAILED' ORDER BY created_at DESC LIMIT 10;"

# Count logins by IP
sqlite3 /var/www/rps.pan2.app/data/planning.db "SELECT ip_address, COUNT(*) as count FROM enhanced_audit_log WHERE action='LOGIN_SUCCESS' GROUP BY ip_address ORDER BY count DESC;"
```

### Via Admin Panel
The admin panel already has audit log viewing capability at `/admin` section.

## What Gets Logged

### Every Login Attempt Captures:
- ✅ Username
- ✅ User ID (if valid user)
- ✅ IP Address
- ✅ Geographic Location (City, Region, Country, Timezone)
- ✅ Device Type (Mobile, Tablet, PC, Bot)
- ✅ Browser (Name and Version)
- ✅ Operating System (Name and Version)
- ✅ Timestamp
- ✅ Success/Failure Status
- ✅ Failure Reason (if applicable)
- ✅ Request Method and Endpoint
- ✅ Session ID (partial, for privacy)
- ✅ Referrer URL

### Example Log Entry:
```json
{
  "action": "LOGIN_SUCCESS",
  "user_id": 1,
  "username": "admin",
  "ip_address": "192.168.1.100",
  "geo_location": {
    "city": "Chicago",
    "region": "Illinois",
    "country": "United States",
    "timezone": "America/Chicago"
  },
  "device_info": {
    "browser": "Chrome",
    "browser_version": "120.0",
    "os": "Windows",
    "os_version": "10",
    "device": "PC",
    "is_mobile": false
  },
  "request_method": "POST",
  "request_endpoint": "/api/auth/login",
  "created_at": "2026-01-17T00:15:30.123456"
}
```

## Configuration

Audit logging behavior can be configured via the `audit_config` table or through the admin panel.

### Default Configuration:
- Geolocation: **Enabled**
- Device Info: **Enabled**
- Failed Login Tracking: **Enabled**
- READ Operations: **Disabled** (to reduce noise)
- Retention: **90 days**

## Privacy Considerations

The system is designed with privacy in mind:
- Request headers logging is **OFF by default** (can contain sensitive cookies)
- Session IDs are truncated to first 8 characters
- User passwords are NEVER logged
- Geolocation uses free ip-api.com service (no personal data sent)

## Dependencies

The enhanced audit logger requires:
- `requests` - For geolocation API calls (already in requirements.txt)
- `user-agents` - For parsing user agent strings (add to requirements.txt if missing)

Check if user-agents is installed:
```bash
./venv/bin/pip list | grep user-agents
```

If not installed:
```bash
./venv/bin/pip install user-agents
```

## Troubleshooting

### Geolocation not working
- Check internet connectivity
- Verify ip-api.com is accessible
- Rate limit: 45 requests/minute (free tier)
- Fallback: logs will still work, just without geo data

### Migration fails
- Check database permissions
- Verify no syntax errors in migration file
- Check alembic version history: `alembic current`

### No logs appearing
- Check that enhanced_audit_log table exists
- Verify application has database write permissions
- Check application logs for errors
- Ensure audit logging is enabled in config

## Security Notes

✅ **Enhanced security monitoring capabilities**:
- Detect brute force attacks (multiple failed logins from same IP)
- Identify suspicious geographic patterns (logins from multiple countries)
- Track concurrent sessions
- Monitor for account takeover attempts
- Audit trail for compliance (GDPR, SOC2, etc.)

## Next Steps

Consider implementing:
1. **Alerting** - Email/SMS alerts for suspicious activity
2. **Dashboard** - Real-time visualization of login patterns
3. **IP Blocking** - Automatic blocking after N failed attempts
4. **Session Management** - Force logout of suspicious sessions
5. **Export** - CSV/JSON export for security audits
