-- Migration: Add enhanced audit log and configuration tables
-- Date: 2025-01-15

-- Create enhanced_audit_log table with comprehensive fields
CREATE TABLE IF NOT EXISTS enhanced_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Core audit fields
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    user_id INTEGER,
    details TEXT,
    status_code INTEGER,
    error_message TEXT,

    -- Request information
    ip_address TEXT,
    user_agent TEXT,
    request_method TEXT,
    request_endpoint TEXT,
    request_query TEXT,
    request_headers TEXT,
    request_size INTEGER,
    referrer TEXT,
    session_id TEXT,

    -- Geographic and device information
    geo_location TEXT,  -- JSON: {country, region, city, timezone}
    device_info TEXT,   -- JSON: {browser, os, device, mobile, etc}

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for common queries
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_user_id ON enhanced_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_action ON enhanced_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_created_at ON enhanced_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_ip_address ON enhanced_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_table_name ON enhanced_audit_log(table_name);

-- Create audit_config table for storing audit logging configuration
CREATE TABLE IF NOT EXISTS audit_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Only one config row
    config_data TEXT NOT NULL,  -- JSON configuration
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT OR IGNORE INTO audit_config (id, config_data, updated_at)
VALUES (1, '{"enabled": true, "collect": {"ip_address": true, "user_agent": true, "geo_location": true, "request_method": true, "request_endpoint": true, "request_headers": false, "request_body_size": true, "response_status": true, "session_id": true, "referrer": true, "device_info": true, "browser_info": true, "os_info": true, "login_attempts": true, "failed_actions": true}, "display": {"ip_address": true, "user_agent": true, "geo_location": true, "request_method": true, "request_endpoint": true, "request_headers": false, "request_body_size": true, "response_status": true, "session_id": false, "referrer": true, "device_info": true, "browser_info": true, "os_info": true, "login_attempts": true, "failed_actions": true}, "retention_days": 90, "log_read_operations": false, "sensitive_endpoints": ["/api/auth/login", "/api/auth/register", "/api/profiles", "/api/admin"]}', datetime('now'));
