# Troubleshooting Guide

## Error: "Failed to fetch"

This error means the backend Flask server isn't running properly.

### Solution:

**Step 1: Start the server correctly**

    cd pan-rps
    ./start.sh

You should see:
```
Starting Flask Server...
Access the application at:
http://127.0.0.1:8080
```

**Step 2: Open in browser**

Navigate to: **http://127.0.0.1:8080** (NOT file://)

The server MUST be running for the application to work.

---

## Error: "Permission denied"

The scripts need to be executable.

### Solution:

    chmod +x start.sh
    chmod +x manage.sh

---

## Error: "python3: command not found"

Python 3 is not installed.

### Solution:

**macOS:**

    brew install python3

**Linux (Ubuntu/Debian):**

    sudo apt update
    sudo apt install python3 python3-pip python3-venv

**Windows:**

Download from: https://www.python.org/downloads/

---

## Error: Port 8080 already in use

Another application is using port 8080.

### Solution:

**Option 1: Stop the other application**

**Option 2: Use a different port**

Edit `webapp/app.py`, change last line to:

    app.run(host='0.0.0.0', port=8081, debug=False)

Then access at: http://127.0.0.1:8081

---

## Application loads but shows no data

### Solution:

Click "Load Saved Profile" in the Profile tab, or enter your data manually.

---

## Analysis shows weird numbers

### Solution:

1. Check your input data in Profile tab
2. Verify pension lump sum = $120,000 (not annual income)
3. Re-run analysis

---

## Can't install dependencies

### Solution:

**If pip install fails:**

    python3 -m pip install --upgrade pip
    python3 -m pip install flask flask-cors sqlalchemy numpy pandas

**If numpy/pandas fail (missing compiler):**

macOS:

    xcode-select --install

Linux:

    sudo apt install build-essential python3-dev

---

## How to completely restart

    cd pan-rps
    ./manage.sh clean
    ./start.sh

This removes all data and starts fresh.

---

## Still having issues?

1. **Check Python version:**

       python3 --version
   
   Should be 3.8 or higher

2. **Check if server is running:**

       curl http://127.0.0.1:8080/health
   
   Should return: `{"status":"healthy"}`

3. **View server logs:**

   Look at terminal where you ran `./start.sh`
   Errors will appear there

4. **Test manually:**

       cd pan-rps/webapp
       source venv/bin/activate
       python app.py

---

## Quick Reference

**Start server:**

    ./start.sh

**Access application:**

    http://127.0.0.1:8080

**Stop server:**

    Press Ctrl+C in terminal

**Check if running:**

    curl http://127.0.0.1:8080/health

**Clean and restart:**

    ./manage.sh clean
    ./start.sh
