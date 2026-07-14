@echo off
setlocal
cd /d "%~dp0"

set REPO=aayush8895/billing-app
set BRANCH=main
set PS1=%~dp0update.ps1

echo Fetching latest installer/updater from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/%REPO%/%BRANCH%/update.ps1' -OutFile '%PS1%' } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo Could not reach GitHub. Check your internet connection and try again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
pause
