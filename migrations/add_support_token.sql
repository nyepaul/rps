-- Add support_token and expires_at to password_reset_requests table
ALTER TABLE password_reset_requests ADD COLUMN support_token TEXT;
ALTER TABLE password_reset_requests ADD COLUMN expires_at TEXT;

-- Create index for faster lookup by token
CREATE INDEX idx_password_reset_requests_token ON password_reset_requests(support_token);
