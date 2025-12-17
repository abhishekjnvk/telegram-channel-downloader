#!/usr/bin/env node

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const prompts = require('prompts');

const commands = {
  'listen-channel': listenChannel,
  'download-selected': downloadSelected,
  'download-bulk': downloadBulk,
  'export-chat-list': exportChatList
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = {};

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    options[key] = value || true;
  }
}

async function initClient() {
  const configPath = './config.json';
  if (!fs.existsSync(configPath)) {
    console.log(chalk.red('Config file not found!'));
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const stringSession = new StringSession(config.sessionId);
  
  const client = new TelegramClient(
    stringSession,
    parseInt(config.apiId),
    config.apiHash,
    { connectionRetries: 5 }
  );

  await client.connect();

  if (!client.isUserAuthorized()) {
    const phoneNumber = await input.text('Enter phone: ');
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => await input.text('Password: '),
      phoneCode: async () => await input.text('Code: '),
      onError: (err) => console.log(err),
    });

    config.sessionId = client.session.save();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return { client, config };
}

async function listenChannel() {
  console.log(chalk.cyan('🎧 Listen Mode - Monitoring for new messages\n'));
  
  const { client, config } = await initClient();
  const channelId = options.channelId;
  
  if (!channelId) {
    console.log(chalk.red('Error: --channelId required'));
    process.exit(1);
  }

  const entity = await client.getEntity(channelId);
  const channelName = entity.title.replace(/[^a-z0-9]/gi, '_');
  const outputPath = path.join(config.exportSettings.outputDir, channelName);
  await fs.ensureDir(outputPath);

  console.log(chalk.green(`✓ Listening to: ${entity.title}`));
  console.log(chalk.yellow('Press Ctrl+C to stop\n'));

  let lastMessageId = 0;

  // Get latest message ID
  const messages = await client.getMessages(entity, { limit: 1 });
  if (messages.length > 0) {
    lastMessageId = messages[0].id;
  }

  const checkInterval = parseInt(options.interval || '5000');

  setInterval(async () => {
    try {
      const newMessages = await client.getMessages(entity, { 
        minId: lastMessageId,
        limit: 10
      });

      for (const msg of newMessages.reverse()) {
        if (msg.id > lastMessageId) {
          lastMessageId = msg.id;
          
          if (msg.media) {
            console.log(chalk.cyan(`📥 New media message: ${msg.id}`));
            
            const fileName = `${msg.id}_${Date.now()}`;
            const ext = getMediaExtension(msg.media);
            const fullPath = path.join(outputPath, fileName + ext);
            
            try {
              await client.downloadMedia(msg.media, { outputFile: fullPath });
              console.log(chalk.green(`✓ Downloaded: ${fileName + ext}`));
            } catch (error) {
              console.log(chalk.red(`✗ Failed: ${error.message}`));
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error checking messages: ${error.message}`));
    }
  }, checkInterval);
}

async function downloadSelected() {
  console.log(chalk.cyan('📋 Download Selected Messages\n'));
  
  const { client, config } = await initClient();
  const channelId = options.channelId;
  const messageIds = options.messageIds ? options.messageIds.split(',').map(id => parseInt(id)) : [];

  if (!channelId || messageIds.length === 0) {
    console.log(chalk.red('Error: --channelId and --messageIds required'));
    console.log(chalk.yellow('Example: --channelId=123456 --messageIds=100,101,102'));
    process.exit(1);
  }

  const entity = await client.getEntity(channelId);
  const channelName = entity.title.replace(/[^a-z0-9]/gi, '_');
  const outputPath = path.join(config.exportSettings.outputDir, channelName);
  await fs.ensureDir(outputPath);

  console.log(chalk.green(`Downloading ${messageIds.length} messages from ${entity.title}\n`));

  for (const msgId of messageIds) {
    try {
      const messages = await client.getMessages(entity, { ids: [msgId] });
      const msg = messages[0];

      if (msg && msg.media) {
        const fileName = `${msg.id}_${Date.now()}`;
        const ext = getMediaExtension(msg.media);
        const fullPath = path.join(outputPath, fileName + ext);

        await client.downloadMedia(msg.media, { outputFile: fullPath });
        console.log(chalk.green(`✓ Downloaded message ${msgId}`));
      } else {
        console.log(chalk.yellow(`⊘ Message ${msgId} has no media`));
      }
    } catch (error) {
      console.log(chalk.red(`✗ Failed message ${msgId}: ${error.message}`));
    }
  }

  await client.disconnect();
}

async function downloadBulk() {
  console.log(chalk.cyan('📦 Bulk Download Multiple Channels\n'));
  
  const { client, config } = await initClient();
  const channelIds = options.channelIds ? options.channelIds.split(',') : [];

  if (channelIds.length === 0) {
    // Interactive mode - let user select multiple channels
    const dialogs = await client.getDialogs({ limit: 100 });
    const choices = dialogs
      .filter(d => d.isChannel || d.isGroup)
      .map(d => ({
        title: `${d.title} (${d.isChannel ? 'Channel' : 'Group'})`,
        value: d.id.toString()
      }));

    const response = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Select channels to download (Space to select, Enter to confirm):',
      choices: choices,
      min: 1
    });

    if (!response.selected || response.selected.length === 0) {
      console.log(chalk.yellow('No channels selected'));
      process.exit(0);
    }

    channelIds.push(...response.selected);
  }

  console.log(chalk.green(`\n📥 Downloading from ${channelIds.length} channels\n`));

  for (const channelId of channelIds) {
    try {
      const entity = await client.getEntity(channelId);
      console.log(chalk.cyan(`\n▶ Processing: ${entity.title}`));
      
      // Use the main downloader class
      const TelegramDownloader = require('./index.js');
      const downloader = new TelegramDownloader();
      downloader.client = client;
      await downloader.downloadChannel(channelId);
      
    } catch (error) {
      console.log(chalk.red(`✗ Failed to download ${channelId}: ${error.message}`));
    }
  }

  await client.disconnect();
}

async function exportChatList() {
  console.log(chalk.cyan('📋 Exporting Chat List\n'));
  
  const { client } = await initClient();
  const dialogs = await client.getDialogs({ limit: 200 });
  
  const chatList = dialogs.map(d => ({
    id: d.id.toString(),
    title: d.title,
    type: d.isChannel ? 'Channel' : d.isGroup ? 'Group' : 'Chat',
    username: d.entity.username || 'N/A'
  }));

  const outputFile = options.output || 'chat_list.json';
  await fs.writeJson(outputFile, chatList, { spaces: 2 });
  
  console.log(chalk.green(`✓ Exported ${chatList.length} chats to ${outputFile}`));
  await client.disconnect();
}

function getMediaExtension(media) {
  if (media.className === 'MessageMediaPhoto') {
    return '.jpg';
  } else if (media.className === 'MessageMediaDocument' && media.document) {
    const mimeType = media.document.mimeType || '';
    const map = {
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
      'application/pdf': '.pdf',
      'application/zip': '.zip'
    };
    return map[mimeType] || '';
  }
  return '';
}

function showHelp() {
  console.log(chalk.blue.bold('\n📚 Telegram Channel Downloader CLI\n'));
  console.log(chalk.cyan('Available Commands:\n'));
  
  console.log(chalk.white('  listen-channel'));
  console.log(chalk.gray('    Monitor a channel and download new media as it arrives'));
  console.log(chalk.yellow('    Options: --channelId=<id> --interval=<ms>\n'));
  
  console.log(chalk.white('  download-selected'));
  console.log(chalk.gray('    Download specific messages by ID'));
  console.log(chalk.yellow('    Options: --channelId=<id> --messageIds=<id1,id2,id3>\n'));
  
  console.log(chalk.white('  download-bulk'));
  console.log(chalk.gray('    Download from multiple channels at once'));
  console.log(chalk.yellow('    Options: --channelIds=<id1,id2,id3> (optional, will prompt if not provided)\n'));
  
  console.log(chalk.white('  export-chat-list'));
  console.log(chalk.gray('    Export list of all your chats/channels'));
  console.log(chalk.yellow('    Options: --output=<filename>\n'));
  
  console.log(chalk.cyan('Examples:\n'));
  console.log(chalk.gray('  node cli.js listen-channel --channelId=123456789'));
  console.log(chalk.gray('  node cli.js download-selected --channelId=123 --messageIds=100,101,102'));
  console.log(chalk.gray('  node cli.js download-bulk'));
  console.log(chalk.gray('  node cli.js export-chat-list --output=my_chats.json\n'));
}

// Main execution
if (!command || !commands[command]) {
  showHelp();
  process.exit(0);
}

commands[command]().catch(error => {
  console.error(chalk.red('\n❌ Error:', error.message));
  process.exit(1);
});