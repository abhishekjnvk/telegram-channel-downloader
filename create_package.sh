#!/bin/bash

# Script to create a distributable package of Telegram Channel Downloader v2.0

PACKAGE_NAME="telegram-channel-downloader-v2.0"
TEMP_DIR="/tmp/$PACKAGE_NAME"

echo "📦 Creating package: $PACKAGE_NAME"
echo ""

# Create temporary directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy files
echo "📋 Copying files..."
cp package.json "$TEMP_DIR/"
cp config.json.dist "$TEMP_DIR/"
cp config.example.json "$TEMP_DIR/"
cp index.js "$TEMP_DIR/"
cp cli.js "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"
cp CHANGELOG.md "$TEMP_DIR/"
cp .gitignore "$TEMP_DIR/"
cp install.sh "$TEMP_DIR/"
cp install.bat "$TEMP_DIR/"

# Create utils directory
mkdir -p "$TEMP_DIR/utils"
cp utils/helpers.js "$TEMP_DIR/utils/" 2>/dev/null || echo "Note: utils/helpers.js not found, skipping"

# Make scripts executable
chmod +x "$TEMP_DIR/install.sh"
chmod +x "$TEMP_DIR/cli.js"

echo "✓ Files copied"
echo ""

# Create ZIP
echo "🗜️  Creating ZIP archive..."
cd /tmp
zip -r "$PACKAGE_NAME.zip" "$PACKAGE_NAME" -q

if [ $? -eq 0 ]; then
    # Move to current directory
    mv "$PACKAGE_NAME.zip" "$OLDPWD/"
    echo "✓ Package created successfully!"
    echo ""
    echo "📦 Package location: $OLDPWD/$PACKAGE_NAME.zip"
    echo ""
    
    # Show package info
    echo "Package contents:"
    unzip -l "$OLDPWD/$PACKAGE_NAME.zip" | tail -n +4 | head -n -2
    
    # Cleanup
    rm -rf "$TEMP_DIR"
else
    echo "❌ Failed to create ZIP archive"
    exit 1
fi

echo ""
echo "✅ Done! You can now distribute $PACKAGE_NAME.zip"