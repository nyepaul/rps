#!/bin/bash
# Fix git permissions and commit changes

set -e

echo "Fixing git object permissions..."
sudo chown -R paul:paul .git/objects/

echo "Committing changes..."
git commit -a -m "chore: bump version to 3.8.94

Fix demo profile name to use 'Demo Profile' with proper spacing instead of 'DemoProfile'. Ensures consistency between profile name display and demo account defaults.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

echo "Pushing to remote..."
git push

echo "✅ Done! Version 3.8.94 deployed."
