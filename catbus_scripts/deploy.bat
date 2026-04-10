@echo off
cd /d "%~dp0"

echo ============================================
echo CATBUS - Deploy with Stable URL
echo ============================================
echo.
echo This will update the existing deployment.
echo Your web app URL will remain unchanged.
echo.

set "WEBAPP_URL="
for /f "tokens=2 delims='" %%A in ('findstr /c:"WEBAPP_URL" "_Secrets.gs"') do (
    if not defined WEBAPP_URL set "WEBAPP_URL=%%A"
)

if "%WEBAPP_URL%"=="" (
    echo ERROR: Could not find WEBAPP_URL in _Secrets.gs
    echo.
    echo Ensure WEBAPP_URL is defined and formatted like:
    echo https://script.google.com/macros/s/DEPLOYMENT_ID/exec
    echo.
    pause
    exit /b 1
)

set "DEPLOYMENT_ID=%WEBAPP_URL:https://script.google.com/macros/s/=%"
set "DEPLOYMENT_ID=%DEPLOYMENT_ID:/exec=%"

if "%DEPLOYMENT_ID%"=="" (
    echo ERROR: Could not extract deployment ID from WEBAPP_URL
    echo.
    echo WEBAPP_URL found: %WEBAPP_URL%
    echo.
    pause
    exit /b 1
)

echo Deployment ID: %DEPLOYMENT_ID%
echo.
echo Updating existing deployment...
echo.

clasp deploy --deploymentId "%DEPLOYMENT_ID%" --description "Updated - %date% %time%"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Deployment failed!
    echo.
    echo Try running: clasp login
    echo Then try deploy again.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Deployment Updated!
echo ============================================
echo.
echo Your web app URL remains unchanged.
echo.
echo WEBAPP_URL: !WEBAPP_URL!
echo.
endlocal
exit /b 0
