# Email Configuration for Password Reset

RPS includes email-based password reset functionality. This guide explains how to configure email sending.

## Overview

The password reset feature allows users to reset their passwords by receiving a secure token via email. The system works in two modes:

1. **Development Mode** (no email config): Returns the reset token in the API response for testing
2. **Production Mode** (email configured): Sends a professional email with a reset link

## Email Configuration

### Environment Variables

Set the following environment variables to enable email sending:

```bash
# SMTP Server Settings
MAIL_SERVER=smtp.gmail.com          # Your SMTP server (default: smtp.gmail.com)
MAIL_PORT=587                       # SMTP port (default: 587 for TLS)
MAIL_USE_TLS=true                   # Use TLS encryption (default: true)
MAIL_USE_SSL=false                  # Use SSL encryption (default: false)

# Authentication
MAIL_USERNAME=your.email@gmail.com  # Your email address (REQUIRED)
MAIL_PASSWORD=your-app-password     # Your email password or app password (REQUIRED)

# Sender
MAIL_DEFAULT_SENDER=your.email@gmail.com  # Default sender (defaults to MAIL_USERNAME)

# Application
APP_BASE_URL=https://your-domain.com      # Base URL for reset links (default: http://localhost:5137)
```

### Gmail Configuration

If using Gmail, you'll need to create an **App Password**:

1. Enable 2-Step Verification on your Google Account
2. Go to Google Account Settings → Security → 2-Step Verification
3. Scroll to "App passwords" and click it
4. Select "Mail" and your device
5. Copy the generated 16-character password
6. Use this as your `MAIL_PASSWORD` (not your regular Gmail password)

Example for Gmail:
```bash
export MAIL_SERVER=smtp.gmail.com
export MAIL_PORT=587
export MAIL_USE_TLS=true
export MAIL_USERNAME=yourname@gmail.com
export MAIL_PASSWORD=abcd efgh ijkl mnop  # 16-character app password
export MAIL_DEFAULT_SENDER=yourname@gmail.com
export APP_BASE_URL=https://rps.yourdomain.com
```

### Other Email Providers

#### SendGrid
```bash
export MAIL_SERVER=smtp.sendgrid.net
export MAIL_PORT=587
export MAIL_USERNAME=apikey
export MAIL_PASSWORD=your-sendgrid-api-key
```

#### Mailgun
```bash
export MAIL_SERVER=smtp.mailgun.org
export MAIL_PORT=587
export MAIL_USERNAME=postmaster@your-domain.mailgun.org
export MAIL_PASSWORD=your-mailgun-password
```

#### AWS SES
```bash
export MAIL_SERVER=email-smtp.us-east-1.amazonaws.com
export MAIL_PORT=587
export MAIL_USERNAME=your-ses-smtp-username
export MAIL_PASSWORD=your-ses-smtp-password
```

#### Office 365 / Outlook
```bash
export MAIL_SERVER=smtp.office365.com
export MAIL_PORT=587
export MAIL_USERNAME=your.email@outlook.com
export MAIL_PASSWORD=your-password
```

## Setting Environment Variables

### Linux/Mac (Development)
Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export MAIL_SERVER=smtp.gmail.com
export MAIL_USERNAME=yourname@gmail.com
export MAIL_PASSWORD=your-app-password
export APP_BASE_URL=http://localhost:5137
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

### Linux/Mac (Production with systemd)
Create `/etc/systemd/system/rps.service.d/email.conf`:
```ini
[Service]
Environment="MAIL_SERVER=smtp.gmail.com"
Environment="MAIL_USERNAME=yourname@gmail.com"
Environment="MAIL_PASSWORD=your-app-password"
Environment="APP_BASE_URL=https://rps.yourdomain.com"
```

Then reload systemd: `sudo systemctl daemon-reload && sudo systemctl restart rps`

### Docker
Add to your `docker-compose.yml`:
```yaml
services:
  rps:
    environment:
      - MAIL_SERVER=smtp.gmail.com
      - MAIL_USERNAME=yourname@gmail.com
      - MAIL_PASSWORD=your-app-password
      - APP_BASE_URL=https://rps.yourdomain.com
```

Or use an `.env` file:
```bash
MAIL_SERVER=smtp.gmail.com
MAIL_USERNAME=yourname@gmail.com
MAIL_PASSWORD=your-app-password
APP_BASE_URL=https://rps.yourdomain.com
```

## Testing Email Configuration

### 1. Test in Development Mode

Without email configuration, the system will return the reset token in the response:

1. Go to http://localhost:5137/forgot-password.html
2. Enter an email address
3. The response will include a clickable reset link
4. Click the link to test the reset flow

### 2. Test with Email Configuration

With email configured:

1. Set the environment variables
2. Restart the application
3. Go to /forgot-password.html
4. Enter your email address
5. Check your inbox for the password reset email
6. Click the link in the email
7. Enter your new password

### 3. Verify Email Sending

Check the application logs for email sending confirmation:
```bash
tail -f logs/app.log
```

Look for messages like:
- "Failed to send password reset email: [error]" (if failed)
- No error means success!

## Email Template

The password reset email includes:

- Professional HTML formatting with your app branding
- Clear call-to-action button
- Clickable reset link
- Security warnings about data loss
- 1-hour expiration notice
- Plain text fallback for email clients

## Security Features

1. **Token Expiration**: Tokens expire after 1 hour
2. **One-time Use**: Tokens are cleared after password reset
3. **Email Enumeration Protection**: Always returns success message
4. **Rate Limiting**: 3 requests per hour per IP
5. **Data Loss Warning**: Users are warned about encrypted data loss

## Troubleshooting

### Email not received

1. Check spam/junk folder
2. Verify environment variables are set: `printenv | grep MAIL`
3. Check application logs for errors
4. Test SMTP connection manually:
   ```bash
   python3 -c "
   import smtplib
   server = smtplib.SMTP('smtp.gmail.com', 587)
   server.starttls()
   server.login('your-email@gmail.com', 'your-app-password')
   print('SUCCESS')
   "
   ```

### "Failed to send email" errors

- **Authentication failed**: Check username/password
- **Connection refused**: Check MAIL_SERVER and MAIL_PORT
- **TLS errors**: Verify MAIL_USE_TLS setting
- **Blocked by provider**: Some providers block automated emails

### Gmail "Less secure app" error

Gmail no longer supports "less secure apps". You MUST use an **App Password** with 2-Step Verification enabled.

## Production Considerations

1. **Use App Passwords**: Never use your main email password
2. **Set APP_BASE_URL**: Ensure reset links point to your domain
3. **Monitor Rate Limits**: Track failed login attempts
4. **Configure SPF/DKIM**: If using custom domain
5. **Use Dedicated Email Service**: Consider SendGrid, Mailgun, or AWS SES for reliability

## Development Mode

If no email configuration is provided, the system automatically enters development mode:

- Reset tokens are returned in the API response
- A clickable link is displayed on the forgot-password page
- This allows testing without email setup
- **Never use in production!**

To disable development mode, simply configure the email settings.
