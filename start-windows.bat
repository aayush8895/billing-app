@echo off
setlocal
cd /d "%~dp0"

echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% equ 0 goto :run

echo Node.js not found.
where winget >nul 2>nul
if %errorlevel% neq 0 goto :noinstaller

echo Installing Node.js LTS via winget - this may take a minute...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 goto :installfailed

echo.
echo Node.js was just installed. Windows needs a fresh window to pick up the
echo new PATH, so this script will now close.
echo.
echo Please double-click start-windows.bat again to launch the app.
pause
exit /b 0

:run
echo Node.js found. Starting Billing App server...
start "" http://localhost:3000
node server.js
pause
exit /b 0

:noinstaller
echo winget is not available on this system (Windows 10 1709+ / Windows 11 ship it by default).
echo Opening the official Node.js download page - please install the LTS version,
echo then re-run this script.
start https://nodejs.org/en/download
pause
exit /b 1

:installfailed
echo Automatic install via winget failed.
echo Opening the official Node.js download page - please install the LTS version manually,
echo then re-run this script.
start https://nodejs.org/en/download
pause
exit /b 1
