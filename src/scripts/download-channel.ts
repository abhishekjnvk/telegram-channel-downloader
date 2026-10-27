import fs from "fs";
import path from "path";
import type { TelegramClient, Api } from "telegram";
import { initAuth } from "../modules/auth.js";
import {
  getMessages,
  getMessageDetail,
  downloadMessageMedia,
} from "../modules/messages.js";
import {
  getMediaType,
  getMediaPath,
  checkFileExist,
  appendToJSONArrayFile,
  wait,
  buildRecordedMessage,
} from "../utils/helper.js";
import {
  updateLastSelection,
  getLastSelection,
} from "../utils/file-helper.js";
import logger from "../utils/logger.js";
import { getDialogName, getAllDialogs } from "../modules/dialogs.js";
import {
  downloadOptionInput,
  selectInput,
} from "../utils/input-helper.js";
import type {
  DownloadableFiles,
  DownloadChannelOptions,
  CliOptions,
  RecordedMessage,
} from "../types/index.js";

const MAX_PARALLEL_DOWNLOAD = 5;
const MESSAGE_LIMIT = 10;

/**
 * Handles downloading media from a Telegram channel.
 */
class DownloadChannel {
  private outputFolder: string | null = null;
  private downloadableFiles: DownloadableFiles | null = null;

  constructor() {
    const exportPath = path.resolve(process.cwd(), "./export");
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
  }

  static description(): string {
    return "Download all media from a channel";
  }

  static help(): string {
    return [
      "Usage: download-channel [--channelId=<id>]",
      "",
      "Options:",
      "  --channelId  The Telegram channel ID to download from.",
      "               If omitted, you will be prompted to select one.",
      "  --help       Show this help message.",
    ].join("\n");
  }

  /**
   * Checks if a message contains media.
   */
  private hasMedia(message: Api.Message): boolean {
    return Boolean(message.media);
  }

  /**
   * Determines if a message's media should be downloaded.
   */
  private canDownload(message: Api.Message): boolean {
    if (!this.hasMedia(message) || !this.outputFolder || !this.downloadableFiles) {
      return false;
    }
    const mediaType = getMediaType(message);
    const mediaPath = getMediaPath(message, this.outputFolder, true);
    const fileExists = checkFileExist(message, this.outputFolder);
    const extension = path.extname(mediaPath).toLowerCase().replace(".", "");
    const allowed =
      this.downloadableFiles[mediaType] ||
      this.downloadableFiles[extension] ||
      this.downloadableFiles.all;

    return Boolean(allowed && !fileExists);
  }

  /**
   * Records messages to a JSON file.
   */
  private recordMessages(messages: Api.Message[]): void {
    if (!this.outputFolder) return;

    const filePath = path.join(this.outputFolder, "all_message.json");
    if (!fs.existsSync(this.outputFolder)) {
      fs.mkdirSync(this.outputFolder, { recursive: true });
    }

    const data: RecordedMessage[] = messages.map((msg) =>
      buildRecordedMessage(
        msg as unknown as Parameters<typeof buildRecordedMessage>[0],
        this.outputFolder as string,
        (m) => this.hasMedia(m),
        getMediaType,
        getMediaPath
      )
    );
    appendToJSONArrayFile(filePath, data);
  }

  /**
   * Recursively fetches and downloads all available media from the channel.
   */
  private async downloadChannel(
    client: TelegramClient,
    channelId: string | number,
    offsetMsgId = 0
  ): Promise<void> {
    try {
      this.outputFolder = path.join(process.cwd(), "export", channelId.toString());
      if (!fs.existsSync(this.outputFolder)) {
        fs.mkdirSync(this.outputFolder, { recursive: true });
      }

      const messages = await getMessages(client, channelId, MESSAGE_LIMIT, offsetMsgId);
      if (!messages.length) {
        logger.info("No more messages to download");
        return;
      }

      const ids = messages.map((m) => m.id);
      const details = await getMessageDetail(client, channelId, ids);
      const downloadQueue: Promise<boolean>[] = [];

      for (const msg of details) {
        if (this.canDownload(msg)) {
          logger.info(`Downloading ${msg.id}`);
          downloadQueue.push(
            downloadMessageMedia(client, msg, getMediaPath(msg, this.outputFolder as string))
          );
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
      await this.downloadChannel(client, channelId, messages[messages.length - 1].id);
    } catch (err) {
      logger.error("An error occurred during download:");
      console.error(err);
    }
  }

  private async configureDownload(
    options: DownloadChannelOptions,
    client: TelegramClient
  ): Promise<{ channelId: string | number; messageOffsetId: number }> {
    let channelId: string | number | undefined = options.channelId;
    let downloadableFiles = options.downloadableFiles;

    if (!channelId) {
      logger.info("Please select a channel to download media from");
      const allChannels = await getAllDialogs(client);
      const channelOptions = allChannels.map((d) => ({
        name: d.name,
        value: d.id,
      }));

      channelId = (await selectInput("Please select a channel", channelOptions)) as
        | string
        | number;
    }

    if (!downloadableFiles) downloadableFiles = await downloadOptionInput();

    this.downloadableFiles = downloadableFiles;

    const lastSelection = getLastSelection();
    let messageOffsetId = lastSelection.messageOffsetId || 0;

    if (String(lastSelection.channelId) !== String(channelId)) {
      messageOffsetId = 0;
    }
    updateLastSelection({ messageOffsetId, channelId: String(channelId) });
    return { channelId, messageOffsetId };
  }

  /**
   * Main entry point: initializes auth, sets up output folder, and starts download.
   */
  async handle(options: CliOptions = {}): Promise<void> {
    let client: TelegramClient | null = null;
    await wait(1);
    try {
      client = await initAuth();
      const { channelId, messageOffsetId } = await this.configureDownload(
        options as DownloadChannelOptions,
        client
      );

      const dialogName = await getDialogName(client, channelId);
      logger.info(`Downloading media from channel ${dialogName ?? channelId}`);
      await this.downloadChannel(client, channelId, messageOffsetId);
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    } finally {
      if (client) await client.disconnect();
    }
  }
}

export default DownloadChannel;
