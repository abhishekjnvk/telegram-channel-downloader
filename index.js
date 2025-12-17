const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs-extra');
const path = require('path');
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const prompts = require('prompts');
const pLimit = require('p-limit');
const { Api } = require('telegram/tl');

class TelegramDownloader {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.client = null;
    this.progressBar = null;
    this.stats = {
      total: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      totalSize: 0
    };
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      console.log(chalk.red('Config file not found! Please create config.json from config.json.dist'));
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async initClient() {
    const stringSession = new StringSession(this.config.sessionId);
    
    this.client = new TelegramClient(
      stringSession,
      parseInt(this.config.apiId),
      this.config.apiHash,
      {
        connectionRetries: 5,
        timeout: 30000
      }
    );

    await this.client.connect();

    if (!this.client.isUserAuthorized()) {
      console.log(chalk.yellow('First time login required...'));
      const phoneNumber = await input.text('Enter your phone number (with country code): ');
      await this.client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => await input.text('Enter your 2FA password (if any): '),
        phoneCode: async () => await input.text('Enter the code you received: '),
        onError: (err) => console.log(chalk.red(err)),
      });

      this.config.sessionId = this.client.session.save();
      this.saveConfig();
      console.log(chalk.green('✓ Login successful! Session saved.'));
    } else {
      console.log(chalk.green('✓ Connected using saved session'));
    }
  }

  async getDialogs() {
    const dialogs = await this.client.getDialogs({ limit: 100 });
    return dialogs
      .filter(d => d.isChannel || d.isGroup)
      .map(d => ({
        id: d.id.toString(),
        title: d.title,
        type: d.isChannel ? 'Channel' : 'Group'
      }));
  }

  async selectChannel() {
    console.log(chalk.cyan('\nFetching your channels and groups...'));
    const dialogs = await this.getDialogs();

    const choices = dialogs.map(d => ({
      title: `${d.title} (${d.type})`,
      value: d.id
    }));

    const response = await prompts({
      type: 'autocomplete',
      name: 'channelId',
      message: 'Select a channel or group:',
      choices: choices,
      limit: 10
    });

    if (!response.channelId) {
      console.log(chalk.red('No channel selected. Exiting...'));
      process.exit(0);
    }

    return response.channelId;
  }

  async getMessages(channelId, limit = null) {
    const entity = await this.client.getEntity(channelId);
    const messages = [];
    let offset = 0;
    const batchSize = 100;

    console.log(chalk.cyan('\nFetching messages...'));
    
    const { startDate, endDate, enabled } = this.config.downloadSettings.dateFilter;
    const startTimestamp = enabled && startDate ? new Date(startDate).getTime() / 1000 : null;
    const endTimestamp = enabled && endDate ? new Date(endDate).getTime() / 1000 : null;

    while (true) {
      const batch = await this.client.getMessages(entity, {
        limit: limit ? Math.min(batchSize, limit - messages.length) : batchSize,
        offsetId: offset
      });

      if (batch.length === 0) break;

      for (const msg of batch) {
        if (msg.date) {
          const msgTime = msg.date;
          if (startTimestamp && msgTime < startTimestamp) continue;
          if (endTimestamp && msgTime > endTimestamp) continue;
        }
        
        if (msg.media && this.shouldDownloadMedia(msg.media)) {
          messages.push(msg);
        }
      }

      offset = batch[batch.length - 1].id;
      process.stdout.write(`\rFetched ${messages.length} messages with media...`);

      if (limit && messages.length >= limit) break;
      if (batch.length < batchSize) break;
    }

    console.log(chalk.green(`\n✓ Found ${messages.length} messages with downloadable media`));
    return messages;
  }

  shouldDownloadMedia(media) {
    const types = this.config.exportSettings.mediaTypes;
    
    if (media.className === 'MessageMediaPhoto' && types.includes('photo')) return true;
    if (media.className === 'MessageMediaDocument') {
      const doc = media.document;
      if (!doc) return false;
      
      const mimeType = doc.mimeType || '';
      if (mimeType.startsWith('video/') && types.includes('video')) return true;
      if (mimeType.startsWith('audio/') && types.includes('audio')) return true;
      if (types.includes('document')) return true;
    }
    
    return false;
  }

  getFileName(message, index) {
    const media = message.media;
    let fileName = `${message.id}_${index}`;
    
    if (media.className === 'MessageMediaDocument' && media.document) {
      const doc = media.document;
      
      // Try to get original filename from attributes
      for (const attr of doc.attributes || []) {
        if (attr.className === 'DocumentAttributeFilename') {
          return `${message.id}_${attr.fileName}`;
        }
      }
      
      // Generate filename based on mime type
      const ext = this.getExtensionFromMimeType(doc.mimeType);
      fileName += ext;
    } else if (media.className === 'MessageMediaPhoto') {
      fileName += '.jpg';
    }
    
    return fileName;
  }

  getExtensionFromMimeType(mimeType) {
    const map = {
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'video/mkv': '.mkv',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'application/x-rar': '.rar'
    };
    
    return map[mimeType] || '';
  }

  async downloadFile(message, outputPath, fileName) {
    const fullPath = path.join(outputPath, fileName);
    
    // Skip if file exists and skipExisting is enabled
    if (this.config.downloadSettings.skipExisting && fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.size > 0) {
        this.stats.skipped++;
        return { success: true, skipped: true, path: fullPath };
      }
    }

    const tempPath = fullPath + '.tmp';
    let attempts = 0;
    const maxAttempts = this.config.downloadSettings.retryAttempts;

    while (attempts < maxAttempts) {
      try {
        await fs.ensureDir(outputPath);
        
        await this.client.downloadMedia(message.media, {
          outputFile: tempPath,
          progressCallback: (downloaded, total) => {
            // Progress callback for individual file
          },
          workers: 1
        });

        // Move temp file to final location
        await fs.move(tempPath, fullPath, { overwrite: true });
        
        const stats = fs.statSync(fullPath);
        this.stats.totalSize += stats.size;
        this.stats.downloaded++;
        
        return { success: true, skipped: false, path: fullPath, size: stats.size };
      } catch (error) {
        attempts++;
        console.log(chalk.yellow(`\n⚠ Retry ${attempts}/${maxAttempts} for ${fileName}: ${error.message}`));
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.downloadSettings.retryDelay));
        } else {
          // Clean up temp file on final failure
          if (fs.existsSync(tempPath)) {
            await fs.remove(tempPath);
          }
          this.stats.failed++;
          return { success: false, error: error.message };
        }
      }
    }
  }

  async downloadChannel(channelId) {
    console.log(chalk.cyan('\n=== Starting Download ===\n'));
    
    const entity = await this.client.getEntity(channelId);
    const channelName = entity.title.replace(/[^a-z0-9]/gi, '_');
    const outputPath = path.join(this.config.exportSettings.outputDir, channelName);
    
    await fs.ensureDir(outputPath);
    
    const messages = await this.getMessages(channelId);
    this.stats.total = messages.length;

    if (messages.length === 0) {
      console.log(chalk.yellow('No media found to download.'));
      return;
    }

    // Initialize progress bar
    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} Files | Speed: {speed} | ETA: {eta_formatted}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    this.progressBar.start(messages.length, 0, { speed: 'N/A' });

    // Download with concurrency limit
    const limit = pLimit(this.config.downloadSettings.concurrentDownloads);
    const startTime = Date.now();
    
    const tasks = messages.map((msg, idx) => 
      limit(async () => {
        const fileName = this.getFileName(msg, idx);
        const result = await this.downloadFile(msg, outputPath, fileName);
        
        const completed = this.stats.downloaded + this.stats.skipped + this.stats.failed;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = completed / elapsed;
        
        this.progressBar.update(completed, { 
          speed: `${speed.toFixed(2)} files/s` 
        });
        
        return result;
      })
    );

    await Promise.all(tasks);
    
    this.progressBar.stop();
    
    // Save messages metadata
    if (this.config.exportSettings.saveMessages) {
      const metadataPath = path.join(outputPath, 'messages.json');
      const messagesData = messages.map(msg => ({
        id: msg.id,
        date: msg.date,
        text: msg.text,
        media: msg.media ? msg.media.className : null
      }));
      await fs.writeJson(metadataPath, messagesData, { spaces: 2 });
    }

    this.printStats(outputPath);
  }

  printStats(outputPath) {
    console.log(chalk.cyan('\n=== Download Complete ===\n'));
    console.log(chalk.green(`✓ Downloaded: ${this.stats.downloaded} files`));
    console.log(chalk.yellow(`⊘ Skipped: ${this.stats.skipped} files`));
    console.log(chalk.red(`✗ Failed: ${this.stats.failed} files`));
    console.log(chalk.blue(`📦 Total Size: ${this.formatBytes(this.stats.totalSize)}`));
    console.log(chalk.cyan(`📁 Output: ${outputPath}\n`));
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  async run() {
    try {
      console.log(chalk.blue.bold('\n🚀 Telegram Channel Downloader v2.0\n'));
      
      await this.initClient();
      const channelId = await this.selectChannel();
      await this.downloadChannel(channelId);
      
      await this.client.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      if (this.client) await this.client.disconnect();
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const downloader = new TelegramDownloader();
  downloader.run();
}

module.exports = TelegramDownloader;