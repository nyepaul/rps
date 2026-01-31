# Comprehensive Audit Logging System

## Overview

The RPS application features enterprise-grade audit logging with extensive data collection capabilities for security monitoring, compliance auditing, fraud detection, and user behavior analytics.

Version: 3.9.150
Location: `src/services/enhanced_audit_logger.py`

## Key Features

### 1. Narrative Generator (New)
**Human-Readable Timelines:**
- Converts raw audit logs into plain English stories.
- Accessible via the Admin User Timeline view.
- Summarizes complex sessions into clear events (e.g., "User logged in from New York, updated their profile, and ran 3 simulations before logging out.").
- Logic location: `src/services/audit_narrative_generator.py`.

### 2. Real Client IP Detection
**Behind Cloudflare proxy support:**
- Priority 1: `CF-Connecting-IP` (Cloudflare's real client IP)
- Priority 2: `X-Forwarded-For` (standard proxy header)
- Priority 3: `X-Real-IP` (alternative proxy header)
- Priority 4: `request.remote_addr` (fallback)

### 2. Cloudflare Metadata Collection
Captures comprehensive Cloudflare CDN data:
- **CF-Ray**: Unique request identifier for support/debugging
- **CF-IPCountry**: Two-letter country code
- **CF-Visitor**: Protocol information (http/https)
- **CF-Request-ID**: Internal Cloudflare request ID
- **CF-Cache-Status**: Cache hit/miss status
- **CDN-Loop**: Edge location identifier

### 3. Browser Fingerprinting
Unique browser/device identification:
- User agent hash (6-digit hash for consistent identification)
- Primary language (from Accept-Language header)
- Compression support (gzip, brotli)
- Connection type
- DNT (Do Not Track) header status
- Screen resolution (via custom headers: X-Screen-Width, X-Screen-Height)
- Timezone offset (via custom header: X-Timezone-Offset)
- Viewport size (via custom headers: X-Viewport-Width, X-Viewport-Height)

### 4. Risk Assessment & Security Scoring
**0-100 risk score with classification:**
- **Bot detection** (+30 points): Identifies automated browsers
- **Suspicious user agent** (+20 points): Missing or malformed user agents
- **Tor browser** (+40 points): Tor/Onion router detection
- **Automation tools** (+25 points): Selenium, Puppeteer, Headless Chrome, etc.

**Risk levels:**
- Low: 0-39 points
- Medium: 40-69 points
- High: 70-100 points

### 5. Session Metadata Tracking
Detailed session information:
- Session age (seconds and minutes since creation)
- Session data size (bytes)
- Authentication state (authenticated/anonymous)
- User ID and username
- Admin status detection

### 6. Device & Browser Information
Comprehensive device fingerprinting:
- Browser: Family and version (Chrome 120.0.0.0)
- Operating System: Family and version (Windows 11)
- Device: Type, brand, model
- Device classification: Mobile, tablet, PC, bot

### 7. Geolocation Data
IP-based geographic tracking:
- City, region, country
- Country code (2-letter)
- Timezone
- Enhanced with Cloudflare country data when available

### 8. Enhanced Request Tracking
Detailed HTTP request information:
- Method (GET, POST, PUT, DELETE, etc.)
- Endpoint and path
- Query string parameters
- Content type and content length
- Referrer URL
- Request scheme (http/https)
- Protocol version (HTTP/1.1, HTTP/2, etc.)
- Sec-Fetch-* headers for security context

## Advanced Logging Methods

### Change Tracking
```python
from src.services.enhanced_audit_logger import enhanced_audit_logger

# Track data changes with before/after snapshots
enhanced_audit_logger.log_data_change(
    action='UPDATE',
    table_name='profile',
    record_id=123,
    old_data={'name': 'John Doe', 'age': 30},
    new_data={'name': 'John Doe', 'age': 31},
    user_id=5
)
```

**Automatically captures:**
- Complete before/after data snapshots
- Field-level change detection
- Number of fields changed
- Specific values that changed

### Performance Monitoring
```python
# Track operation performance
enhanced_audit_logger.log_performance(
    action='ANALYSIS_RUN',
    duration_ms=1250.5,
    details={'simulation_count': 10000},
    status_code=200
)
```

**Performance classifications:**
- Fast: < 100ms
- Normal: 100-499ms
- Slow: 500-1999ms
- Very Slow: ≥ 2000ms

### Suspicious Pattern Detection
```python
# Detect security threats
patterns = enhanced_audit_logger.detect_suspicious_patterns(
    user_id=5,
    ip_address='203.0.113.45',
    minutes=5
)

for pattern in patterns:
    print(f"{pattern['type']}: {pattern['description']} (severity: {pattern['severity']})")
```

**Detected patterns:**
1. **Brute Force Attempts**: 5+ failed logins in 5 minutes (High severity)
2. **High Frequency Requests**: 100+ requests in 5 minutes (Medium severity)
3. **Repeated Failures**: 10+ failed actions in 5 minutes (Medium severity)
4. **Endpoint Scanning**: 20+ unique endpoints in 5 minutes (High severity)

## Data Storage

### Database Schema
All data stored in `enhanced_audit_log` table:
- Core fields: id, action, table_name, record_id, user_id, created_at
- Request data: ip_address, user_agent, request_method, request_endpoint
- Metadata: device_info (JSON), geo_location (JSON), request_headers (JSON)
- Performance: request_size, status_code, error_message
- Security: session_id, referrer

### JSON Field Structure

**device_info field:**
```json
{
  "browser": "Chrome",
  "browser_version": "120.0.0.0",
  "os": "Windows",
  "os_version": "11",
  "device": "Other",
  "is_mobile": false,
  "is_bot": false,
  "fingerprint": {
    "user_agent_hash": 123456,
    "primary_language": "en-US",
    "supports_compression": true,
    "dnt_enabled": false,
    "screen_resolution": "1920x1080",
    "timezone_offset": "-360"
  }
}
```

**geo_location field:**
```json
{
  "country": "United States",
  "country_code": "US",
  "region": "California",
  "city": "San Francisco",
  "timezone": "America/Los_Angeles",
  "cf_country_code": "US"
}
```

**request_headers field (with Cloudflare data):**
```json
{
  "accept": "text/html,application/xhtml+xml",
  "accept_language": "en-US,en;q=0.9",
  "origin": "https://rps.pan2.app",
  "cloudflare": {
    "cf_ray": "84b2f3a1c9e5c123-SFO",
    "cf_country": "US",
    "cf_connecting_ip": "203.0.113.45",
    "cf_cache_status": "HIT"
  }
}
```

**details field (with risk assessment):**
```json
{
  "action_details": "Profile updated successfully",
  "risk_assessment": {
    "score": 15,
    "level": "low",
    "factors": []
  },
  "session_metadata": {
    "session_age_seconds": 1205,
    "session_age_minutes": 20.08,
    "session_size_bytes": 387,
    "authenticated": true,
    "user_id": 5,
    "username": "johndoe",
    "is_admin": false
  }
}
```

## Configuration

### Default Settings
All features enabled by default with privacy safeguards:

```python
DEFAULT_CONFIG = {
    'enabled': True,
    'collect': {
        'ip_address': True,
        'user_agent': True,
        'geo_location': True,
        'device_info': True,
        'cloudflare_metadata': True,
        'browser_fingerprint': True,
        'risk_scoring': True,
        'session_metadata': True,
        'request_headers': False,  # Privacy: off by default
        'log_read_operations': False  # Reduces log volume
    },
    'display': {
        'session_id': False,  # Privacy: hide by default in UI
        # All other fields: True
    },
    'retention_days': 90
}
```

### Customizing Configuration
```python
from src.services.enhanced_audit_logger import AuditConfig

# Get current config
config = AuditConfig.get_config()

# Modify settings
config['collect']['request_headers'] = True
config['retention_days'] = 180

# Save updated config
AuditConfig.set_config(config)
```

## Compliance & Privacy

### GDPR Compliance
- Personal data encrypted at rest
- IP addresses can be anonymized (configurable)
- Session IDs truncated (first 8 chars only)
- User-configurable data retention
- Right to access/delete audit logs

### SOC 2 Compliance
- Comprehensive access logging
- Change tracking with before/after values
- Failed access attempt monitoring
- Session tracking
- Admin action logging
- Geolocation tracking

### Data Retention
- Default: 90 days
- Configurable per requirements
- Automatic cleanup (not yet implemented - TODO)

## Usage Examples

### Basic Logging
```python
from src.services.enhanced_audit_logger import enhanced_audit_logger

# Log any action
enhanced_audit_logger.log(
    action='LOGIN_SUCCESS',
    user_id=5,
    details='User logged in successfully',
    status_code=200
)
```

### Specialized Logging
```python
# Login attempts
enhanced_audit_logger.log_login_attempt(
    username='johndoe',
    success=False,
    error_message='Invalid password'
)

# CRUD operations
enhanced_audit_logger.log_create('profile', record_id=123, user_id=5)
enhanced_audit_logger.log_update('profile', record_id=123, user_id=5)
enhanced_audit_logger.log_delete('profile', record_id=123, user_id=5)

# Admin actions
enhanced_audit_logger.log_admin_action(
    action='USER_PASSWORD_RESET',
    details={'target_user_id': 10},
    user_id=1
)
```

### Querying Logs
```python
# Get recent logs with filtering
result = enhanced_audit_logger.get_logs(
    user_id=5,
    action='UPDATE',
    start_date='2026-01-01T00:00:00',
    limit=50,
    offset=0,
    sort_by='created_at',
    sort_direction='desc'
)

for log in result['logs']:
    print(f"{log['created_at']}: {log['action']} by {log['username']}")
    if 'cloudflare' in log:
        print(f"  CF-Ray: {log['cloudflare']['cf_ray']}")
    if 'risk_assessment' in log.get('details', {}):
        risk = log['details']['risk_assessment']
        print(f"  Risk: {risk['level']} ({risk['score']}/100)")
```

### Statistics & Analytics
```python
# Get audit statistics
stats = enhanced_audit_logger.get_statistics(days=30)

print(f"Total logs: {stats['total_logs']}")
print(f"Failed actions: {stats['failed_actions']}")
print(f"Unique IPs: {stats['unique_ips']}")
print(f"Top countries: {stats['by_country']}")
print(f"Actions by type: {stats['by_action']}")
```

## Performance Considerations

### Storage Impact
- Average log entry: ~2-5 KB
- 1,000 requests/day: ~2-5 MB/day
- 90-day retention: ~180-450 MB

### Query Performance
- Indexed fields: user_id, action, table_name, created_at, ip_address, status_code
- Use filters to reduce result sets
- Pagination recommended for large result sets
- Consider archiving old logs for long-term storage

### Network Impact
- Geolocation lookups cached
- Cloudflare headers add minimal overhead
- Browser fingerprinting is passive (no additional requests)

## Security Best Practices

1. **Regularly review logs** for suspicious patterns
2. **Set up alerts** for high-risk events (brute force, scanning)
3. **Monitor failed actions** for potential attacks
4. **Use Cloudflare metadata** for request tracing and debugging
5. **Enable request_headers collection** for sensitive endpoints only
6. **Rotate and archive logs** according to retention policy
7. **Encrypt audit logs** if storing sensitive data
8. **Restrict admin access** to audit log viewing

## Future Enhancements

- [ ] Automatic log archiving
- [ ] Real-time alerting for suspicious patterns
- [ ] Dashboard with audit log analytics
- [ ] Export to SIEM systems (Splunk, ELK)
- [ ] Advanced ML-based anomaly detection
- [ ] IP reputation scoring
- [ ] Automated response to threats
- [ ] Integration with external threat intelligence feeds

## Troubleshooting

### Geolocation not working
- Check internet connectivity
- Verify ip-api.com is accessible
- Internal/private IPs show as "Local"

### Cloudflare metadata missing
- Verify site is behind Cloudflare
- Check that Cloudflare is not stripping headers
- Ensure proxy headers are preserved in Apache/nginx config

### High log volume
- Disable `log_read_operations` if enabled
- Filter sensitive endpoints
- Reduce retention period
- Archive old logs

## Support

For issues or questions:
- GitHub: https://github.com/pan-systems/rps/issues
- Documentation: `/docs/`
- Admin Panel: https://rps.pan2.app/admin (Admin access required)

---

**Last Updated:** 2026-01-30
**Version:** 3.9.150
