# Cloudflare Configuration Guide

This guide provides step-by-step instructions for configuring Cloudflare to complement the application-level security fixes.

## Critical Configuration Required

### 1. Disable TLS 1.0 and TLS 1.1

**Priority**: CRITICAL
**Estimated Time**: 2 minutes

#### Steps:

1. **Log in to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com/
   - Enter your credentials

2. **Select Domain**
   - Click on **pan2.app** from your list of sites

3. **Navigate to SSL/TLS Settings**
   - In the left sidebar, click **SSL/TLS**
   - Click **Edge Certificates**

4. **Set Minimum TLS Version**
   - Scroll to "Minimum TLS Version"
   - Current setting: **TLS 1.0** ❌
   - Change to: **TLS 1.2** ✅
   - Click **Save**

5. **Verify Change**
   - Wait 1-2 minutes for propagation
   - Test with: `nmap --script ssl-enum-ciphers -p 443 rps.pan2.app`
   - Confirm only TLS 1.2 and 1.3 are listed

#### Expected Impact:

**Positive**:
- ✅ Eliminates known TLS vulnerabilities (BEAST, POODLE)
- ✅ Achieves PCI DSS compliance
- ✅ Improves security score
- ✅ Modern browsers unaffected

**Negative**:
- ⚠️ Very old devices may be incompatible:
  - Internet Explorer 10 and earlier
  - Android 4.3 and earlier
  - Windows XP SP3 (unless updated)
  - Java 7 and earlier

**Recommendation**: The security benefit far outweighs the minimal impact on legacy devices. Less than 0.5% of modern users will be affected.

---

## Optional but Recommended Configurations

### 2. Enable HSTS in Cloudflare (Defense-in-Depth)

**Priority**: High
**Estimated Time**: 5 minutes

While HSTS is now implemented in the application code, enabling it in Cloudflare provides an additional layer of protection.

#### Steps:

1. **Navigate to HSTS Settings**
   - Go to **SSL/TLS** → **Edge Certificates**
   - Scroll to "HTTP Strict Transport Security (HSTS)"

2. **Enable HSTS**
   - Click **Enable HSTS**

3. **Configure Settings**:
   ```
   Max Age Header (max-age): 12 months (31536000)
   Apply HSTS to subdomains: On
   Preload: Off (enable only if you plan to submit to preload list)
   No-Sniff Header: On
   ```

4. **Acknowledge Warning**
   - Read the warning about HSTS implications
   - Confirm you understand the setting
   - Click **Save**

#### HSTS Preload List (Optional)

If you want maximum HSTS protection:

1. **Meet Requirements**:
   - Valid HTTPS certificate
   - HSTS enabled with max-age ≥ 31536000
   - HSTS applies to all subdomains
   - No mixed content

2. **Submit to Preload List**:
   - Visit: https://hstspreload.org/
   - Enter domain: **pan2.app**
   - Click **Check HSTS preload status**
   - If eligible, submit for inclusion

3. **Wait for Inclusion**:
   - Can take several months
   - Once included, browsers will force HTTPS even on first visit
   - Very hard to reverse - use with caution

---

### 3. Configure Advanced Security Features

#### 3.1 Enable WAF (Web Application Firewall)

**Priority**: High
**Estimated Time**: 2 minutes

1. **Navigate to WAF**
   - Go to **Security** → **WAF**

2. **Enable Managed Rulesets**:
   - ✅ Cloudflare Managed Ruleset
   - ✅ Cloudflare OWASP Core Ruleset
   - ✅ Cloudflare Exposed Credentials Check

3. **Review Sensitivity**:
   - Set to **Medium** (default)
   - Adjust if you see false positives

#### 3.2 Add Rate Limiting Rules

**Priority**: Medium
**Estimated Time**: 5 minutes

Create rate limiting rules for authentication endpoints:

1. **Navigate to Rate Limiting**
   - Go to **Security** → **WAF** → **Rate limiting rules**
   - Click **Create rule**

2. **Login Endpoint Protection**:
   ```
   Rule name: Login endpoint protection

   If incoming requests match:
   - URI Path equals "/api/auth/login"

   Choose action: Block

   Duration: 15 minutes

   Requests: 20 requests
   Period: 10 minutes

   Characteristics:
   - IP Address
   ```

3. **Registration Endpoint Protection**:
   ```
   Rule name: Registration endpoint protection

   If incoming requests match:
   - URI Path equals "/api/auth/register"

   Choose action: Block

   Duration: 1 hour

   Requests: 5 requests
   Period: 1 hour

   Characteristics:
   - IP Address
   ```

4. **Deploy Rules**
   - Click **Deploy** for each rule

#### 3.3 Enable Bot Protection

**Priority**: Medium
**Estimated Time**: 2 minutes

1. **Navigate to Bot Management**
   - Go to **Security** → **Bots**

2. **Configure Bot Fight Mode** (Free tier):
   - Enable **Bot Fight Mode**
   - This will challenge suspected bots

3. **Super Bot Fight Mode** (Paid tiers):
   - Enable **Super Bot Fight Mode**
   - Configure actions:
     - Verified bots (Google, Bing): **Allow**
     - Likely automated: **Challenge**
     - Definitely automated: **Block**

---

### 4. Security Level Settings

#### 4.1 Adjust Security Level

**Priority**: Low
**Estimated Time**: 1 minute

1. **Navigate to Security Level**
   - Go to **Security** → **Settings**

2. **Set Security Level**:
   - **High**: Challenges visitors from regions with high threat scores
   - **Medium**: Default, balanced approach
   - **Low**: Only challenges most threatening visitors

   **Recommendation**: Start with **Medium**, increase to **High** if you see attacks

#### 4.2 Challenge Passage

**Priority**: Low

Configure how long challenges remain valid:
```
Challenge Passage: 30 minutes (default)
```

This determines how long a visitor can browse after solving a challenge.

---

### 5. SSL/TLS Mode Configuration

#### Verify SSL Mode

**Priority**: Critical
**Estimated Time**: 1 minute

1. **Navigate to SSL/TLS Overview**
   - Go to **SSL/TLS**

2. **Verify SSL/TLS Encryption Mode**:
   - Current mode should be: **Full (strict)** ✅
   - If not, change from **Flexible** or **Full** to **Full (strict)**

3. **Why Full (Strict)?**:
   - Encrypts traffic between visitor and Cloudflare
   - Encrypts traffic between Cloudflare and origin server
   - Validates origin server certificate
   - Best security configuration

---

### 6. Page Rules for Additional Security

#### Create Security Page Rules

**Priority**: Low
**Estimated Time**: 5 minutes

1. **Navigate to Page Rules**
   - Go to **Rules** → **Page Rules**

2. **Force HTTPS Redirect**:
   ```
   URL: http://rps.pan2.app/*
   Settings:
   - Always Use HTTPS: On
   ```

3. **Disable Caching for API**:
   ```
   URL: https://rps.pan2.app/api/*
   Settings:
   - Cache Level: Bypass
   - Security Level: High
   ```

4. **Save and Deploy**
   - Click **Save and Deploy**

---

### 7. DDoS Protection

#### Verify DDoS Protection is Active

**Priority**: Critical (Already enabled by default)

1. **Navigate to DDoS**
   - Go to **Security** → **DDoS**

2. **Verify HTTP DDoS Attack Protection**:
   - Should be **Enabled** by default
   - Sensitivity: **Medium**

3. **Configure Advanced DDoS**:
   - **L3/L4 DDoS Protection**: Automatic, always on
   - **HTTP DDoS Protection**: Enabled
   - **HTTP Rate Limiting**: Configured (see section 3.2)

---

## Monitoring and Alerts

### 8. Configure Security Alerts

**Priority**: Medium
**Estimated Time**: 5 minutes

1. **Navigate to Notifications**
   - Go to **Notifications** (top right bell icon)

2. **Add Notification**
   - Click **Add**

3. **Configure Alerts**:
   - ✅ Advanced Security Events
   - ✅ HTTP DDoS Attack Alert
   - ✅ SSL/TLS Certificate Expiration
   - ✅ Security Level Changes

4. **Delivery Method**:
   - Email: your-email@example.com
   - Webhook: (optional, for integration)

---

## Testing After Configuration

### Verify TLS Configuration
```bash
# Should only show TLS 1.2 and 1.3
nmap --script ssl-enum-ciphers -p 443 rps.pan2.app | grep TLS
```

### Verify HSTS Header
```bash
curl -sI https://rps.pan2.app/ | grep -i strict-transport

# Should show:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Test Rate Limiting
```bash
# Attempt 25 login requests in quick succession
for i in {1..25}; do
  curl -X POST "https://rps.pan2.app/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
  sleep 1
done

# After 20 requests, should see Cloudflare block page
```

### Verify WAF is Working
```bash
# Attempt SQL injection (should be blocked)
curl "https://rps.pan2.app/api/profiles?id=1' OR '1'='1"

# Should return Cloudflare error page or block
```

---

## Security Checklist

After completing all configurations, verify:

- [ ] TLS 1.0 and 1.1 disabled (minimum TLS 1.2)
- [ ] HSTS enabled in Cloudflare
- [ ] SSL/TLS mode set to "Full (strict)"
- [ ] WAF managed rulesets enabled
- [ ] Rate limiting rules created and deployed
- [ ] Bot protection enabled
- [ ] Security level set to Medium or High
- [ ] Page rules configured
- [ ] DDoS protection verified active
- [ ] Security notifications configured
- [ ] All tests passed

---

## Rollback Procedures

If you encounter issues after making changes:

### Rollback TLS 1.2 Requirement
1. Go to **SSL/TLS** → **Edge Certificates**
2. Set "Minimum TLS Version" back to **TLS 1.0**
3. Wait 2 minutes for propagation

### Disable HSTS
1. Go to **SSL/TLS** → **Edge Certificates**
2. Find HSTS section
3. Click **Disable HSTS**
4. Confirm action

**Note**: HSTS rollback takes effect immediately in Cloudflare, but browsers may cache HSTS for the max-age duration (up to 12 months if enabled).

### Disable Rate Limiting Rules
1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Find the rule
3. Click **...** → **Delete**
4. Confirm deletion

---

## Support and Documentation

### Cloudflare Documentation
- SSL/TLS: https://developers.cloudflare.com/ssl/
- WAF: https://developers.cloudflare.com/waf/
- Rate Limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/
- DDoS: https://developers.cloudflare.com/ddos-protection/

### Contact Cloudflare Support
- Free plan: Community forum
- Paid plans: Support tickets via dashboard
- Emergency: Priority support for Business/Enterprise

---

## Summary

**Critical Actions Required**:
1. ✅ Disable TLS 1.0 and 1.1 (set minimum to TLS 1.2)

**Recommended Actions**:
1. ⚠️ Enable HSTS in Cloudflare (defense-in-depth)
2. ⚠️ Configure rate limiting rules
3. ⚠️ Verify WAF is enabled
4. ⚠️ Enable bot protection
5. ⚠️ Configure security notifications

**Estimated Total Time**: 30-45 minutes

**Security Impact**: HIGH - Addresses critical vulnerabilities and provides comprehensive protection
