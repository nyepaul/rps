#!/bin/bash

# Setup script for configuring API keys as environment variables
# This script will prompt for API keys and update your shell configuration

set -e

echo "========================================="
echo "  API Key Configuration Setup"
echo "========================================="
echo ""
echo "This script will configure your AI provider API keys as environment variables."
echo "The keys will be added to your shell configuration file for persistence."
echo ""

# Detect shell and config file
SHELL_NAME=$(basename "$SHELL")
if [ "$SHELL_NAME" = "zsh" ]; then
    CONFIG_FILE="$HOME/.zshrc"
elif [ "$SHELL_NAME" = "bash" ]; then
    if [ -f "$HOME/.bash_profile" ]; then
        CONFIG_FILE="$HOME/.bash_profile"
    else
        CONFIG_FILE="$HOME/.bashrc"
    fi
else
    echo "⚠️  Unknown shell: $SHELL_NAME"
    echo "Please manually add the following lines to your shell config:"
    CONFIG_FILE=""
fi

if [ -n "$CONFIG_FILE" ]; then
    echo "Detected shell: $SHELL_NAME"
    echo "Configuration file: $CONFIG_FILE"
    echo ""
fi

# Function to prompt for API key
prompt_for_key() {
    local key_name=$1
    local key_description=$2
    local current_value=$3

    echo "----------------------------------------"
    echo "$key_description"
    if [ -n "$current_value" ]; then
        echo "Current value: ${current_value:0:10}... (exists)"
    else
        echo "Current value: (not set)"
    fi
    echo ""

    read -p "Enter new $key_name (or press Enter to skip): " new_value
    echo "$new_value"
}

# Prompt for Gemini API Key
echo "========================================="
echo "1. Google Gemini API Key"
echo "========================================="
CURRENT_GEMINI="${GEMINI_API_KEY:-}"
NEW_GEMINI=$(prompt_for_key "GEMINI_API_KEY" "Get your key from: https://makersuite.google.com/app/apikey" "$CURRENT_GEMINI")

# Prompt for Anthropic API Key
echo ""
echo "========================================="
echo "2. Anthropic (Claude) API Key"
echo "========================================="
CURRENT_ANTHROPIC="${ANTHROPIC_API_KEY:-}"
NEW_ANTHROPIC=$(prompt_for_key "ANTHROPIC_API_KEY" "Get your key from: https://console.anthropic.com/" "$CURRENT_ANTHROPIC")

echo ""
echo "========================================="
echo "Summary"
echo "========================================="

if [ -z "$NEW_GEMINI" ] && [ -z "$NEW_ANTHROPIC" ]; then
    echo "No API keys provided. Exiting."
    exit 0
fi

if [ -n "$NEW_GEMINI" ]; then
    echo "✓ GEMINI_API_KEY will be configured"
fi

if [ -n "$NEW_ANTHROPIC" ]; then
    echo "✓ ANTHROPIC_API_KEY will be configured"
fi

echo ""
read -p "Continue with configuration? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Configuration cancelled."
    exit 0
fi

# Export for current session
if [ -n "$NEW_GEMINI" ]; then
    export GEMINI_API_KEY="$NEW_GEMINI"
    echo "✓ Exported GEMINI_API_KEY for current session"
fi

if [ -n "$NEW_ANTHROPIC" ]; then
    export ANTHROPIC_API_KEY="$NEW_ANTHROPIC"
    echo "✓ Exported ANTHROPIC_API_KEY for current session"
fi

# Update shell config file
if [ -n "$CONFIG_FILE" ]; then
    echo ""
    echo "Updating $CONFIG_FILE..."

    # Create backup
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Created backup of $CONFIG_FILE"

    # Remove old entries if they exist
    if grep -q "# Retirement Planning API Keys" "$CONFIG_FILE"; then
        # Remove the entire block
        sed -i.tmp '/# Retirement Planning API Keys/,/# End Retirement Planning API Keys/d' "$CONFIG_FILE"
        rm -f "${CONFIG_FILE}.tmp"
        echo "✓ Removed old API key configuration"
    fi

    # Add new entries
    {
        echo ""
        echo "# Retirement Planning API Keys"
        if [ -n "$NEW_GEMINI" ]; then
            echo "export GEMINI_API_KEY=\"$NEW_GEMINI\""
        fi
        if [ -n "$NEW_ANTHROPIC" ]; then
            echo "export ANTHROPIC_API_KEY=\"$NEW_ANTHROPIC\""
        fi
        echo "# End Retirement Planning API Keys"
    } >> "$CONFIG_FILE"

    echo "✓ Updated $CONFIG_FILE with new API keys"
    echo ""
    echo "========================================="
    echo "Configuration Complete!"
    echo "========================================="
    echo ""
    echo "The API keys have been added to your shell configuration."
    echo ""
    echo "To use them in your current terminal:"
    echo "  source $CONFIG_FILE"
    echo ""
    echo "Or simply open a new terminal window."
    echo ""
    echo "You can now start the application:"
    echo "  ./start.sh"
    echo ""
else
    echo ""
    echo "Please manually add these lines to your shell configuration:"
    echo ""
    if [ -n "$NEW_GEMINI" ]; then
        echo "export GEMINI_API_KEY=\"$NEW_GEMINI\""
    fi
    if [ -n "$NEW_ANTHROPIC" ]; then
        echo "export ANTHROPIC_API_KEY=\"$NEW_ANTHROPIC\""
    fi
    echo ""
fi
