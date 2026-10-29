#!/usr/bin/env bash
# Telegram Channel Downloader — Unix/Linux/macOS install script
set -euo pipefail

echo "=== Telegram Channel Downloader — Installer ==="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Please install Node.js >= 18 from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js >= 18 is required (found v$(node -v))."
  echo "Please upgrade from https://nodejs.org/"
  exit 1
fi

echo "Node.js $(node -v) detected."
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo ""
echo "Building project..."
npm run build

# Create config.json from template if it doesn't exist
if [ ! -f config.json ]; then
  echo ""
  echo "Creating config.json from template..."
  cp config.json.dist config.json
  echo ""
  echo "IMPORTANT: Edit config.json and add your Telegram API credentials."
  echo "Get them from https://my.telegram.org/apps"
fi

echo ""
echo "=== Installation complete! ==="
echo ""
echo "Next steps:"
echo "  1. Edit config.json with your API credentials"
echo "  2. Run: npm start"
echo "  3. Or:  npx tgdl --help"
echo ""
