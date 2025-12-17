# Telegram Channel Downloader v2.0 - File Structure

## 📁 Complete Directory Structure

```
telegram-channel-downloader-v2.0/
│
├── 📄 package.json                 # Node.js dependencies and scripts
├── 📄 config.json.dist             # Configuration template
├── 📄 config.example.json          # Configuration with detailed comments
├── 📄 .gitignore                   # Git ignore rules
│
├── 📄 index.js                     # Main application (interactive mode)
├── 📄 cli.js                       # CLI with advanced commands
│
├── 📁 utils/
│   └── 📄 helpers.js               # Utility functions
│
├── 📄 README.md                    # Complete documentation
├── 📄 CHANGELOG.md                 # Version history and improvements
├── 📄 FILE_STRUCTURE.md            # This file
│
├── 📄 install.sh                   # Unix/Linux/Mac installation script
├── 📄 install.bat                  # Windows installation script
│
├── 📄 create_package.sh            # Create ZIP package (Unix)
└── 📄 create_package.bat           # Create ZIP package (Windows)
```

## 📝 File Descriptions

### Core Files

#### `package.json`
- Defines project dependencies
- Contains npm scripts
- Version and metadata information

**Key Dependencies:**
- `telegram@2.22.2` - Telegram API client
- `cli-progress@3.12.0` - Progress bars
- `chalk@4.1.2` - Colored terminal output
- `prompts@2.4.2` - Interactive prompts
- `p-limit@3.1.0` - Concurrency control
- `fs-extra@11.2.0` - Enhanced file operations

#### `index.js`
Main application file with `TelegramDownloader` class.

**Features:**
- Interactive channel selection with autocomplete
- Concurrent download management
- Progress tracking and statistics
- Automatic retry on failures
- Skip existing files
- Date range filtering

**Main Methods:**
- `initClient()` - Initialize Telegram client
- `getDialogs()` - Fetch user's channels/groups
- `selectChannel()` - Interactive channel selection
- `getMessages()` - Fetch messages with filters
- `downloadFile()` - Download individual file with retry
- `downloadChannel()` - Main download orchestration
- `run()` - Entry point

#### `cli.js`
Command-line interface with advanced features.

**Commands:**
- `listen-channel` - Monitor channel for new media
- `download-selected` - Download specific message IDs
- `download-bulk` - Process multiple channels
- `export-chat-list` - Export channel list to JSON

**Usage:**
```bash
node cli.js [command] [options]
```

#### `utils/helpers.js`
Utility functions used throughout the application.

**Functions:**
- `formatBytes()` - Human-readable file sizes
- `formatDuration()` - Human-readable time
- `sanitizeFilename()` - Safe filename creation
- `fileExistsAndValid()` - Check file existence
- `getExtensionFromMimeType()` - MIME to extension mapping
- `retryWithBackoff()` - Retry logic with delays
- `parseDate()` - Date string parsing
- `isValidChannelId()` - Validate channel IDs
- `getMediaType()` - Determine media type
- Plus many more...

### Configuration Files

#### `config.json.dist`
Basic configuration template.

**Must be copied to `config.json` and filled with:**
- API ID from https://my.telegram.org/apps
- API Hash from https://my.telegram.org/apps

#### `config.example.json`
Detailed configuration with comments explaining each option.

**Sections:**
- API credentials
- Download settings
- Date filters
- Export settings
- Media type filters
- Usage examples

### Documentation

#### `README.md`
Complete user documentation including:
- Installation instructions
- Usage examples
- Configuration options
- CLI commands
- Troubleshooting
- Performance metrics

#### `CHANGELOG.md`
Detailed version history documenting:
- New features
- Bug fixes
- Performance improvements
- Breaking changes
- Migration guides

#### `FILE_STRUCTURE.md`
This file - explains the project structure.

### Installation Scripts

#### `install.sh` (Unix/Linux/Mac)
Automated installation script that:
- Checks Node.js version
- Installs npm dependencies
- Creates config.json from template
- Provides next steps

**Usage:**
```bash
chmod +x install.sh
./install.sh
```

#### `install.bat` (Windows)
Windows equivalent of install.sh.

**Usage:**
```cmd
install.bat
```

### Packaging Scripts

#### `create_package.sh` (Unix)
Creates distributable ZIP package.

**Process:**
- Creates temporary directory
- Copies all necessary files
- Creates ZIP archive
- Shows package contents
- Cleans up temporary files

**Usage:**
```bash
chmod +x create_package.sh
./create_package.sh
```

#### `create_package.bat` (Windows)
Windows packaging script.

**Requirements:**
- 7-Zip or WinRAR installed

**Usage:**
```cmd
create_package.bat
```

### Generated Files (Not in repository)

These files are created during usage:

```
telegram-channel-downloader-v2.0/
│
├── 📄 config.json              # Your actual config (created from .dist)
├── 📄 package-lock.json        # npm dependency lock file
│
├── 📁 node_modules/            # npm dependencies (npm install)
│   └── [various packages]
│
├── 📁 export/                  # Downloaded content (configurable)
│   ├── 📁 Channel_Name_1/
│   │   ├── 12345_file1.jpg
│   │   ├── 12346_file2.mp4
│   │   └── messages.json
│   └── 📁 Channel_Name_2/
│       └── ...
│
└── 📄 chat_list.json          # Exported chat list (optional)
```

## 🚀 Quick Start

### For Users

1. **Download the package**
   ```bash
   # Extract the ZIP file
   unzip telegram-channel-downloader-v2.0.zip
   cd telegram-channel-downloader-v2.0
   ```

2. **Run installation script**
   ```bash
   # Unix/Linux/Mac
   ./install.sh
   
   # Windows
   install.bat
   ```

3. **Configure**
   ```bash
   # Edit config.json with your API credentials
   nano config.json  # or use any text editor
   ```

4. **Run**
   ```bash
   npm start
   ```

### For Developers

1. **Clone or extract**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Copy config**
   ```bash
   cp config.json.dist config.json
   ```
4. **Edit config.json**
5. **Start developing**

## 📦 Dependencies Overview

### Production Dependencies
- `telegram` - Telegram MTProto API client
- `input` - User input handling
- `big-integer` - Large number handling for Telegram
- `fs-extra` - Enhanced file system operations
- `cli-progress` - Terminal progress bars
- `chalk` - Terminal string styling
- `prompts` - Interactive CLI prompts
- `p-queue` - Promise queue with concurrency control
- `p-limit` - Concurrent operation limiter

### Why These Dependencies?

- **telegram**: Official Node.js implementation of Telegram's API
- **cli-progress**: Professional progress bars with ETA and speed
- **chalk**: Makes terminal output readable and attractive
- **prompts**: Better UX for interactive selection
- **p-limit**: Essential for controlling concurrent downloads
- **fs-extra**: Reliable file operations with promises

## 🔧 Customization Points

### Easy to Modify

1. **Concurrent Downloads**
   - File: `config.json`
   - Setting: `downloadSettings.concurrentDownloads`

2. **Media Types**
   - File: `config.json`
   - Setting: `exportSettings.mediaTypes`

3. **Output Directory**
   - File: `config.json`
   - Setting: `exportSettings.outputDir`

4. **Date Filtering**
   - File: `config.json`
   - Setting: `downloadSettings.dateFilter`

### For Developers

1. **Add New CLI Command**
   - File: `cli.js`
   - Add function and register in `commands` object

2. **Add New Utility**
   - File: `utils/helpers.js`
   - Add function and export it

3. **Modify Download Logic**
   - File: `index.js`
   - Method: `downloadFile()` or `downloadChannel()`

4. **Add New Media Type**
   - File: `index.js`
   - Method: `shouldDownloadMedia()`
   - Also update: `utils/helpers.js` `getExtensionFromMimeType()`

## 📊 Code Statistics

- **Total Files**: 13 source files + documentation
- **Total Lines**: ~2000+ lines of code
- **Languages**: JavaScript, Bash, Batch, Markdown
- **Dependencies**: 8 production packages

## 🎯 Architecture Overview

```
User Input
    ↓
Interactive Mode (index.js) or CLI Mode (cli.js)
    ↓
TelegramDownloader Class
    ↓
├── Authentication (Telegram Client)
├── Channel Selection (Prompts)
├── Message Fetching (Telegram API)
├── Filtering (Date, Media Type)
└── Download Manager
    ↓
    ├── Concurrent Downloads (p-limit)
    ├── Retry Logic (utils/helpers)
    ├── Progress Tracking (cli-progress)
    └── File Operations (fs-extra)
        ↓
        Output (export/ directory)
```

## 🔐 Security Notes

- **config.json** contains sensitive data (sessionId)
- **Never commit config.json** to version control
- **.gitignore** prevents accidental commits
- **Session data** enables authentication without passwords

## 📝 License

MIT License - See repository for details

---

**Created**: December 2024  
**Version**: 2.0.0  
**Improved by**: Community contribution  
**Based on**: [abhishekjnvk/telegram-channel-downloader](https://github.com/abhishekjnvk/telegram-channel-downloader)