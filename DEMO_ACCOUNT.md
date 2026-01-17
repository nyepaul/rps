# Demo Account Information

## Account Created Successfully ✓

A demo account has been created with all data copied from paul's account.

## Login Credentials

- **Username**: `demo`
- **Password**: `demo`
- **Email**: `demo@example.com`

## Data Copied

The following data was copied from paul's account to the demo account:

| Data Type | Count |
|-----------|-------|
| Profiles | 1 |
| Scenarios | 3 |
| Action Items | 0 |
| Conversations | 0 |

### Profile Copied

- **Name**: Paul
- **Birth Date**: (from original profile)
- **Retirement Date**: (from original profile)
- **All encrypted data**: Preserved (assets, financial data, settings)

### Scenarios Copied

1. Paul - Multi-Scenario - 1/15/2026
2. Paul - Great Recession (2008-2009) - Constant - Multi - 1/15/2026
3. Paul - 2008 Financial Crisis - Constant - Multi - 1/15/2026

## Important Notes

### Data Encryption

- All encrypted data (profile data, scenarios, action items) has been copied with the same encryption
- The demo account can read all copied data using the system's encryption key
- If API keys were stored in paul's profile, they are also copied to demo (encrypted)

### Data Isolation

- The demo account is completely isolated from paul's account
- Changes made in the demo account do NOT affect paul's data
- Both accounts can exist and be used simultaneously

### Account Properties

- **User ID**: 3
- **Active**: Yes
- **Admin**: No
- **Created**: (timestamp preserved)

## Testing the Account

1. **Via Web Interface**:
   - Go to http://localhost:5137/login (or your deployed URL)
   - Enter username: `demo`
   - Enter password: `demo`
   - You should see the dashboard with Paul's profile and scenarios

2. **Via API** (if needed):
   ```bash
   curl -X POST http://localhost:5137/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "demo", "password": "demo"}'
   ```

## Recreating the Demo Account

If you need to recreate or update the demo account with fresh data from paul:

```bash
cd ~/src/rps
python3 scripts/create_demo_account.py
```

The script will:
1. Ask if you want to delete the existing demo user
2. Create a fresh demo account
3. Copy all current data from paul's account

## Security Considerations

**For Production/Public Demos:**

1. **Change the password** - "demo" is too simple for public-facing systems
2. **Remove sensitive data** - Clear any real financial data, API keys, or personal information
3. **Set as read-only** (optional) - Consider making demo data read-only to prevent modifications
4. **Limit access** - Use appropriate authentication and rate limiting

**To change the demo password:**

```bash
cd ~/src/rps
python3 -c "
from src.models.user import User
import bcrypt

# Load demo user
user = User.get_by_username('demo')
if user:
    new_password = 'your_new_password_here'
    user.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user.save()
    print('✓ Password updated')
else:
    print('✗ Demo user not found')
"
```

## Maintenance

The demo account is maintained in the same database as other users. Regular database backups will include the demo account data.

To remove the demo account:

```bash
sqlite3 data/planning.db "DELETE FROM users WHERE username = 'demo';"
```

This will cascade delete all related data (profiles, scenarios, etc.).
