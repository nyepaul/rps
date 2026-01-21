ALTER TABLE users ADD COLUMN recovery_encrypted_dek TEXT;
ALTER TABLE users ADD COLUMN recovery_iv TEXT;
ALTER TABLE users ADD COLUMN recovery_salt TEXT;
