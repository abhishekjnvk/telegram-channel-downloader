@echo off
REM Telegram Channel Downloader — Windows install script
setlocal EnableDelayedExpansion

echo === Telegram Channel Downloader — Installer ===
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ERROR: Node.js is not installed.
  echo Please install Node.js ^>= 18 from https://nodejs.org/
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo Node.js %NODE_VER% detected.
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
  echo ERROR: npm install failed.
  exit /b 1
)

REM Build TypeScript
echo.
echo Building project...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo ERROR: build failed.
  exit /b 1
)

REM Create config.json from template if it doesn't exist
if not exist config.json (
  echo.
  echo Creating config.json from template...
  copy config.json.dist config.json >nul
  echo.
  echo IMPORTANT: Edit config.json and add your Telegram API credentials.
  echo Get them from https://my.telegram.org/apps
)

echo.
echo === Installation complete! ===
echo.
echo Next steps:
echo   1. Edit config.json with your API credentials
echo   2. Run: npm start
echo   3. Or:  npx tgdl --help
echo.
endlocal
