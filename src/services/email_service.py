"""Email service for sending transactional emails."""

import os
from datetime import datetime
from flask import current_app
from flask_mail import Message
from src.extensions import mail


class EmailService:
    """Service for sending emails."""

    @staticmethod
    def send_verification_email(email: str, token: str, base_url: str = None):
        """Send email verification link.

        Args:
            email: Recipient email address
            token: Verification token
            base_url: Base URL of the application

        Returns:
            bool: True if email sent successfully
        """
        if not base_url:
            base_url = current_app.config.get("APP_BASE_URL") or os.getenv("APP_BASE_URL", "https://rps.pan2.app")

        verification_link = f"{base_url}/verify-email.html?token={token}"
        subject = "Account Verification"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333; padding: 20px;">
            <h3>Verify your account</h3>
            <p>Please click the link below to verify your email address:</p>
            <p><a href="{verification_link}" style="color: #2563eb; font-weight: bold;">{verification_link}</a></p>
            <p>If the link doesn't work, copy and paste it into your browser.</p>
            <p>This link will expire in 24 hours.</p>
        </body>
        </html>
        """

        text_body = f"Please verify your email address by clicking this link:\n\n{verification_link}\n\nThis link expires in 24 hours."

        # Always log to a local file for development/debugging
        try:
            from src.config import Config
            log_path = os.path.join(Config.DATA_DIR, "sent_emails.log")
            with open(log_path, "a") as f:
                f.write(f"--- {datetime.now().isoformat()} ---\n")
                f.write(f"To: {email}\n")
                f.write(f"Subject: {subject}\n")
                f.write(f"Link: {verification_link}\n")
                f.write(f"-----------------------------------\n\n")
        except Exception as log_ex:
            print(f"Failed to log email to file: {log_ex}")

        # Logging for development and troubleshooting
        print(f"DEBUG: Verification link for {email}: {verification_link}")
        try:
            from src.services.enhanced_audit_logger import enhanced_audit_logger
            enhanced_audit_logger.log(
                action="EMAIL_VERIFICATION_GENERATED",
                details={
                    "email": email,
                    "link": verification_link,
                    "info": "Link logged to server for recovery in case of email delivery failure."
                }
            )
        except:
            pass

        try:
            # Try standard Flask-Mail (SMTP) first
            msg = Message(
                subject=subject, recipients=[email], html=html_body, body=text_body
            )
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Flask-Mail SMTP failed: {e}")
            # Fallback to local sendmail binary
            try:
                import subprocess
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart

                sender = current_app.config.get("MAIL_DEFAULT_SENDER", "rps@pan2.app")
                mime_msg = MIMEMultipart("alternative")
                mime_msg["Subject"] = subject
                mime_msg["From"] = sender
                mime_msg["To"] = email
                mime_msg.attach(MIMEText(text_body, "plain"))
                mime_msg.attach(MIMEText(html_body, "html"))

                process = subprocess.Popen(
                    ["/usr/sbin/sendmail", "-t", "-f", sender], stdin=subprocess.PIPE
                )
                process.communicate(input=mime_msg.as_bytes())
                return process.returncode == 0
            except Exception as ex:
                print(f"Sendmail fallback failed: {ex}")
                return False

    @staticmethod
    def send_password_reset_email(email: str, token: str, base_url: str = None):
        """Send password reset email with token link.

        Args:
            email: Recipient email address
            token: Password reset token
            base_url: Base URL of the application (e.g., https://rps.pan2.app)

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        # Determine base URL
        if not base_url:
            base_url = current_app.config.get("APP_BASE_URL") or os.getenv("APP_BASE_URL", "https://rps.pan2.app")

        # Generate reset link
        reset_link = f"{base_url}/account-recovery.html?token={token}"

        # Email subject
        subject = "RPS - Password Reset Request"

        # Always log to a local file for development/debugging
        try:
            from src.config import Config
            log_path = os.path.join(Config.DATA_DIR, "sent_emails.log")
            with open(log_path, "a") as f:
                f.write(f"--- {datetime.now().isoformat()} ---\n")
                f.write(f"To: {email}\n")
                f.write(f"Subject: {subject}\n")
                f.write(f"Link: {reset_link}\n")
                f.write(f"-----------------------------------\n\n")
        except Exception as log_ex:
            print(f"Failed to log reset email to file: {log_ex}")

        # Email body (HTML)
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background: #ffffff;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .header h1 {{
                    color: #2563eb;
                    margin: 0;
                    font-size: 24px;
                }}
                .content {{
                    margin-bottom: 30px;
                }}
                .button {{
                    display: inline-block;
                    background: #2563eb;
                    color: #ffffff !important;
                    text-decoration: none;
                    padding: 12px 30px;
                    border-radius: 6px;
                    font-weight: 600;
                    text-align: center;
                }}
                .button:hover {{
                    background: #1d4ed8;
                }}
                .footer {{
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 14px;
                    color: #6b7280;
                    text-align: center;
                }}
                .warning {{
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
                .token-info {{
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 14px;
                    margin: 15px 0;
                    word-break: break-all;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset Request</h1>
                </div>

                <div class="content">
                    <p>Hello,</p>

                    <p>We received a request to reset the password for your RPS account.</p>

                    <p>Click the button below to reset your password:</p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </div>

                    <p>Or copy and paste this link into your browser:</p>
                    <div class="token-info">
                        {reset_link}
                    </div>

                    <div class="warning">
                        <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
                    </div>

                    <p><strong>Note:</strong> Because RPS uses end-to-end encryption, resetting your password via email will permanently delete your encrypted profile data <strong>UNLESS</strong> you use a Recovery Code or have previously enabled email-based backup.</p>

                    <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                </div>

                <div class="footer">
                    <p>This is an automated email from RPS Retirement Planning System.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Plain text version
        text_body = f"""
        Password Reset Request

        We received a request to reset the password for your RPS account.

        Click the link below to reset your password:
        {reset_link}

        This link will expire in 1 hour for security reasons.

        IMPORTANT: Because RPS uses end-to-end encryption, resetting your password via email will permanently delete your encrypted profile data UNLESS you use a Recovery Code or have previously enabled email-based backup.

        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

        ---
        This is an automated email from RPS Retirement Planning System.
        Please do not reply to this email.
        """

        try:
            # Try standard Flask-Mail (SMTP) first
            msg = Message(
                subject=subject, recipients=[email], html=html_body, body=text_body
            )
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Flask-Mail SMTP failed: {e}")

            # Fallback: Try direct local sendmail binary if on localhost
            # This bypasses SMTP/TLS issues common with local Postfix configurations
            server = current_app.config.get("MAIL_SERVER")
            if server in ["localhost", "127.0.0.1"]:
                try:
                    print("Attempting fallback to local sendmail binary...")
                    import subprocess
                    from email.mime.text import MIMEText
                    from email.mime.multipart import MIMEMultipart

                    sender = current_app.config.get(
                        "MAIL_DEFAULT_SENDER", "rps@pan2.app"
                    )

                    mime_msg = MIMEMultipart("alternative")
                    mime_msg["Subject"] = subject
                    mime_msg["From"] = sender
                    mime_msg["To"] = email

                    part1 = MIMEText(text_body, "plain")
                    part2 = MIMEText(html_body, "html")
                    mime_msg.attach(part1)
                    mime_msg.attach(part2)

                    process = subprocess.Popen(
                        ["/usr/sbin/sendmail", "-t", "-f", sender],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                    )
                    stdout, stderr = process.communicate(input=mime_msg.as_bytes())

                    if process.returncode == 0:
                        print("Fallback to sendmail binary succeeded.")
                        return True
                    else:
                        print(f"Sendmail binary failed: {stderr.decode()}")
                except Exception as ex:
                    print(f"Sendmail fallback exception: {ex}")

            return False

    @staticmethod
    def is_configured():
        """Check if email service is properly configured.

        Returns:
            bool: True if SMTP settings are configured
        """
        try:
            mail_username = current_app.config.get("MAIL_USERNAME")
            return bool(mail_username)
        except:
            return False

    @staticmethod
    def send_new_account_notification(username: str, email: str, base_url: str = None):
        """Send notification to super admins when a new account is created.

        Args:
            username: The new user's username
            email: The new user's email address
            base_url: Base URL of the application

        Returns:
            bool: True if at least one email was sent successfully
        """
        from src.auth.models import User
        from datetime import datetime

        if not base_url:
            base_url = current_app.config.get("APP_BASE_URL") or os.getenv("APP_BASE_URL", "https://rps.pan2.app")

        # Get all super admin emails, excluding .local domains
        super_admin_emails = [
            email
            for email in User.get_super_admin_emails()
            if not email.lower().endswith(".local")
        ]
        if not super_admin_emails:
            print("No super admins configured to receive new account notifications")
            return False

        subject = f"RPS - New Account Created: {username}"
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">New Account Created</h2>
                <p>A new user has registered on RPS:</p>
                <table style="border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Username:</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Email:</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Created:</td>
                        <td style="padding: 8px;">{created_at}</td>
                    </tr>
                </table>
                <p style="color: #6b7280; font-size: 14px;">
                    This is an automated notification. The user must verify their email before they can log in.
                </p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <a href="{base_url}/admin.html" style="color: #2563eb; text-decoration: none;">View Admin Panel</a>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""New Account Created

A new user has registered on RPS:

Username: {username}
Email: {email}
Created: {created_at}

This is an automated notification. The user must verify their email before they can log in.

Admin Panel: {base_url}/admin.html
"""

        any_sent = False
        for admin_email in super_admin_emails:
            try:
                # Try standard Flask-Mail (SMTP) first
                msg = Message(
                    subject=subject,
                    recipients=[admin_email],
                    html=html_body,
                    body=text_body,
                )
                mail.send(msg)
                any_sent = True
            except Exception as e:
                print(f"Flask-Mail SMTP failed for {admin_email}: {e}")
                # Fallback to local sendmail binary
                try:
                    import subprocess
                    from email.mime.text import MIMEText
                    from email.mime.multipart import MIMEMultipart

                    sender = current_app.config.get(
                        "MAIL_DEFAULT_SENDER", "rps@pan2.app"
                    )
                    mime_msg = MIMEMultipart("alternative")
                    mime_msg["Subject"] = subject
                    mime_msg["From"] = sender
                    mime_msg["To"] = admin_email
                    mime_msg.attach(MIMEText(text_body, "plain"))
                    mime_msg.attach(MIMEText(html_body, "html"))

                    process = subprocess.Popen(
                        ["/usr/sbin/sendmail", "-t", "-f", sender], stdin=subprocess.PIPE
                    )
                    process.communicate(input=mime_msg.as_bytes())
                    if process.returncode == 0:
                        any_sent = True
                except Exception as ex:
                    print(f"Sendmail fallback failed for {admin_email}: {ex}")

        return any_sent
