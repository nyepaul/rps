import os
import sys
from flask import Flask
from src.services.email_service import EmailService
from src.extensions import mail
from src.config import config

def test_email(recipient):
    app = Flask(__name__)
    app.config.from_object(config['development'])
    
    # Initialize mail extension
    mail.init_app(app)
    
    with app.app_context():
        print(f"Testing email delivery to {recipient}...")
        print(f"MAIL_SERVER: {app.config.get('MAIL_SERVER')}")
        print(f"MAIL_PORT: {app.config.get('MAIL_PORT')}")
        print(f"MAIL_USE_TLS: {app.config.get('MAIL_USE_TLS')}")
        print(f"MAIL_USE_SSL: {app.config.get('MAIL_USE_SSL')}")
        print(f"MAIL_USERNAME: {app.config.get('MAIL_USERNAME')}")
        print(f"MAIL_DEFAULT_SENDER: {app.config.get('MAIL_DEFAULT_SENDER')}")
        
        success = EmailService.send_verification_email(recipient, "test-token-123")
        if success:
            print("✓ EmailService reported SUCCESS")
        else:
            print("✗ EmailService reported FAILURE")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_email.py <recipient_email>")
        sys.exit(1)
    test_email(sys.argv[1])
