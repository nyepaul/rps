ALTER TABLE users ADD COLUMN email_encrypted_dek TEXT;
ALTER TABLE users ADD COLUMN email_iv TEXT;
ALTER TABLE users ADD COLUMN email_salt TEXT;
