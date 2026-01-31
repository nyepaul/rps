# IP Address and Geolocation Logging

**Last Updated:** 2026-01-20 (v3.8.75)

## Overview

The RPS application automatically captures IP addresses and geolocation data for all user sessions and network access. This data is used for security monitoring, analytics, and the Admin IP Locations Map feature.

## What is Logged

### Automatic Logging Events

The following events automatically capture IP address and geolocation:

1. **NETWORK_ACCESS** - Every API request (except static assets)
   - Logged in: `src/app.py:log_network_access()`
   - Captures: IP, geolocation, user_agent, device info
   - Frequency: Every request
   - Status: ✅ Enabled

2. **LOGIN_SUCCESS** - Successful user login
   - Logged in: `src/auth/routes.py:login()`
   - Captures: IP, geolocation, username, user_id
   - Status: ✅ Enabled

3. **LOGIN_FAILED** - Failed login attempt
   - Logged in: `src/auth/routes.py:login()`
   - Captures: IP, geolocation, attempted username, reason
   - Status: ✅ Enabled

4. **USER_LOGOUT** - User logout
   - Logged in: `src/auth/routes.py:logout()`
   - Captures: IP, geolocation, username, user_id
   - Status: ✅ Enabled

### Data Captured

For each event, the following geolocation data is captured:

```json
{
  "ip_address": "46.110.80.107",
  "geo_location": {
    "country": "United States",
    "country_code": "US",
    "region": "Iowa",
    "city": "Ankeny",
    "timezone": "America/Chicago",
    "lat": 41.7136,
    "lon": -93.6221,
    "cf_country_code": "US"
  },
  "user_agent": "Mozilla/5.0 ...",
  "device_info": {
    "browser": "Chrome",
    "browser_version": "120.0",
    "os": "Windows",
    "os_version": "10",
    "device": "PC",
    "is_mobile": false,
    "is_bot": false
  }
}
```

## Configuration

### Geolocation Collection

Geolocation collection is **enabled by default** and configured in:
- `src/services/enhanced_audit_logger.py:AuditConfig`

```python
DEFAULT_CONFIG = {
    'enabled': True,
    'collect': {
        'ip_address': True,      # ✅ Enabled
        'geo_location': True,    # ✅ Enabled - includes lat/lon
        'user_agent': True,      # ✅ Enabled
        'device_info': True,     # ✅ Enabled
        # ... other fields
    }
}
```

### Geolocation Provider

- **Provider:** ip-api.com (free tier)
- **Rate Limit:** 45 requests/minute
- **Timeout:** 2 seconds
- **Caching:** 24 hours per IP
- **Cache Location:** In-memory (`_geo_cache` dictionary)

### Cache Behavior

To prevent hitting rate limits and improve performance:

1. **First Request:** IP → API lookup → Cache result (24h TTL)
2. **Subsequent Requests:** IP → Return cached result (instant)
3. **After 24 Hours:** IP → API lookup → Update cache

This means:
- Same IP can make unlimited requests without hitting rate limits
- Geolocation updates daily if IP moves
- API calls reduced by ~99% for returning users

## Viewing Geolocation Data

### Admin Dashboard

Navigate to **Admin > Logs** to view:

1. **Logs Table** - All audit logs with IP and location
   - Columns: Timestamp, User, Action, IP Address, Location
   - Filter by: User, Action, Date Range, IP Address
   - Click IP address to see details

2. **IP Locations Map** - Visual map of all unique IPs
   - Click **"📍 View Locations"** button
   - Shows all unique IP locations from entire audit history
   - Marker size = access frequency
   - Click marker for IP details

### API Endpoints

- `GET /api/admin/logs` - Get audit logs (paginated, max 500)
- `GET /api/admin/logs/ip-locations` - Get all unique IP locations

## Technical Details

### IP Address Detection

The system detects the real client IP by checking (in order):

1. `CF-Connecting-IP` header (Cloudflare)
2. `X-Forwarded-For` header (proxy)
3. `X-Real-IP` header (nginx)
4. `request.remote_addr` (direct connection)

This ensures accurate IP detection behind proxies and CDNs.

### Cloudflare Enhancement

When behind Cloudflare, additional metadata is captured:

- `CF-IPCountry` - Country code from Cloudflare
- `CF-Ray` - Request trace ID
- `CF-Cache-Status` - Cache hit/miss status

### Local/Private IPs

Local and private IPs are handled specially:

- `127.0.0.1`, `localhost`, `::1` → Location: "Local"
- No external API call
- Cached indefinitely

## Data Retention

Geolocation data is retained according to audit log retention policy:

- **Default Retention:** 90 days
- **Configurable:** 1-3650 days (1 day to 10 years)
- **Configuration:** Admin Dashboard > Audit Settings

## Privacy Considerations

### What is NOT Logged

- Session check requests (`/api/auth/session`)
- Static asset requests (CSS, JS, images, fonts)
- Internal health checks

### Data Security

- Geolocation data stored in SQLite database
- Database encrypted at rest (if configured)
- Access restricted to admin users
- Audit logging for all data access

## Troubleshooting

### Geolocation Not Appearing

**Symptoms:** New logs show IP but no location data

**Possible Causes:**
1. Rate limit exceeded (45 requests/minute)
2. ip-api.com API timeout or error
3. Network connectivity issue
4. Invalid IP address format

**Solution:**
- Check application logs for "Geo-location lookup failed"
- Wait 1 minute and retry
- Geolocation will be retried on next request

### Old Logs Missing Coordinates

**Symptoms:** Old logs have city/region but no map marker

**Cause:** Lat/lon coordinates were added in recent update

**Solution:** Run the backfill script:
```bash
cd /var/www/rps.pan2.app
sudo ./venv/bin/python scripts/backfill_geolocation_coordinates.py
```

This will add coordinates to all historical logs with geolocation data.

## Performance

### Cache Statistics (Typical)

- **Cache Hit Rate:** ~95%+ for returning users
- **Cache Size:** ~100-500 IPs (depends on user base)
- **Memory Usage:** <1 MB
- **API Calls:** 1 per unique IP per day

### Rate Limit Protection

With caching enabled:
- **Without Cache:** 1 API call per request → 60 requests = rate limit in 80 seconds
- **With Cache:** 1 API call per unique IP per day → Virtually unlimited

## Future Enhancements

Potential future improvements:

1. **Persistent Cache** - Store cache in Redis/database
2. **Batch Lookups** - Lookup multiple IPs in single request
3. **Alternative Provider** - Consider modern MaxMind GeoIP2 integration (requires subscription)
4. **Privacy Mode** - Optional geolocation disable per user
5. **Anonymization** - Hash IPs for privacy-conscious deployments

## Version History

- **v3.8.75** - Added 24-hour geolocation caching
- **v3.8.74** - Added backfill script for historical data
- **v3.8.73** - Added dedicated IP locations endpoint
- **v3.8.65** - Initial IP location mapping feature
- **v3.8.60** - Added lat/lon coordinates to geolocation

## References

- [ip-api.com Documentation](http://ip-api.com/docs/)
- [Cloudflare Headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/)
- [Enhanced Audit Logger](../src/services/enhanced_audit_logger.py)
