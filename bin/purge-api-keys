#!/bin/bash

# Script to purge API keys from existing database files

echo "========================================="
echo "  API Key Purge Script"
echo "========================================="
echo ""

DB_FILE="webapp/data/planning.db"

if [ ! -f "$DB_FILE" ]; then
    echo "No database file found at $DB_FILE"
    echo "✓ Nothing to purge"
    exit 0
fi

echo "Found database: $DB_FILE"
echo "Checking for API keys in system_settings table..."
echo ""

# Check if system_settings table exists and has API key rows
KEY_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM system_settings WHERE key IN ('gemini_api_key', 'claude_api_key');" 2>/dev/null || echo "0")

if [ "$KEY_COUNT" = "0" ]; then
    echo "✓ No API keys found in database"
    exit 0
fi

echo "Found $KEY_COUNT API key entries"
echo ""
read -p "Delete these API keys from the database? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Purge cancelled"
    exit 0
fi

# Create backup first
BACKUP_FILE="${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$DB_FILE" "$BACKUP_FILE"
echo "✓ Created backup: $BACKUP_FILE"

# Remove API keys
sqlite3 "$DB_FILE" "DELETE FROM system_settings WHERE key = 'gemini_api_key';"
sqlite3 "$DB_FILE" "DELETE FROM system_settings WHERE key = 'claude_api_key';"

# Verify deletion
REMAINING=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM system_settings WHERE key IN ('gemini_api_key', 'claude_api_key');")

if [ "$REMAINING" = "0" ]; then
    echo "✓ API keys successfully removed from database"
    echo ""
    echo "Note: API keys should now be set via environment variables"
    echo "Run: ./setup-api-keys.sh"
else
    echo "✗ Failed to remove API keys"
    exit 1
fi
