# GitHub Repository Rename Guide

## Step 1: Rename on GitHub (Web Interface)

1. Go to https://github.com/nyepaul/pan-rps
2. Click on **Settings** (top right of the repository page)
3. Scroll down to **Repository name** section
4. Change from: `pan-rps`
5. Change to: `panrps`
6. Click **Rename**

GitHub will automatically redirect the old URL to the new one, but it's best to update local references.

## Step 2: Update Local Git Remote

After renaming on GitHub, run these commands in your local repository:

```bash
cd ~/src/panrps

# Update the remote URL
git remote set-url origin https://github.com/nyepaul/panrps.git

# Verify the change
git remote -v

# Test with a fetch
git fetch origin
```

You should see:
```
origin  https://github.com/nyepaul/panrps.git (fetch)
origin  https://github.com/nyepaul/panrps.git (push)
```

## Step 3: Update Documentation

After renaming, we need to update the DEPLOYMENT_STATUS.md file to reflect the new repo name.

## Step 4: Commit and Push

After updating documentation:
```bash
git add DEPLOYMENT_STATUS.md
git commit -m "docs: update GitHub repository URL to panrps"
git push origin main
```

## Notes

- GitHub automatically redirects from the old URL to the new one
- Existing clones will continue to work even with the old URL
- It's still recommended to update all local references for clarity
- Any links or webhooks pointing to the old name should be updated
