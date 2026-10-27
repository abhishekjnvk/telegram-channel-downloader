import fs from "fs";
import path from "path";
import ejs from "ejs";
import type { TelegramClient, Api } from "telegram";
import { initAuth } from "../modules/auth.js";
import {
  getMessages,
  getMessageDetail,
  downloadMessageMedia,
  downloadCommentMedia,
} from "../modules/messages.js";
import {
  getMediaType,
  getMediaPath,
  getMediaPathChronological,
  checkFileExist,
  checkFileExistChronological,
  appendToJSONArrayFile,
  wait,
  buildRecordedMessage,
} from "../utils/helper.js";
import { updateLastSelection, getLastSelection } from "../utils/file-helper.js";
import logger from "../utils/logger.js";
import { getDialogName, getAllDialogs, selectChannel } from "../modules/dialogs.js";
import {
  downloadOptionInput,
  dateRangeInput,
  parseDateOption,
  orderInput,
} from "../utils/input-helper.js";
import type {
  DownloadableFiles,
  DownloadChannelOptions,
  CliOptions,
  RecordedMessage,
  DateRange,
  DownloadOrder,
  FileMetadata,
} from "../types/index.js";

const MAX_PARALLEL_DOWNLOAD = 5;
const MESSAGE_LIMIT = 10;

/**
 * Handles downloading media from a Telegram channel.
 */
class DownloadChannel {
  private outputFolder: string | null = null;
  private downloadableFiles: DownloadableFiles | null = null;
  private dateRange: DateRange = {};
  private channelName: string = "";
  private order: DownloadOrder = "byType";
  private includeComments: boolean = false;

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
      "Usage: download-channel [options]",
      "",
      "Options:",
      "  --channelId=<id>       Channel ID to download from.",
      "                         Accepts comma-separated IDs for bulk download:",
      "                         --channelId=123,456,789",
      "  --channelIds=<ids>     Same as --channelId but explicitly for bulk.",
      "  --startDate=YYYY-MM-DD Only download messages on or after this date.",
      "  --endDate=YYYY-MM-DD   Only download messages on or before this date.",
      "  --order=<mode>         File organization: 'byType' (default) or 'chronological'.",
      "  --includeComments      Also download media from discussion/comments.",
      "  --help                 Show this help message.",
      "",
      "Examples:",
      "  download-channel --channelId=12345",
      "  download-channel --channelId=12345 --startDate=2024-06-01 --endDate=2024-06-18",
      "  download-channel --channelIds=123,456,789 --order=chronological",
    ].join("\n");
  }

  /**
   * Checks if a message contains media.
   */
  private hasMedia(message: Api.Message): boolean {
    return Boolean(message.media);
  }

  /**
   * Gets the media path based on the configured order mode.
   */
  private getMediaPathForMessage(message: Api.Message): string {
    if (!this.outputFolder) return "unknown";
    if (this.order === "chronological") {
      return getMediaPathChronological(message, this.outputFolder, true);
    }
    return getMediaPath(message, this.outputFolder, true);
  }

  /**
   * Checks if a file already exists based on the configured order mode.
   */
  private fileExistsForMessage(message: Api.Message): boolean {
    if (!this.outputFolder) return false;
    if (this.order === "chronological") {
      return checkFileExistChronological(message, this.outputFolder);
    }
    return checkFileExist(message, this.outputFolder);
  }

  /**
   * Determines if a message's media should be downloaded.
   */
  private canDownload(message: Api.Message): boolean {
    if (!this.hasMedia(message) || !this.outputFolder || !this.downloadableFiles) {
      return false;
    }
    const mediaType = getMediaType(message);
    const mediaPath = this.getMediaPathForMessage(message);
    const fileExists = this.fileExistsForMessage(message);
    const extension = path.extname(mediaPath).toLowerCase().replace(".", "");
    const allowed =
      this.downloadableFiles[mediaType] ||
      this.downloadableFiles[extension] ||
      this.downloadableFiles.all;

    return Boolean(allowed && !fileExists);
  }

  /**
   * Records messages to a JSON file and exports an HTML view.
   */
  private recordMessages(messages: Api.Message[]): void {
    if (!this.outputFolder) return;
    const outputFolder = this.outputFolder;

    const filePath = path.join(outputFolder, "all_message.json");
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const data: RecordedMessage[] = messages.map((msg) =>
      buildRecordedMessage(
        msg as unknown as Parameters<typeof buildRecordedMessage>[0],
        outputFolder,
        (m) => this.hasMedia(m),
        getMediaType,
        this.order === "chronological" ? getMediaPathChronological : getMediaPath
      )
    );
    appendToJSONArrayFile(filePath, data);

    // Export HTML view
    this.exportMessagesToHtml();

    // Export metadata.json in chronological mode
    if (this.order === "chronological") {
      this.exportMetadataJson();
    }
  }

  /**
   * Exports metadata.json mapping message IDs to file info, text, and dates.
   */
  private exportMetadataJson(): void {
    if (!this.outputFolder) return;

    try {
      const jsonPath = path.join(this.outputFolder, "all_message.json");
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, "utf8");
      const allMessages = JSON.parse(raw) as RecordedMessage[];

      // Only include messages that have media
      const metadata: FileMetadata[] = allMessages
        .filter((m) => m.hasMedia && m.mediaName)
        .map((m) => ({
          messageId: m.id,
          date: m.date,
          dateISO: new Date(m.date * 1000).toISOString(),
          text: m.message,
          sender: m.sender,
          mediaType: m.mediaType,
          fileName: m.mediaName as string,
          filePath: m.mediaPath || "",
        }));

      // Sort by message ID (chronological order)
      metadata.sort((a, b) => a.messageId - b.messageId);

      const metadataPath = path.join(this.outputFolder, "metadata.json");
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      logger.error("Failed to export metadata.json");
      console.error(err);
    }
  }

  /**
   * Renders all recorded messages to a readable HTML file.
   */
  private exportMessagesToHtml(): void {
    if (!this.outputFolder) return;

    try {
      const jsonPath = path.join(this.outputFolder, "all_message.json");
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, "utf8");
      const allMessages = JSON.parse(raw) as RecordedMessage[];

      // Sort by date ascending (oldest first) for chronological reading
      allMessages.sort((a, b) => a.date - b.date);

      const templatePath = path.resolve(__dirname, "../../templates/messages.ejs");
      const html = ejs.render(fs.readFileSync(templatePath, "utf8"), {
        channelName: this.channelName,
        messages: allMessages,
      });

      const htmlPath = path.join(this.outputFolder, "messages.html");
      fs.writeFileSync(htmlPath, html);
      logger.info(`HTML export written: ${htmlPath} (${allMessages.length} messages)`);
    } catch (err) {
      logger.error("Failed to export messages to HTML");
      console.error(err);
    }
  }

  /**
   * Checks if a message falls within the configured date range.
   */
  private isWithinDateRange(message: Api.Message): boolean {
    const { startDate, endDate } = this.dateRange;
    const msgTimestamp = message.date; // Unix timestamp in seconds

    if (startDate && msgTimestamp < startDate) return false;
    if (endDate && msgTimestamp > endDate) return false;

    return true;
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

      // Check if we've gone past the start date — stop recursion
      const oldestMessage = messages[messages.length - 1];
      if (this.dateRange.startDate && oldestMessage.date < this.dateRange.startDate) {
        logger.info("Reached messages older than start date, stopping.");
        // Still process messages within range from this batch
      }

      // Filter messages by date range
      const filteredMessages = messages.filter((m) => this.isWithinDateRange(m));

      if (filteredMessages.length === 0 && messages.length > 0) {
        // All messages in this batch are outside the date range
        // If we have a startDate and the oldest message is before it, we're done
        if (this.dateRange.startDate && oldestMessage.date < this.dateRange.startDate) {
          logger.info("No messages within the specified date range.");
          return;
        }
        // Otherwise continue to next batch
      }

      const ids = filteredMessages.map((m) => m.id);
      if (ids.length === 0) {
        // Skip this batch but continue recursion if we haven't hit the start date
        if (this.dateRange.startDate && oldestMessage.date < this.dateRange.startDate) {
          return;
        }
        await wait(1);
        await this.downloadChannel(client, channelId, oldestMessage.id);
        return;
      }

      const details = await getMessageDetail(client, channelId, ids);
      const downloadQueue: Promise<boolean>[] = [];

      for (const msg of details) {
        if (this.canDownload(msg)) {
          logger.info(`Downloading ${msg.id}`);
          downloadQueue.push(downloadMessageMedia(client, msg, this.getMediaPathForMessage(msg)));
        }

        if (downloadQueue.length >= MAX_PARALLEL_DOWNLOAD) {
          logger.info(`Processing ${MAX_PARALLEL_DOWNLOAD} downloads`);
          await Promise.all(downloadQueue);
          downloadQueue.length = 0;
          await wait(3);
        }
      }

      await Promise.all(downloadQueue);

      // Download media from comments/discussion if enabled
      if (this.includeComments) {
        for (const msg of details) {
          if (this.hasMedia(msg) || (msg as unknown as { replies?: unknown }).replies) {
            await downloadCommentMedia(client, msg, this.outputFolder);
          }
        }
      }

      this.recordMessages(details);
      updateLastSelection({
        messageOffsetId: messages[messages.length - 1].id,
      });

      // Stop if we've reached the start date boundary
      if (this.dateRange.startDate && oldestMessage.date <= this.dateRange.startDate) {
        logger.info("Reached start date boundary, stopping download.");
        return;
      }

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

    // ── Channel selection (with search support) ──
    if (!channelId) {
      logger.info("Please select a channel to download media from");
      const allChannels = await getAllDialogs(client);
      channelId = await selectChannel(allChannels);
    }

    // ── Date range ──
    if (options.startDate || options.endDate) {
      this.dateRange = {
        startDate: parseDateOption(options.startDate, false),
        endDate: parseDateOption(options.endDate, true),
      };
    } else {
      this.dateRange = await dateRangeInput();
    }

    if (this.dateRange.startDate || this.dateRange.endDate) {
      const startStr = this.dateRange.startDate
        ? new Date(this.dateRange.startDate * 1000).toISOString().slice(0, 10)
        : "beginning";
      const endStr = this.dateRange.endDate
        ? new Date(this.dateRange.endDate * 1000).toISOString().slice(0, 10)
        : "now";
      logger.info(`Date range: ${startStr} to ${endStr}`);
    }

    // ── Download order ──
    if (options.order === "chronological" || options.order === "byType") {
      this.order = options.order;
    } else if (options.order === "true") {
      // --order without value, prompt interactively
      this.order = await orderInput();
    } else {
      this.order = await orderInput();
    }
    logger.info(`Download order: ${this.order}`);

    // ── Include comments ──
    this.includeComments = Boolean(options.includeComments);
    if (this.includeComments) {
      logger.info("Comment/discussion media will also be downloaded");
    }

    // ── File type selection ──
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

      // ── Bulk download support ──
      const channelIdsInput = options.channelIds || options.channelId;
      const channelIds = channelIdsInput
        ? String(channelIdsInput)
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : [];

      if (channelIds.length > 1) {
        // Bulk download mode
        logger.info(`Bulk download: ${channelIds.length} channels`);
        for (let i = 0; i < channelIds.length; i++) {
          const cid = channelIds[i];
          logger.info(`\n=== Channel ${i + 1}/${channelIds.length}: ${cid} ===`);

          const { channelId, messageOffsetId } = await this.configureDownload(
            { ...options, channelId: cid } as DownloadChannelOptions,
            client
          );

          const dialogName = await getDialogName(client, channelId);
          this.channelName = dialogName ?? String(channelId);
          logger.info(`Downloading media from channel ${this.channelName}`);
          await this.downloadChannel(client, channelId, messageOffsetId);
        }
        logger.success(`Bulk download complete: ${channelIds.length} channels processed`);
      } else {
        // Single channel download
        const { channelId, messageOffsetId } = await this.configureDownload(
          options as DownloadChannelOptions,
          client
        );

        const dialogName = await getDialogName(client, channelId);
        this.channelName = dialogName ?? String(channelId);
        logger.info(`Downloading media from channel ${this.channelName}`);
        await this.downloadChannel(client, channelId, messageOffsetId);
      }
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    } finally {
      if (client) await client.disconnect();
    }
  }
}

export default DownloadChannel;
