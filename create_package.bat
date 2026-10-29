@echo off
REM Creates a distributable package (zip) of the project
setlocal EnableDelayedExpansion

echo === Creating distributable package ===
echo.

REM Clean and build
call npm run clean
call npm install --production
call npm run build

REM Get version
for /f "tokens=*" %%v in ('node -p "require('./package.json').version"') do set VERSION=%%v
set PKG_NAME=telegram-channel-downloader-%VERSION%
set PKG_DIR=%TEMP%\%PKG_NAME%

if exist "%PKG_DIR%" rmdir /s /q "%PKG_DIR%"
mkdir "%PKG_DIR%"

REM Copy files
xcopy /E /I dist "%PKG_DIR%\dist\" >nul
xcopy /E /I templates "%PKG_DIR%\templates\" >nul
copy package.json "%PKG_DIR%\" >nul
copy config.json.dist "%PKG_DIR%\" >nul
copy Readme.md "%PKG_DIR%\" >nul
copy install.bat "%PKG_DIR%\" >nul

echo.
echo Creating archive...
powershell -Command "Compress-Archive -Path '%PKG_DIR%' -DestinationPath '%PKG_NAME%.zip' -Force"

echo.
echo === Package created: %PKG_NAME%.zip ===
endlocal
