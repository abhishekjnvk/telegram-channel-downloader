# Telegram Channel Downloader

**Telegram Channel Downloader** is a TypeScript/Node.js application that allows users to download media files and messages in HTML and JSON formats from Telegram channels, groups, or users. This tool simplifies the process of archiving content from Telegram for offline viewing or storage.

## Sponsor the Project

<p>Support the project by buying me a coffee! Every contribution helps keep the project running.</p>
<a href="https://www.buymeacoffee.com/abhishekjnvk" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Requirements

- Node.js >= 18
- TypeScript >= 5.9 (for development)

## Setup

To use the Telegram Channel Downloader, follow these steps:

1. **Create a Telegram App**: Go to [https://my.telegram.org/apps](https://my.telegram.org/apps) and create a new application.
2. **Get API Credentials**: After creating the app, copy the API ID and API Hash provided by Telegram.

### Configure Credentials

You can provide credentials in two ways:

**Option A: `config.json` file**

3. In the root directory of the application, create a file named `config.json`:

    ```json
    {
        "apiId": "YOUR_API_ID",
        "apiHash": "YOUR_API_HASH",
        "sessionId": ""
    }
    ```

    Replace `YOUR_API_ID` and `YOUR_API_HASH` with the values obtained in step 2. Keep the `sessionId` blank for now; it will be updated automatically after logging in for the first time.

**Option B: Environment variables**

   ```bash
   export TELEGRAM_API_ID="YOUR_API_ID"
   export TELEGRAM_API_HASH="YOUR_API_HASH"
   export TELEGRAM_SESSION=""  # optional, leave empty for first login
   ```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (uses tsx, no build step needed)
npm run dev

# Run a specific command in dev mode
npm run dev:direct -- download-channel --channelId=12345

# Type-check without emitting
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

## Build & Production

```bash
# Build TypeScript to dist/
npm run build

# Run the compiled CLI
npm start

# Or use the bin alias
npx tgdl download-channel --channelId=12345
```

## Usage

Once the setup is complete, you can start using the Telegram Channel Downloader:

1. **Login**: The script will prompt you to enter your phone number and the code sent to your phone or Telegram account. This authentication is required only the first time you run the script.

2. **Select Chat/Channel/Group**: After logging in, choose the target chat, channel, or group you want to scrape. Use the arrow keys to move and select the target chat.

3. **Wait for Download**: The script will start downloading all available media files and messages from the specified channel, group, or user. Depending on the size of the content, this process may take some time.

4. **Access Downloaded Files**: Once the download is complete, you can find the downloaded media files and messages in the `export/` directory.

## CLI

Available Commands:

| Command | Description |
|---------|-------------|
| `download-channel` | Download all media from a channel |
| `download-selected-message` | Download media from selected messages |
| `listen-channel` | Listen to a channel and download media from incoming messages |

### Examples

```bash
# List available commands
npm start

# Download all media from a channel (interactive selection)
npm start -- download-channel

# Download all media from a specific channel
npm start -- download-channel --channelId=12345

# Download specific messages
npm start -- download-selected-message --channelId=12345 --messageIds=100,101,102

# Listen for new messages in a channel
npm start -- listen-channel --channelId=12345

# Show help for a command
npm start -- download-channel --help
```

## Programmatic Usage

```typescript
import DownloadChannel from "telegram-channel-downloader";

const downloader = new DownloadChannel();
await downloader.handle({ channelId: "12345" });
```

## Project Structure

```
src/
├── cli.ts                  # CLI entry point
├── index.ts                # Programmatic API entry point
├── types/
│   └── index.ts            # Shared TypeScript types & interfaces
├── utils/
│   ├── logger.ts           # Logging utility
│   ├── helper.ts           # Media/file utilities
│   ├── file-helper.ts      # Config & file I/O
│   └── input-helper.ts     # Interactive prompts (inquirer)
├── modules/
│   ├── auth.ts             # Telegram authentication
│   ├── dialogs.ts          # Dialog/channel listing
│   └── messages.ts         # Message fetching & media download
└── scripts/
    ├── download-channel.ts         # Download all media from a channel
    ├── download-selected-message.ts # Download specific messages
    └── listen-channel.ts           # Listen for new messages
templates/
└── channels.ejs            # HTML template for dialog list
```

## Additional Notes

- **Session Handling**: The `sessionId` field in `config.json` (or `TELEGRAM_SESSION` env var) will be automatically updated after logging in for the first time.
- **Media Types**: Supports downloading images, videos, audio files, documents, and other attachments.
- **TypeScript**: Full type safety with strict mode enabled. Type definitions are generated in `dist/`.

## Contributing

Contributions are welcome! If you have any suggestions, bug reports, or feature requests, please open an issue or submit a pull request.

Happy coding
