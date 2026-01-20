# RPS Backups Directory

This directory contains automated backups of the RPS application.

## Backup Files

Backup files follow the naming convention:
```
rps_backup_YYYYMMDD_HHMMSS.tar.gz
```

Example: `rps_backup_20260120_143000.tar.gz`

## Contents

Each backup contains:
- SQLite database (`data/planning.db`)
- Configuration files (`.env`, `alembic.ini`, etc.)
- Version information
- Recent logs (last 7 days)
- Backup metadata

## Automated Backups

Backups run automatically daily at 2:00 AM via systemd timer.

To check status:
```bash
sudo systemctl status rps-backup.timer
```

## Manual Backups

Create a backup manually:
```bash
./bin/backup
```

## Restore

To restore from a backup:
```bash
# Interactive mode
./bin/restore

# Restore latest
./bin/restore --latest

# List available backups
./bin/restore --list
```

## Documentation

For comprehensive backup and restore documentation, see:
`docs/BACKUP_GUIDE.md`

## Retention

By default, the last 14 backups are retained. Older backups are automatically deleted.

Customize retention:
```bash
./bin/backup --keep 30  # Keep 30 days
```

## Security

Backup files contain sensitive data. This directory should have restricted permissions:

```bash
chmod 700 backups/
chmod 600 backups/*.tar.gz
```

## Storage Size

Typical backup size: 100-200 KB compressed
14-day retention: ~2-3 MB total

## Off-Site Backups

Configure remote sync for disaster recovery:

```bash
./bin/backup --remote user@backup-server.com:/backups/rps
```

See `docs/BACKUP_GUIDE.md` for cloud storage options (AWS S3, Backblaze B2, Google Drive).
