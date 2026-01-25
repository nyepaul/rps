# Troubleshooting Guide

## Error: "Failed to fetch"

This error means the backend Flask server isn't running properly.

### Solution:

**Step 1: Start the server correctly**

```bash
cd rps
./bin/start
```

You should see:
```
Starting Flask Server...
Access the application at:
http://127.0.0.1:5137
```

**Step 2: Open in browser**

Navigate to: **http://127.0.0.1:5137** (NOT file://)

The server MUST be running for the application to work.

---

## Error: "Permission denied"

The scripts need to be executable.

### Solution:

```bash
chmod +x bin/start
chmod +x bin/manage
```

---

## Error: "python3: command not found"

Python 3 is not installed.

### Solution:

**macOS:**
```bash
brew install python3
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**Windows:**
Download from: https://www.python.org/downloads/

---

## Error: Port 5137 already in use

Another application is using port 5137.

### Solution:

**Option 1: Stop the other application**

Find and kill the process:
```bash
lsof -i :5137
kill <PID>
```

**Option 2: Stop any existing RPS instance**
```bash
./bin/manage stop
./bin/start
```

---

## Application loads but shows no data

### Solution:

Click "Load Saved Profile" in the Profile tab, or enter your data manually.

---

## Analysis shows weird numbers

### Solution:

1. Check your input data in Profile tab
2. Verify pension amounts are annual values
3. Re-run analysis

---

## Can't install dependencies

### Solution:

**If pip install fails:**
```bash
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

**If numpy/pandas fail (missing compiler):**

macOS:
```bash
xcode-select --install
```

Linux:
```bash
sudo apt install build-essential python3-dev
```

---

## How to completely restart

```bash
./bin/manage stop
./bin/start
```

To reset all data (WARNING: deletes profiles):
```bash
rm data/planning.db
./bin/start
```

---

## Still having issues?

1. **Check Python version:**
   ```bash
   python3 --version
   ```
   Should be 3.10 or higher

2. **Check if server is running:**
   ```bash
   curl http://127.0.0.1:5137/health
   ```
   Should return: `{"status":"healthy"}`

3. **View server logs:**
   Look at terminal where you ran `./bin/start`
   Errors will appear there

4. **Check logs directory:**
   ```bash
   cat logs/app.log
   ```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start server | `./bin/start` |
| Stop server | `./bin/manage stop` |
| Check status | `./bin/manage status` |
| Access app | http://127.0.0.1:5137 |
| Backup data | `./bin/backup` |
