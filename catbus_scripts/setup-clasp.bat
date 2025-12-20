@echo off
echo ============================================
echo CATBUS - Clasp Setup Script
echo ============================================
echo.

echo Step 1: Installing clasp globally...
call npm install -g @google/clasp
if %errorlevel% neq 0 (
    echo ERROR: Failed to install clasp. Make sure Node.js and npm are installed.
    echo Download Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo.

echo Step 2: Logging into Google Account...
echo A browser window will open. Please authorize clasp.
call clasp login
if %errorlevel% neq 0 (
    echo ERROR: Failed to login to Google.
    pause
    exit /b 1
)
echo.

echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo IMPORTANT: Before you can use clasp, you need to:
echo 1. Go to https://script.google.com/home/usersettings
echo 2. Turn ON "Google Apps Script API"
echo.
echo After that, you can use upload.bat to push your changes.
echo.
pause
