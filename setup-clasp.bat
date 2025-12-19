@echo off
echo ========================================
echo CATBUS clasp Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer.
    echo.
    echo After installing, restart this script.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not available!
    pause
    exit /b 1
)

echo [OK] npm is available
npm --version
echo.

REM Check if clasp is installed
where clasp >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo clasp is not installed. Installing now...
    echo.
    npm install -g @google/clasp
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install clasp
        pause
        exit /b 1
    )
    echo.
    echo [OK] clasp installed successfully!
) else (
    echo [OK] clasp is already installed
    clasp --version
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Run: clasp login
echo    (This will open your browser to sign in)
echo.
echo 2. Get your Script ID from Apps Script:
echo    - Go to https://script.google.com
echo    - Open your CATBUS project
echo    - Click Project Settings (gear icon)
echo    - Copy the Script ID
echo.
echo 3. Run: clasp clone YOUR_SCRIPT_ID
echo    (Replace YOUR_SCRIPT_ID with the actual ID)
echo.
echo 4. Start editing! Then run: clasp push
echo.
echo For more help, see setup-clasp.md
echo.
pause
