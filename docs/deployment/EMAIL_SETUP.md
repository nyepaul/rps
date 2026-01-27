# Email Configuration for RPS

RPS includes secure email delivery for account verification and password recovery. This guide explains how to configure email sending for various environments.

## Overview

Email is used for:
1. **Account Verification**: New users must verify their email before they can log in.
2. **Password Recovery**: Secure reset links (JWT-based) are sent via email.
3. **Data Recovery Backup**: An encrypted backup of the user's data key is protected by a key derived from their verified email.

## Recommended: Local Relay (Postfix)

For production environments (like `pan2.app`), the recommended setup is a local Postfix relay that handles delivery.

### configuration

Set these environment variables in your systemd `env.conf`:

```ini
# Security Keys
Environment="SECRET_KEY=..."
Environment="ENCRYPTION_KEY=..."
Environment="BACKUP_KEY_PEPPER=..."

# Local Email relay
Environment="MAIL_SERVER=127.0.0.1"
Environment="MAIL_PORT=25"
Environment="MAIL_USE_TLS=false"
Environment="MAIL_USE_SSL=false"
Environment="MAIL_DEFAULT_SENDER=rps@pan2.app"
Environment="APP_BASE_URL=https://rps.pan2.app"
```

### Benefits of Local Relay
- **Binary Fallback**: RPS automatically falls back to the `/usr/sbin/sendmail` binary if the SMTP connection to localhost fails.
- **Improved Deliverability**: Properly configured SPF and DMARC records on your domain ensure high inbox placement.

## Alternative: External SMTP (Gmail, etc.)

### Gmail Configuration

If using Gmail directly, you'll need to create an **App Password**:

1. Enable 2-Step Verification on your Google Account.
2. Create an App Password for "Mail".
3. Use the following configuration:

```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=yourname@gmail.com
MAIL_PASSWORD=abcd efgh ijkl mnop  # 16-character app password
MAIL_DEFAULT_SENDER=yourname@gmail.com
APP_BASE_URL=https://rps.yourdomain.com
```

## Security Features

1. **Signed JWT Tokens**: Password reset and verification tokens are stateful, signed JWTs. They cannot be forged and expire automatically.
2. **Mandatory Verification**: New accounts are created in an unverified state (`email_verified=0`) and must be activated via email.
3. **Admin-Assisted Recovery**: If email delivery fails, users can generate a "Support Token" for manual verification by a system administrator.
4. **Data Key Pepper**: Email-based recovery keys use a server-side `BACKUP_KEY_PEPPER` to prevent offline brute-force attacks on leaked databases.

## Troubleshooting

### Verify Local Delivery
Check if Postfix is accepting mail:
```bash
echo "Test mail" | mail -s "Test Subject" your-email@gmail.com
```

### Application Logs
Check the application logs for delivery errors:
```bash
tail -f /var/www/rps.pan2.app/logs/rps.log
```

Look for "Flask-Mail SMTP failed" or "Sendmail fallback failed".

### CSP Blocking
RPS enforces a strict Content Security Policy. Ensure that all JavaScript logic is in external files (`/js/*.js`). Inline scripts will be blocked by the browser.