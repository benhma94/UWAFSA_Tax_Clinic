@echo off
echo ============================================
echo CATBUS - Upload to Google Apps Script
echo ============================================
echo.
echo Uploading all .gs and .html files...
echo.

call clasp push
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Upload failed!
    echo.
    echo Common issues:
    echo - Google Apps Script API not enabled
    echo   Go to: https://script.google.com/home/usersettings
    echo - Not logged in
    echo   Run: clasp login
    echo - Wrong script ID in .clasp.json
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Upload Successful!
echo ============================================
echo.
echo Your changes have been uploaded to:
echo https://script.google.com/home/projects/1Bf-iqnaUk5BADJbNWOCYEHDoWoxt-nMSn1-4AUps6QTSnFlwpsTT6SP5
echo.
pause
