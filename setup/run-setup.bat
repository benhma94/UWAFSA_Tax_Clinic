@echo off
setlocal

:: ============================================================
::  CATBUS Setup Installer — Windows Launcher
::  Double-click this file to start the setup wizard.
:: ============================================================

echo.
echo ============================================================
echo   CATBUS Setup Installer
echo ============================================================
echo.

:: Check that Node.js is installed and on PATH
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not on PATH.
    echo.
    echo Download Node.js from: https://nodejs.org/
    echo Install with the default settings, then re-run this script.
    echo.
    pause
    exit /b 1
)

:: Move to repo root (one directory up from setup/)
cd /d "%~dp0.."

:: Run the setup wizard
node setup/setup.js
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE% neq 0 (
    echo Setup exited with errors. See the output above for details.
) else (
    echo Setup complete! You may close this window.
)

pause
exit /b %EXIT_CODE%
