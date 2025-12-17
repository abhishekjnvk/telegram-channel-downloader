#!/bin/bash

echo "🚀 Telegram Channel Downloader v2.0 - Installation Script"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14.x or higher."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14 or higher is required. You have: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed successfully"
echo ""

# Create config file if it doesn't exist
if [ ! -f "config.json" ]; then
    echo "📝 Creating config.json from template..."
    cp config.json.dist config.json
    echo "✓ Config file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit config.json and add your Telegram API credentials"
    echo "   Get them from: https://my.telegram.org/apps"
else
    echo "✓ Config file already exists"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit config.json and add your API credentials"
echo "2. Run: npm start"
echo ""
echo "For advanced usage, see: node cli.js --help"
echo ""