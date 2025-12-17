@echo off
setlocal enabledelayedexpansion

set PACKAGE_NAME=telegram-channel-downloader-v2.0

echo.
echo 📦 Creating package: %PACKAGE_NAME%
echo.

REM Check if 7zip or WinRAR is available
where 7z >nul 2>nul
if %errorlevel% equ 0 (
    set ZIPPER=7z
    goto :create_package
)

where winrar >nul 2>nul
if %errorlevel% equ 0 (
    set ZIPPER=winrar
    goto :create_package
)

echo ❌ Error: No compression tool found
echo Please install 7-Zip or WinRAR to create the package
echo.
echo Download 7-Zip: https://www.7-zip.org/
pause
exit /b 1

:create_package

REM Create temporary directory
set TEMP_DIR=%TEMP%\%PACKAGE_NAME%
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo 📋 Copying files...

REM Copy main files
copy package.json "%TEMP_DIR%\" >nul
copy config.json.dist "%TEMP_DIR%\" >nul
copy config.example.json "%TEMP_DIR%\" >nul
copy index.js "%TEMP_DIR%\" >nul
copy cli.js "%TEMP_DIR%\" >nul
copy README.md "%TEMP_DIR%\" >nul
copy CHANGELOG.md "%TEMP_DIR%\" >nul
copy .gitignore "%TEMP_DIR%\" >nul
copy install.sh "%TEMP_DIR%\" >nul
copy install.bat "%TEMP_DIR%\" >nul

REM Copy utils directory
if exist "utils" (
    mkdir "%TEMP_DIR%\utils"
    copy utils\*.js "%TEMP_DIR%\utils\" >nul 2>&1
)

echo ✓ Files copied
echo.

REM Create ZIP
echo 🗜️  Creating ZIP archive...

if "%ZIPPER%"=="7z" (
    7z a -tzip "%PACKAGE_NAME%.zip" "%TEMP_DIR%\*" -mx9 >nul
) else (
    winrar a -afzip -r "%PACKAGE_NAME%.zip" "%TEMP_DIR%\*" >nul
)

if %errorlevel% equ 0 (
    echo ✓ Package created successfully!
    echo.
    echo 📦 Package location: %CD%\%PACKAGE_NAME%.zip
    echo.
    
    REM Cleanup
    rmdir /s /q "%TEMP_DIR%"
    
    echo ✅ Done! You can now distribute %PACKAGE_NAME%.zip
) else (
    echo ❌ Failed to create ZIP archive
    pause
    exit /b 1
)

echo.
pause