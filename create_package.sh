#!/usr/bin/env bash
# Creates a distributable package (tar.gz) of the project
set -euo pipefail

echo "=== Creating distributable package ==="
echo ""

# Clean and build
npm run clean
npm install --production
npm run build

# Create package directory
PKG_NAME="telegram-channel-downloader-$(node -p "require('./package.json').version")"
PKG_DIR="/tmp/$PKG_NAME"
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"

# Copy files
cp -r dist/ "$PKG_DIR/"
cp -r templates/ "$PKG_DIR/"
cp package.json "$PKG_DIR/"
cp config.json.dist "$PKG_DIR/"
cp Readme.md "$PKG_DIR/"
cp install.sh "$PKG_DIR/"

echo ""
echo "Creating archive..."
tar -czf "${PKG_NAME}.tar.gz" -C /tmp "$PKG_NAME"

echo ""
echo "=== Package created: ${PKG_NAME}.tar.gz ==="
echo "Size: $(du -h "${PKG_NAME}.tar.gz" | cut -f1)"
