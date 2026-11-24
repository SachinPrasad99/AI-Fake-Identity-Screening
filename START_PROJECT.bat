@echo off
title AI Fake Identity Screening System
cd /d "%~dp0"

echo ======================================================================
echo    AI-BASED FAKE IDENTITY SCREENING SYSTEM - CYBER DEFENSE v2.0
echo ======================================================================
echo.

echo [1/3] Clearing any leftover server processes on Port 5000...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 >nul
echo       Port 5000 is clean.

echo.
echo [2/3] Starting Local Python Backend Server...
start "AI Screening Server Console" cmd /k "title AI Screening Server Console && cd /d "%~dp0" && venv\Scripts\python.exe backend\app.py"

echo       Waiting for server to initialize...
timeout /t 3 >nul

echo.
echo [3/3] Opening Web Dashboard in default browser...
start http://127.0.0.1:5000/

echo.
echo ======================================================================
echo    SYSTEM IS ACTIVE AND READY!
echo ======================================================================
echo  - Dashboard URL: http://127.0.0.1:5000/
echo  - Demo Login   : ID: admin  ^|  Password: admin123 (or click Auto-Fill)
echo.
echo  Keep the "AI Screening Server Console" window open while using the app.
echo  To shut down, simply close that window or run STOP_PROJECT.bat.
echo ======================================================================
echo.
pause
