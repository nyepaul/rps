# RPS Backup and Restore Guide

Comprehensive backup methodology for the Retirement Planning System (RPS) on Linux.

## Overview

The RPS backup system provides **two backup types**:

### Full System Backup (`./bin/backup`)
- Complete application backup (code, database, migrations, tests, docs)
- **Size**: ~76M compressed (~331M uncompressed)
- **Use for**: System restores, deployments, archival
- **Frequency**: Weekly or before major changes

### Incremental Backup (`./bin/backup-incremental`)
- Data-only backup (database, configs, recent logs)
- **Size**: ~2.6M compressed (~47M uncompressed) - 29× smaller!
- **Use for**: Daily/hourly data protection
- **Frequency**: Daily automated backups

**Both backup types provide:**
- **Hot backups** of SQLite database (no downtime required)
- **Automatic rotation** to manage storage
- **Compression** using tar.gz for efficient storage
- **Integrity verification** for database and archives
- **Pre-restore safety** backups before any restore operation
- **Selective restore** (database only, config only, or full)
- **Optional remote sync** for off-site backups

## Quick Start

### Set Up Automated Backups

```bash
# Install and enable the backup timer (runs incremental backups daily)
sudo ./bin/setup-backup-timer

# Verify timer is active
sudo systemctl status rps-backup.timer
```

### Run Manual Backups

```bash
# Full system backup (complete application)
./bin/backup --keep 14

# Incremental backup (data only)
./bin/backup-incremental --keep 30

# Full backup with remote sync
./bin/backup --remote user@backup-server.com:/backups/rps
```

### Restore from Backup

```bash
# Interactive restore (select from list)
./bin/restore

# Restore latest backup
./bin/restore --latest

# Restore specific backup
./bin/restore --backup rps_backup_20260120_120000.tar.gz

# Restore database only
./bin/restore --latest --type database
```

## Backup Types Comparison

| Feature | Full System Backup | Incremental Backup |
|---------|-------------------|-------------------|
| Script | `./bin/backup` | `./bin/backup-incremental` |
| Size | ~76M compressed | ~2.6M compressed |
| Contents | Everything | Data only |
| Source code | ✅ Yes (9,467 files) | ❌ No |
| Scripts | ✅ Yes (26 files) | ❌ No |
| Migrations | ✅ Yes (15 files) | ❌ No |
| Tests | ✅ Yes (52 files) | ❌ No |
| Documentation | ✅ Yes (58 files) | ❌ No |
| Database | ✅ Yes (~44M) | ✅ Yes (~44M) |
| Configs | ✅ Yes | ✅ Yes |
| Logs | ✅ Last 7 days | ✅ Last 24 hours |
| Use case | System restore | Data protection |
| Frequency | Weekly | Daily/Hourly |
| Default retention | 14 backups | 30 backups |

## Full System Backup Reference

### Location
`./bin/backup`

### What Gets Backed Up

1. **Source Code** (`src/` directory - 9,467 files)
   - Complete Python application code
   - All routes, services, models, middleware
   - Static assets (HTML, CSS, JS)
   - Templates and components
   - Size: ~283M uncompressed

2. **Scripts** (`bin/` directory - 26 files)
   - All management and utility scripts
   - Backup/restore scripts
   - Development and deployment tools
   - Size: ~176K

3. **Database Migrations** (`migrations/` directory - 15 files)
   - Alembic migration scripts
   - Schema version history
   - Migration environment configuration
   - Size: ~136K

4. **Tests** (`tests/` directory - 52 files)
   - Complete test suite
   - Unit tests, integration tests
   - Test fixtures and utilities
   - Size: ~512K

5. **Documentation** (`docs/` directory - 58 files)
   - User guides and tutorials
   - API documentation
   - Deployment guides
   - Architecture documentation
   - Size: ~632K

6. **Database** (`data/planning.db`)
   - Hot backup using SQLite's built-in backup command
   - Integrity verification with PRAGMA integrity_check
   - Size: ~44M

7. **Configuration Files**
   - `.env` and `.env.production` (environment variables)
   - `alembic.ini` (database migration config)
   - `requirements.txt`, `pyproject.toml`, `setup.py`
   - `pytest.ini`, `.gitignore`
   - Root-level docs: `CLAUDE.md`, `README.md`, `DEPLOYMENT.md`, `LICENSE`

8. **Recent Logs** (last 7 days)
   - Application logs from `logs/` directory
   - Useful for troubleshooting issues at time of backup

9. **Metadata**
   - `backup_metadata.txt` containing backup info, timestamp, version, file counts, sizes

### What Doesn't Get Backed Up

- Python virtual environment (`venv/`, `.venv/`)
- Git repository (`.git/`)
- Python cache (`__pycache__/`, `*.pyc`)
- Old backups (`backups/` directory)
- Temporary files (`tmp/`, `.tmp`)
- Node modules (if any)
- Old log files (>7 days)

## Incremental Backup Reference

### Location
`./bin/backup-incremental`

### What Gets Backed Up

1. **Database** (`data/planning.db`)
   - Hot backup using SQLite's built-in backup command
   - Integrity verification with PRAGMA integrity_check
   - Size: ~44M

2. **Configuration Files**
   - `.env` and `.env.production` (environment variables)
   - `alembic.ini` (database migration config)
   - `version.json` (tracks RPS version for the data)

3. **Recent Logs** (last 24 hours only)
   - Application logs from `logs/` directory
   - Smaller log window for faster backups

4. **Metadata**
   - `backup_metadata.txt` with backup type indicator
   - Note explaining this is data-only backup

### Storage Locations

- **Full backups**: `backups/rps_backup_YYYYMMDD_HHMMSS.tar.gz`
- **Incremental backups**: `backups/incremental/rps_incremental_YYYYMMDD_HHMMSS.tar.gz`

### Command Line Options

```bash
./bin/backup [options]

Options:
  --keep N          Keep last N backups (default: 14)
  --remote DEST     Sync to remote destination (rsync format)
  --verify          Verify backup integrity (default)
  --no-verify       Skip backup verification
  --verbose, -v     Verbose output
  --help, -h        Show help
```

### Examples

```bash
# Standard daily backup
./bin/backup

# Keep 30 days of backups
./bin/backup --keep 30

# Sync to remote NAS
./bin/backup --remote nas.local:/mnt/backups/rps

# Sync to remote server via SSH
./bin/backup --remote user@backup.example.com:/var/backups/rps

# Quick backup without verification (faster but less safe)
./bin/backup --no-verify

# Verbose output for debugging
./bin/backup --verbose
```

## Restore Script Reference

### Location
`./bin/restore`

### Safety Features

1. **Pre-restore Backup**: Automatically creates a backup of current state before restoring
2. **Verification**: Validates archive integrity before extraction
3. **Confirmation Prompts**: Requires explicit confirmation (unless `--yes` flag used)
4. **Database Integrity**: Verifies restored database with PRAGMA integrity_check
5. **Metadata Display**: Shows backup info before restoring

### Command Line Options

```bash
./bin/restore [options]

Options:
  --backup FILE     Specify backup file to restore
  --latest          Restore the most recent backup
  --list, -l        List available backups
  --type TYPE       Restore type: full, database, config (default: full)
  --yes, -y         Skip confirmation prompts
  --help, -h        Show help
```

### Restore Types

**Full Restore** (default)
- Restores database
- Restores configuration files
- Use when recovering from system failure

**Database Only**
- Restores only the SQLite database
- Preserves current configuration
- Use when recovering from data corruption

**Config Only**
- Restores only configuration files
- Preserves current database
- Use when recovering from configuration mistakes

### Examples

```bash
# Interactive mode (select from list)
./bin/restore

# List available backups
./bin/restore --list

# Restore latest backup
./bin/restore --latest

# Restore specific backup
./bin/restore --backup rps_backup_20260120_120000.tar.gz

# Restore latest database only
./bin/restore --latest --type database

# Restore config only
./bin/restore --backup backup.tar.gz --type config

# Automated restore (no prompts)
./bin/restore --latest --yes
```

## Selective Profile/Group Backups (Admin Feature)

The RPS backup system includes a powerful selective backup feature that allows super administrators to backup and restore specific profiles or entire groups of users. This is useful for:

- Backing up specific client data before major changes
- Migrating individual user profiles between systems
- Creating point-in-time snapshots of specific accounts
- Restoring individual profiles without affecting other users

### Accessing Selective Backups

1. Log in as a super administrator
2. Navigate to **Admin** → **Backups**
3. Click the **Selective Backup** tab

### Creating a Selective Backup

#### Select by Group
- Choose one or more groups from the group list
- All profiles belonging to users in those groups will be included
- Shows member count and profile count for each group

#### Select Individual Profiles
- Use the search box to find specific profiles
- Check individual profiles to include them
- Profiles show their owner's username and group memberships

#### Create the Backup
1. Select profiles and/or groups
2. (Optional) Add a descriptive label
3. Click **Create Backup**

The backup includes:
- Profile data (encrypted)
- Related scenarios
- Action items
- Conversations

### Viewing Selective Backup Details

Click the **📋 View** button on any selective backup to see:
- Backup metadata (creation date, label)
- List of all profiles included
- Counts of scenarios, action items, and conversations

### Restoring from Selective Backup

1. Click **↻ Restore** on the backup you want to restore
2. Select which profiles to restore (all selected by default)
3. Choose a restore mode:
   - **Merge**: Updates existing profiles, adds new ones (safer)
   - **Replace**: Deletes related data first, then restores (clean restore)
4. Click **Restore Selected**

### Selective Backup Storage

Selective backups are stored as JSON files in:
```
backups/selective/
```

Naming convention:
```
selective_YYYYMMDD_HHMMSS[_label].json
```

Example: `selective_20260122_143022_Q1_Clients.json`

### API Endpoints (for integration)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/backup/selective/profiles` | GET | List all profiles with details |
| `/api/admin/backup/selective/groups` | GET | List all groups with counts |
| `/api/admin/backup/selective` | GET | List selective backups |
| `/api/admin/backup/selective` | POST | Create selective backup |
| `/api/admin/backup/selective/<filename>` | GET | Get backup details |
| `/api/admin/backup/selective/<filename>/restore` | POST | Restore from backup |
| `/api/admin/backup/selective/<filename>` | DELETE | Delete backup |

### Best Practices for Selective Backups

1. **Label your backups** - Use descriptive labels like "Pre-migration Q1 clients"
2. **Use groups for bulk operations** - Create groups to organize users for easier backup management
3. **Test restore in non-production** - Verify restore works before using in production
4. **Consider merge vs replace** - Use merge mode unless you need a clean restore
5. **Regular cleanup** - Delete old selective backups that are no longer needed

## Automated Backups with Systemd

### Components

Two systemd unit files work together:

1. **rps-backup.service** - The backup job itself
2. **rps-backup.timer** - Schedules when the backup runs

### Installation

```bash
# Install as system service (requires sudo)
sudo ./bin/setup-backup-timer

# Or install as user service (no sudo)
./bin/setup-backup-timer
```

### Default Schedule

- **Frequency**: Daily at 2:00 AM
- **Randomization**: Up to 15 minutes delay to avoid load spikes
- **Persistence**: Runs on next boot if system was off during scheduled time

### Custom Schedules

Edit `systemd/rps-backup.timer` and modify the `OnCalendar` directive:

```ini
# Daily at 3:30 AM
OnCalendar=*-*-* 03:30:00

# Twice daily (6 AM and 6 PM)
OnCalendar=*-*-* 06,18:00:00

# Every 6 hours
OnCalendar=*-*-* 00/6:00:00

# Weekly on Sunday at 3 AM
OnCalendar=Sun *-*-* 03:00:00

# First day of month at midnight
OnCalendar=*-*-01 00:00:00
```

After modifying, reload systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl restart rps-backup.timer
```

### Management Commands

**System Service** (installed with sudo):

```bash
# Check timer status
sudo systemctl status rps-backup.timer

# View next scheduled run
sudo systemctl list-timers rps-backup.timer

# Run backup manually now
sudo systemctl start rps-backup.service

# View backup logs
sudo journalctl -u rps-backup.service

# View last 50 log lines
sudo journalctl -u rps-backup.service -n 50

# Follow logs in real-time
sudo journalctl -u rps-backup.service -f

# Stop timer
sudo systemctl stop rps-backup.timer

# Disable timer (prevent auto-start)
sudo systemctl disable rps-backup.timer

# Re-enable timer
sudo systemctl enable rps-backup.timer
sudo systemctl start rps-backup.timer
```

**User Service** (installed without sudo):

```bash
# Check timer status
systemctl --user status rps-backup.timer

# View next scheduled run
systemctl --user list-timers rps-backup.timer

# Run backup manually now
systemctl --user start rps-backup.service

# View backup logs
journalctl --user -u rps-backup.service

# Stop timer
systemctl --user stop rps-backup.timer

# Disable timer
systemctl --user disable rps-backup.timer
```

## Backup Storage and Rotation

### Storage Location

```
/home/paul/src/rps/backups/
```

### Naming Convention

```
rps_backup_YYYYMMDD_HHMMSS.tar.gz
```

Example: `rps_backup_20260120_143022.tar.gz` (January 20, 2026 at 2:30:22 PM)

### Rotation Policy

Default: Keeps last **14 backups** (approximately 2 weeks)

Older backups are automatically deleted when new backups are created.

Customize retention:
```bash
./bin/backup --keep 30    # Keep 30 days
./bin/backup --keep 7     # Keep 1 week
./bin/backup --keep 90    # Keep 3 months
```

### Storage Requirements

**Typical backup size**: 100-200 KB compressed

**14-day retention**: ~2-3 MB total
**30-day retention**: ~5-6 MB total

The database is small, so storage is not a concern for typical installations.

## Off-Site Backups (Remote Sync)

### Using rsync to Remote Server

```bash
# Sync to remote server
./bin/backup --remote user@backup-server.com:/backups/rps

# Using specific SSH key
./bin/backup --remote "user@backup-server.com:/backups/rps" \
  && rsync -avz -e "ssh -i ~/.ssh/backup_key" \
     backups/ user@backup-server.com:/backups/rps/
```

### Using Cloud Storage

**AWS S3**:
```bash
# After backup, sync to S3
./bin/backup && \
  aws s3 sync backups/ s3://my-bucket/rps-backups/ \
    --exclude "*" --include "rps_backup_*.tar.gz"
```

**Backblaze B2**:
```bash
# After backup, sync to B2
./bin/backup && \
  b2 sync backups/ b2://my-bucket/rps-backups/
```

**Google Drive** (using rclone):
```bash
# After backup, sync to Google Drive
./bin/backup && \
  rclone sync backups/ gdrive:RPS-Backups
```

### Automated Off-Site Sync

Add to cron or modify systemd service to include remote sync:

```bash
# Edit systemd service
sudo nano /etc/systemd/system/rps-backup.service

# Modify ExecStart line:
ExecStart=/home/paul/src/rps/bin/backup --keep 14 --remote user@backup.example.com:/backups/rps
```

## Disaster Recovery Procedures

### Complete System Failure

If the entire server is lost:

1. **Restore Server**:
   ```bash
   # On new server
   git clone <your-rps-repo>
   cd rps
   ```

2. **Transfer Backup**:
   ```bash
   # From backup server or cloud storage
   scp user@backup-server.com:/backups/rps/rps_backup_latest.tar.gz backups/
   ```

3. **Restore**:
   ```bash
   ./bin/restore --latest
   ```

4. **Reconfigure**:
   ```bash
   # Review and update .env if needed
   nano .env

   # Install dependencies
   ./bin/start
   ```

### Database Corruption

If only the database is corrupted:

```bash
# Restore just the database
./bin/restore --latest --type database

# Restart application
sudo systemctl restart rps
```

### Configuration Errors

If you made configuration mistakes:

```bash
# Restore just configuration
./bin/restore --latest --type config
```

### Accidental Data Deletion

If data was accidentally deleted but system is still running:

```bash
# Stop application first
sudo systemctl stop rps

# Restore latest backup
./bin/restore --latest

# Restart application
sudo systemctl start rps
```

## Monitoring and Alerts

### Check Backup Success

```bash
# View backup logs
tail -f logs/backup.log

# Check last backup time
ls -lht backups/ | head -5

# Verify latest backup
./bin/restore --list
```

### Email Notifications

Configure email notifications for backup failures:

1. Install mail utilities:
   ```bash
   sudo apt install mailutils
   ```

2. Edit systemd service:
   ```bash
   sudo nano /etc/systemd/system/rps-backup.service
   ```

3. Add notification command:
   ```ini
   [Service]
   # ... existing config ...

   # Send email on failure
   ExecStartPost=/bin/sh -c 'if [ $EXIT_STATUS != 0 ]; then \
     echo "RPS backup failed. Check logs with: sudo journalctl -u rps-backup.service" | \
     mail -s "RPS Backup Failed on $(hostname)" admin@example.com; \
   fi'
   ```

### Monitoring Scripts

Create a monitoring script to verify backups:

```bash
#!/bin/bash
# Check if backup is recent (less than 26 hours old)

LATEST_BACKUP=$(ls -t /home/paul/src/rps/backups/rps_backup_*.tar.gz | head -1)
BACKUP_AGE=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))

if [ $BACKUP_AGE -gt 93600 ]; then
    echo "WARNING: Latest backup is $(($BACKUP_AGE / 3600)) hours old"
    exit 1
fi

echo "OK: Latest backup is recent"
exit 0
```

## Best Practices

### 1. Test Restores Regularly

```bash
# Test restore process monthly
./bin/restore --list
./bin/restore --latest --type database --yes

# Verify application still works
curl http://localhost:5137/api/health
```

### 2. Keep Multiple Backup Locations

- **Local backups**: Fast recovery (14 days)
- **Remote backups**: Disaster recovery (90+ days)
- **Cloud backups**: Geographic redundancy

### 3. Verify Backup Integrity

The backup script automatically verifies:
- SQLite database integrity
- Archive compression validity

But you should also periodically test full restore:

```bash
# On a test system
./bin/restore --latest
# Verify application functionality
```

### 4. Monitor Disk Space

```bash
# Check backup directory size
du -sh /home/paul/src/rps/backups

# Check available disk space
df -h /home/paul/src/rps
```

### 5. Secure Backup Files

```bash
# Restrict permissions
chmod 700 backups/
chmod 600 backups/*.tar.gz

# Encrypt sensitive backups for off-site storage
gpg --symmetric backups/rps_backup_20260120_120000.tar.gz
```

### 6. Document Recovery Procedures

Keep this guide accessible outside of the RPS system (print, external wiki, etc.)

## Troubleshooting

### Backup Failed - Permission Denied

```bash
# Check directory permissions
ls -la backups/

# Fix permissions
chmod 755 backups/
chown paul:paul backups/
```

### Database Locked Error

```bash
# Stop RPS application before backup
sudo systemctl stop rps

# Run backup
./bin/backup

# Restart application
sudo systemctl start rps
```

Note: The backup script uses SQLite's `.backup` command which handles locks gracefully.

### Restore Failed - Archive Corrupted

```bash
# Verify archive integrity
tar -tzf backups/rps_backup_YYYYMMDD_HHMMSS.tar.gz

# Try previous backup
./bin/restore --list
# Select an older backup
```

### Systemd Timer Not Running

```bash
# Check timer status
sudo systemctl status rps-backup.timer

# Check for errors
sudo journalctl -u rps-backup.timer -n 50

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart rps-backup.timer
```

### Remote Sync Failing

```bash
# Test SSH connection
ssh user@backup-server.com

# Test rsync manually
rsync -avz --dry-run backups/ user@backup-server.com:/backups/rps/

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
```

## Advanced Configuration

### Exclude Specific Files

Edit `bin/backup` and add exclusions:

```bash
# In the "Backup important documentation" section
for doc in CLAUDE.md README.md DEPLOYMENT.md; do
    [[ -f "${PROJECT_ROOT}/${doc}" ]] && \
    [[ ! "${doc}" == "SECRET_FILE.md" ]] && \
    cp "${PROJECT_ROOT}/${doc}" "${TEMP_DIR}/config/" || true
done
```

### Incremental Backups

For very large databases, implement incremental backups:

```bash
# Full backup weekly
0 2 * * 0 /home/paul/src/rps/bin/backup --keep 4

# Incremental daily (backup only WAL file)
0 2 * * 1-6 /home/paul/src/rps/bin/backup-incremental
```

### Encrypted Backups

Add encryption to backup script:

```bash
# After tar creation, encrypt
gpg --symmetric --cipher-algo AES256 "${BACKUP_NAME}.tar.gz"
rm "${BACKUP_NAME}.tar.gz"  # Remove unencrypted version
```

### Backup Verification Script

Create automated verification:

```bash
#!/bin/bash
# verify-backups.sh

for backup in backups/rps_backup_*.tar.gz; do
    echo "Verifying $backup..."
    if tar -tzf "$backup" > /dev/null 2>&1; then
        echo "  ✓ Archive OK"
    else
        echo "  ✗ Archive CORRUPTED"
    fi
done
```

## Summary

The RPS backup system provides production-ready backup and restore capabilities with:

✅ Automated daily backups via systemd timer
✅ Hot database backups (no downtime)
✅ Automatic rotation and compression
✅ Comprehensive integrity verification
✅ Safe restore with pre-restore backups
✅ Selective restore capabilities (database, config, or full)
✅ **Selective profile/group backups** via admin UI
✅ Optional off-site sync support
✅ Detailed logging and monitoring

**Critical Files**:
- `/home/paul/src/rps/bin/backup` - Backup script
- `/home/paul/src/rps/bin/restore` - Restore script
- `/home/paul/src/rps/bin/setup-backup-timer` - Timer installation
- `/home/paul/src/rps/systemd/rps-backup.service` - Systemd service
- `/home/paul/src/rps/systemd/rps-backup.timer` - Systemd timer
- `/home/paul/src/rps/backups/` - Backup storage (system backups)
- `/home/paul/src/rps/backups/selective/` - Selective backup storage
- `/home/paul/src/rps/logs/backup.log` - Backup logs

For questions or issues, check the troubleshooting section or review logs at `logs/backup.log`.
