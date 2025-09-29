@echo off
echo Testing Chok Hmong Server...
echo.

echo 1. Checking if server is running on port 3000...
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo ✅ Server is running on port 3000
) else (
    echo ❌ Server is NOT running on port 3000
    echo Please run start-game.bat first
    pause
    exit /b 1
)

echo.
echo 2. Testing server response...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Server is responding to requests
) else (
    echo ❌ Server is not responding
    echo Make sure the server is running and accessible
)

echo.
echo 3. Checking game files...
if exist "index.html" (
    echo ✅ index.html found
) else (
    echo ❌ index.html missing
)

if exist "multiPlayer.html" (
    echo ✅ multiPlayer.html found
) else (
    echo ❌ multiPlayer.html missing
)

if exist "script.js" (
    echo ✅ script.js found
) else (
    echo ❌ script.js missing
)

if exist "server.js" (
    echo ✅ server.js found
) else (
    echo ❌ server.js missing
)

echo.
echo ========================================
echo 🎮 Game is ready to play!
echo Open your browser and go to:
echo http://localhost:3000
echo ========================================
echo.
pause
