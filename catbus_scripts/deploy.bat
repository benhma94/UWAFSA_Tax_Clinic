@echo off
echo ============================================
echo CATBUS - Create New Deployment
echo ============================================
echo.
echo This will create a new version and deployment.
echo Users will need to use the new deployment URL.
echo.
set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

echo.
echo Creating new deployment...
echo.

REM Create a new deployment with a description
clasp deploy --description "Updated with prefill functionality - %date% %time%"

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
echo Deployment Created!
echo ============================================
echo.
echo IMPORTANT: You need to update your web app link!
echo.
echo Go to your Apps Script project:
echo https://script.google.com/home/projects/1Bf-iqnaUk5BADJbNWOCYEHDoWoxt-nMSn1-4AUps6QTSnFlwpsTT6SP5
echo.
echo Click Deploy ^> Manage deployments
echo Copy the new Web App URL
echo.
pause
