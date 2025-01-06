"use strict";
const fs = require("fs");
const path = require("path");
const { initAuth } = require("../modules/auth");
const {
  getMessages,
  getMessageDetail,
  downloadMessageMedia,
} = require("../modules/messages");
const {
  getMediaType,
  getMediaPath,
  checkFileExist,
  appendToJSONArrayFile,
  wait,
} = require("../utils/helper");
const {
  updateLastSelection,
  getLastSelection,
} = require("../utils/file-helper");
const logger = require("../utils/logger");
const { getDialogName, getAllDialogs } = require("../modules/dialoges");
const {
  downloadOptionInput,
  selectInput,
} = require("../utils/input-helper");

const MAX_PARALLEL_DOWNLOAD = 5;
const MESSAGE_LIMIT = 10;

/**
 * Handles downloading media from a Telegram channel
 */
class DownloadChannel {
  constructor() {
    this.outputFolder = null;
    this.downloadableFiles = null;

    const exportPath = path.resolve(process.cwd(), "./export");
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath);
    }
  }

  static description() {
    return "Download all media from a channel";
  }

  /**
   * Checks if a message contains media
   * @param {Object} message The Telegram message object
   */
  hasMedia(message) {
    return Boolean(message.media);
  }

  /**
   * Determines if a message's media should be downloaded
   * @param {Object} message The Telegram message object
   */
  canDownload(message) {
    if (!this.hasMedia(message)) return false;
    const mediaType = getMediaType(message);
    const mediaPath = getMediaPath(message, this.outputFolder);
    const fileExists = checkFileExist(message, this.outputFolder);
    const extension = path.extname(mediaPath).toLowerCase().replace(".", "");
    const allowed =
      this.downloadableFiles?.[mediaType] ||
      this.downloadableFiles?.[extension] ||
      this.downloadableFiles?.all;

    return allowed && !fileExists;
  }

  /**
   * Records messages to a JSON file
   * @param {Array} messages The message objects
   */
  recordMessages(messages) {
    const filePath = path.join(this.outputFolder, "all_message.json");
    if (!fs.existsSync(this.outputFolder)) {
      fs.mkdirSync(this.outputFolder, { recursive: true });
    }

    const data = messages.map((msg) => ({
      id: msg.id,
      message: msg.message,
      date: msg.date,
      out: msg.out,
      hasMedia: !!msg.media,
      sender: msg.fromId?.userId || msg.peerId?.userId,
      mediaType: this.hasMedia(msg) ? getMediaType(msg) : undefined,
      mediaPath: this.hasMedia(msg)
        ? getMediaPath(msg, this.outputFolder)
        : undefined,
      mediaName: this.hasMedia(msg)
        ? path.basename(getMediaPath(msg, this.outputFolder))
        : undefined,
    }));
    appendToJSONArrayFile(filePath, data);
  }

  /**
   * Recursively fetches and downloads all available media from the channel
   * @param {Object} client The Telegram client instance
   * @param {Number} channelId The channel ID
   * @param {Number} offsetMsgId The message offset
   */
  async downloadChannel(client, channelId, offsetMsgId = 0) {
    try {
      this.outputFolder = path.join(
        process.cwd(),
        "export",
        channelId.toString()
      );
      const messages = await getMessages(
        client,
        channelId,
        MESSAGE_LIMIT,
        offsetMsgId
      );
      if (!messages.length) {
        logger.info("No more messages to download");
        return;
      }
      const ids = messages.map((m) => m.id);
      const details = await getMessageDetail(client, channelId, ids);
      const downloadQueue = [];

      for (const msg of details) {
        if (this.canDownload(msg)) {
          logger.info(`Downloading ${msg.id}`);
          downloadQueue.push(
            downloadMessageMedia(
              client,
              msg,
              getMediaPath(msg, this.outputFolder)
            )
          );
        } else {
          // logger.info(`No media to download for ${msg.id}`);
        }
        if (downloadQueue.length >= MAX_PARALLEL_DOWNLOAD) {
          logger.info(`Processing ${MAX_PARALLEL_DOWNLOAD} downloads`);
          await Promise.all(downloadQueue);
          downloadQueue.length = 0;
          await wait(3);
        }
      }

      await Promise.all(downloadQueue);
      this.recordMessages(details);
      updateLastSelection({
        messageOffsetId: messages[messages.length - 1].id,
      });

      await wait(1);
      await this.downloadChannel(
        client,
        channelId,
        messages[messages.length - 1].id
      );
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    }
  }

  async configureDownload(options, client) {
    let channelId = options.channelId;
    let downloadableFiles = options.downloadableFiles;
    if (!channelId) {
      logger.info("Please select a channel to download media from");
      const allChannels = await getAllDialogs(client);
      const options = allChannels.map((d) => ({
        name: d.name,
        value: d.id,
      }));

      const selectedChannel = await selectInput(
        "Please select a channel",
        options
      );
      channelId = selectedChannel;
    }
    if (!downloadableFiles) downloadableFiles = await downloadOptionInput();

    this.downloadableFiles = downloadableFiles;

    const lastSelection = getLastSelection();
    let messageOffsetId = lastSelection.messageOffsetId || 0;

    if (Number(lastSelection.channelId) !== Number(channelId)) {
      messageOffsetId = 0;
    }
    updateLastSelection({ messageOffsetId, channelId });
    return { channelId, messageOffsetId };
  }

  /**
   * Main entry point: initializes auth, sets up output folder, and starts download
   */
  async handle(options = {}) {
    let client;
    await wait(1);
    try {
      client = await initAuth();
      const { channelId, messageOffsetId } = await this.configureDownload(
        options,
        client
      );

      const dialogName = await getDialogName(client, channelId);
      logger.info(`Downloading media from channel ${dialogName}`);
      await this.downloadChannel(client, channelId, messageOffsetId);
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    } finally {
      if (client) await client.disconnect();
      process.exit(0);
    }
  }
}

module.exports = DownloadChannel;
