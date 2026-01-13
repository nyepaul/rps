#!/bin/bash
set -e

echo "1. Force removing the stuck directory..."
# Fixes the ENOTEMPTY error by manually removing the directory
rm -rf "/opt/homebrew/lib/node_modules/@google/gemini-cli"

echo "2. Installing the latest version of @google/gemini-cli..."
npm install -g @google/gemini-cli

echo "3. Verifying installation..."
npm list -g --depth=0 @google/gemini-cli

echo "✅ Update complete!"
