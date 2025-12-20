@echo off
echo ============================================
echo CATBUS - Download from Google Apps Script
echo ============================================
echo.
echo WARNING: This will overwrite your local files!
echo.
set /p confirm="Are you sure you want to download? (y/n): "
if /i not "%confirm%"=="y" (
    echo Download cancelled.
    pause
    exit /b 0
)

echo.
echo Downloading all files from Google Apps Script...
echo.

call clasp pull
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Download failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo Download Successful!
echo ============================================
echo.
pause
