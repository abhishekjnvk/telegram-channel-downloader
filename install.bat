@echo off
echo.
echo 🚀 Telegram Channel Downloader v2.0 - Installation Script
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 14.x or higher.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js detected
node -v
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✓ Dependencies installed successfully
echo.

REM Create config file if it doesn't exist
if not exist "config.json" (
    echo 📝 Creating config.json from template...
    copy config.json.dist config.json
    echo ✓ Config file created
    echo.
    echo ⚠️  IMPORTANT: Edit config.json and add your Telegram API credentials
    echo    Get them from: https://my.telegram.org/apps
) else (
    echo ✓ Config file already exists
)

echo.
echo ✅ Installation complete!
echo.
echo Next steps:
echo 1. Edit config.json and add your API credentials
echo 2. Run: npm start
echo.
echo For advanced usage, see README.md
echo.
pause