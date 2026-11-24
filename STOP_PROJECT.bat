@echo off
title Stop AI Screening System
cd /d "%~dp0"
echo ======================================================================
echo    Stopping AI Screening Backend Server (Port 5000)...
echo ======================================================================
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Server stopped successfully.
pause
