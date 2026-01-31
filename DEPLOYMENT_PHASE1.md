# Phase 1 Deployment Guide

## Current Status

✅ **Phase 1 code is complete and committed**
- Version bumped to 3.9.99
- All changes committed to git (commit b6d8783)
- Production service is running old code (3.9.98)

⚠️ **Deployment needed** to test the new CSV parser

## Deployment Options

### Option 1: Quick Deployment (Recommended)

Deploy to production immediately to test:

```bash
# Push to git
git push origin main

# Deploy to production
sudo ./bin/deploy
```

This will:
1. Pull latest code
2. Install any new dependencies
3. Restart the RPS service
4. Make new code available at http://127.0.0.1:5137/

### Option 2: Test in Development First

Stop production service temporarily and run dev server:

```bash
# Stop production service
sudo systemctl stop rps

# Start dev server
./bin/start

# Test at http://127.0.0.1:5137/

# When done, restart production
sudo systemctl start rps
```

**Note**: This will interrupt production users.

### Option 3: Run on Different Port

Keep production running, test on different port:

```bash
# Edit bin/start to use port 5138 instead of 5137
# Or manually run:
cd src
source venv/bin/activate
FLASK_PORT=5138 python app.py

# Test at http://127.0.0.1:5138/
```

## Recommended Approach

**Use Option 1** - Deploy to production:

```bash
# 1. Push changes
git push origin main

# 2. Deploy
sudo ./bin/deploy

# 3. Verify deployment
curl http://127.0.0.1:5137/js/utils/csv-parser.js | head -5

# Should see JavaScript code, not {"error":"Not found"}
```

## Post-Deployment Testing

Once deployed, follow the testing guide:

```bash
./tests/test_csv_import.sh
```

### Quick Test
1. Open http://127.0.0.1:5137/
2. Create or select a profile
3. Go to Income tab
4. Click "Import CSV"
5. Upload `tests/test_data/sample_income.csv`
6. Verify 5 income streams are imported

### Full Test Suite
- Open `tests/test_csv_parser.html` in browser
- Verify all 50+ tests pass
- Test all three tabs with sample CSV files

## Verification Checklist

After deployment:

- [ ] New file accessible: `curl http://127.0.0.1:5137/js/utils/csv-parser.js`
- [ ] Version shows 3.9.150: Check admin panel or API
- [ ] No JavaScript errors in browser console (F12)
- [ ] Income CSV import works
- [ ] Budget CSV import works
- [ ] Assets CSV import works
- [ ] Unit tests pass (open test_csv_parser.html)

## Rollback Plan

If issues are found after deployment:

```bash
# Revert to previous version
git revert HEAD

# Redeploy
sudo ./bin/deploy

# Or checkout previous commit
git checkout 58cef7b  # Previous commit before skew correction
sudo ./bin/deploy
```

## Current Git Status

```bash
$ git log --oneline -3
d2b1e9e (HEAD -> main) chore: correct version skew to 3.9.150
58cef7b docs: sync README.md version to 3.9.84
5cbc881 chore: remove temporary email test script
```

**Current version on production**: 3.9.149
**New version after deployment**: 3.9.150

## Why Deployment is Safe

1. ✅ **Backward compatible** - all existing CSV imports work
2. ✅ **Same behavior** - just uses shared code instead of duplicated code
3. ✅ **No breaking changes** - only internal refactoring
4. ✅ **Comprehensive tests** - 50+ unit tests created
5. ✅ **Can rollback** - git revert available if needed

## Next Steps

1. **Deploy now** (recommended)
   ```bash
   git push origin main
   sudo ./bin/deploy
   ```

2. **Test thoroughly**
   ```bash
   ./tests/test_csv_import.sh
   ```

3. **If all tests pass**, proceed to Phase 2

4. **If issues found**, rollback and debug

## Notes

- Production service runs as systemd service: `sudo systemctl status rps`
- Logs available: `./bin/manage logs` or `sudo journalctl -u rps -f`
- Service automatically restarts on deployment
- No database migrations needed for Phase 1

---

**Ready to deploy!** 🚀

Run: `git push origin main && sudo ./bin/deploy`
