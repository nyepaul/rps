"""Email service for sending transactional emails."""
import os
from flask import current_app
from flask_mail import Message
from src.extensions import mail


class EmailService:
    """Service for sending emails."""

    @staticmethod
    def send_password_reset_email(email: str, token: str, base_url: str = None):
        """Send password reset email with token link.

        Args:
            email: Recipient email address
            token: Password reset token
            base_url: Base URL of the application (e.g., http://localhost:5137)

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        # Determine base URL
        if not base_url:
            base_url = os.getenv('APP_BASE_URL', 'http://localhost:5137')

        # Generate reset link
        reset_link = f"{base_url}/account-recovery.html?token={token}"

        # Email subject
        subject = "RPS - Password Reset Request"

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
            msg = Message(
                subject=subject,
                recipients=[email],
                html=html_body,
                body=text_body
            )
            mail.send(msg)
            return True
        except Exception as e:
            print(f"Failed to send password reset email: {e}")
            return False

    @staticmethod
    def is_configured():
        """Check if email service is properly configured.

        Returns:
            bool: True if SMTP settings are configured
        """
        try:
            mail_username = current_app.config.get('MAIL_USERNAME')
            return bool(mail_username)
        except:
            return False
