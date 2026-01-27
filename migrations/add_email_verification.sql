-- Add email verification fields
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT;
