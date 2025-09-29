@echo off
echo ========================================
echo    Chok Hmong Game Server Startup
echo ========================================
echo.

echo Checking if port 3000 is already in use...
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo.
    echo WARNING: Port 3000 is already in use!
    echo.
    echo Finding and killing processes using port 3000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        echo Killing process %%a...
        taskkill /PID %%a /F >nul 2>&1
    )
    echo.
    echo Waiting 3 seconds for processes to close...
    timeout /t 3 /nobreak >nul
    echo.
)

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo.
echo Checking if npm dependencies are installed...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

echo.
echo Starting the game server...
echo Server will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node server.js

echo.
echo Server stopped.
pause