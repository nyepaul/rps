-- Migration: Add feedback_replies table for admin responses
-- Date: 2026-01-18
-- Description: Allow admins to reply to user feedback with public replies and private notes

-- Create feedback_replies table
CREATE TABLE IF NOT EXISTS feedback_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    reply_text TEXT NOT NULL,
    is_private BOOLEAN DEFAULT 0,  -- 0 = public (visible to user), 1 = private (admin only)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON feedback_replies(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_admin_id ON feedback_replies(admin_id);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_is_private ON feedback_replies(is_private);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_created_at ON feedback_replies(created_at);

-- Add tracking columns to feedback table
ALTER TABLE feedback ADD COLUMN email_sent BOOLEAN DEFAULT 0;  -- Reserved for future use
ALTER TABLE feedback ADD COLUMN last_reply_at TIMESTAMP;  -- Track when last reply was added
