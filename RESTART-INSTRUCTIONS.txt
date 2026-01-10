QUICK FIX FOR ERROR

I've updated the code to better handle errors. Follow these steps:

Step 1: Stop the current server
=============================
In the terminal where the server is running, press: Ctrl+C


Step 2: Restart the server
===========================
./start.sh


Step 3: Refresh your browser
=============================
Go to: http://127.0.0.1:8080
Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) to hard refresh


Step 4: Try analysis again
==========================
1. Click the "Analysis" tab
2. Click "Run Complete Analysis"
3. You should now see either:
   - Success: Your analysis results
   - OR a detailed error message explaining what went wrong


If you still get an error:
==========================
1. Check the terminal output where the server is running - it will show the actual Python error
2. Take a screenshot and share it with me
3. OR look in the browser console (press F12, click "Console" tab) for error details


The changes I made:
==================
- Added proper error handling to catch and display errors
- Server will now return JSON error messages instead of HTML
- Browser will show detailed error information
- Python errors will print to terminal for debugging
