import fs from "fs";
import path from "path";
import ejs from "ejs";
import cliProgress from "cli-progress";
import type { TelegramClient, Api } from "telegram";
import { initAuth } from "../modules/auth.js";
import {
  getMessages,
  getMessageDetail,
  downloadMessageMedia,
  downloadCommentMedia,
  downloadProfilePhoto,
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
  createConcurrencyLimiter,
  formatBytes,
  formatDuration,
  formatMessageMarkdown,
  formatMessagePlainText,
  buildExportFolderName,
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
  DownloadStats,
  ExportFormat,
  DryRunReport,
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
  private dryRun: boolean = false;
  private exportFormat: ExportFormat = "json";
  private includeProfilePhoto: boolean = false;
  private stats: DownloadStats = { total: 0, downloaded: 0, skipped: 0, failed: 0, totalBytes: 0 };
  private progressBar: cliProgress.SingleBar | null = null;
  private downloadStartTime: number = 0;
  private dryRunMediaTypes: Record<string, number> = {};
  private dryRunOldest: number | undefined;
  private dryRunNewest: number | undefined;

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
      "  --concurrency=<n>      Max parallel downloads (default: 5).",
      "  --dryRun               Preview what would be downloaded without downloading.",
      "  --format=<json|html|txt|md>  Export format for message data (default: json).",
      "  --includeProfilePhoto  Download the channel/group profile photo.",
      "  --help                 Show this help message.",
      "",
      "Examples:",
      "  download-channel --channelId=12345",
      "  download-channel --channelId=12345 --startDate=2024-06-01 --endDate=2024-06-18",
      "  download-channel --channelIds=123,456,789 --order=chronological",
      "  download-channel --channelId=12345 --dryRun",
      "  download-channel --channelId=12345 --format=md --includeProfilePhoto",
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

    // Export text/markdown views
    if (this.exportFormat === "txt") {
      this.exportMessagesToText();
    } else if (this.exportFormat === "md") {
      this.exportMessagesToMarkdown();
    }

    // Export metadata.json in chronological mode
    if (this.order === "chronological") {
      this.exportMetadataJson();
    }
  }

  /**
   * Exports all recorded messages to a plain text file.
   */
  private exportMessagesToText(): void {
    if (!this.outputFolder) return;

    try {
      const jsonPath = path.join(this.outputFolder, "all_message.json");
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, "utf8");
      const allMessages = JSON.parse(raw) as RecordedMessage[];
      allMessages.sort((a, b) => a.date - b.date);

      const lines: string[] = [];
      lines.push(`# ${this.channelName || "Channel"} - Message Export`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push(`# Total messages: ${allMessages.length}`);
      lines.push("=".repeat(60));
      lines.push("");

      for (const msg of allMessages) {
        lines.push(
          formatMessagePlainText(msg as unknown as Parameters<typeof formatMessagePlainText>[0])
        );
        lines.push("-".repeat(60));
      }

      const txtPath = path.join(this.outputFolder, "messages.txt");
      fs.writeFileSync(txtPath, lines.join("\n"), "utf8");
      logger.info(`Text export written: ${txtPath} (${allMessages.length} messages)`);
    } catch (err) {
      logger.error("Failed to export messages to text");
      console.error(err);
    }
  }

  /**
   * Exports all recorded messages to a Markdown file.
   */
  private exportMessagesToMarkdown(): void {
    if (!this.outputFolder) return;

    try {
      const jsonPath = path.join(this.outputFolder, "all_message.json");
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, "utf8");
      const allMessages = JSON.parse(raw) as RecordedMessage[];
      allMessages.sort((a, b) => a.date - b.date);

      const lines: string[] = [];
      lines.push(`# ${this.channelName || "Channel"}`);
      lines.push("");
      lines.push(`_Exported: ${new Date().toISOString()} — ${allMessages.length} messages_`);
      lines.push("");
      lines.push("---");
      lines.push("");

      for (const msg of allMessages) {
        const dateStr = new Date(msg.date * 1000).toISOString().slice(0, 16).replace("T", " ");
        const sender = msg.sender ? `**${msg.sender}**` : "Unknown";
        lines.push(`### ${sender} — ${dateStr} (ID: ${msg.id})`);
        lines.push("");

        if (msg.message) {
          const mdText = formatMessageMarkdown(
            msg.message,
            (msg as unknown as { entities?: Parameters<typeof formatMessageMarkdown>[1] }).entities
          );
          lines.push(mdText);
          lines.push("");
        }

        if (msg.hasMedia && msg.mediaName) {
          lines.push(`📎 _Attachment: ${msg.mediaName}_`);
          lines.push("");
        }

        lines.push("---");
        lines.push("");
      }

      const mdPath = path.join(this.outputFolder, "messages.md");
      fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
      logger.info(`Markdown export written: ${mdPath} (${allMessages.length} messages)`);
    } catch (err) {
      logger.error("Failed to export messages to Markdown");
      console.error(err);
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
    offsetMsgId = 0,
    folderName?: string
  ): Promise<void> {
    try {
      this.outputFolder = path.join(
        process.cwd(),
        "export",
        folderName ?? buildExportFolderName(this.channelName, channelId)
      );
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

      // ── Collect downloadable messages and track skipped ──
      const downloadable: Api.Message[] = [];
      for (const msg of details) {
        if (this.hasMedia(msg) && this.outputFolder && this.downloadableFiles) {
          const mediaType = getMediaType(msg);
          const mediaPath = this.getMediaPathForMessage(msg);
          const fileExists = this.fileExistsForMessage(msg);
          const extension = path.extname(mediaPath).toLowerCase().replace(".", "");
          const allowed =
            this.downloadableFiles[mediaType] ||
            this.downloadableFiles[extension] ||
            this.downloadableFiles.all;

          if (allowed) {
            if (fileExists) {
              this.stats.skipped++;
            } else {
              downloadable.push(msg);
            }
          }
        }
      }

      this.stats.total += downloadable.length;

      // ── Dry run: count media types and track date range, then skip downloads ──
      if (this.dryRun) {
        for (const msg of details) {
          const mediaType = getMediaType(msg);
          if (mediaType) {
            this.dryRunMediaTypes[mediaType] = (this.dryRunMediaTypes[mediaType] || 0) + 1;
          }
          if (this.dryRunOldest === undefined || msg.date < this.dryRunOldest) {
            this.dryRunOldest = msg.date;
          }
          if (this.dryRunNewest === undefined || msg.date > this.dryRunNewest) {
            this.dryRunNewest = msg.date;
          }
        }

        const downloadableCount = downloadable.length;
        logger.info(
          `[Dry Run] Batch: ${details.length} messages, ${downloadableCount} downloadable media files`
        );

        this.recordMessages(details);
        updateLastSelection({
          messageOffsetId: messages[messages.length - 1].id,
        });

        // Stop if we've reached the start date boundary
        if (this.dateRange.startDate && oldestMessage.date <= this.dateRange.startDate) {
          logger.info("Reached start date boundary, stopping dry run.");
          return;
        }

        await wait(1);
        await this.downloadChannel(client, channelId, messages[messages.length - 1].id, folderName);
        return;
      }

      // ── Initialize progress bar ──
      if (!this.progressBar && downloadable.length > 0) {
        this.progressBar = new cliProgress.SingleBar(
          {
            format: `[{bar}] {percentage}% | {value}/{total} files | {speed} | ETA: {eta}s | {elapsed}`,
            barCompleteChar: "█",
            barIncompleteChar: "░",
            hideCursor: true,
            clearOnComplete: false,
          },
          cliProgress.Presets.shades_classic
        );
        this.progressBar.start(this.stats.total, this.stats.downloaded + this.stats.skipped, {
          speed: "0",
          elapsed: "0s",
        });
        this.downloadStartTime = Date.now();
      }

      // ── Sliding-window concurrent downloads ──
      const limit = createConcurrencyLimiter(MAX_PARALLEL_DOWNLOAD);
      const downloadTasks = downloadable.map((msg) =>
        limit(async () => {
          const mediaPath = this.getMediaPathForMessage(msg);
          const result = await downloadMessageMedia(client, msg, mediaPath);

          if (result.success && result.fileSize) {
            this.stats.downloaded++;
            this.stats.totalBytes += result.fileSize;
          } else if (!result.success) {
            this.stats.failed++;
          }

          // Update progress bar
          if (this.progressBar) {
            const completed = this.stats.downloaded + this.stats.skipped + this.stats.failed;
            const elapsedSec = (Date.now() - this.downloadStartTime) / 1000;
            const speed = elapsedSec > 0 ? (this.stats.downloaded / elapsedSec).toFixed(1) : "0";
            this.progressBar.update(completed, {
              speed,
              elapsed: formatDuration(elapsedSec * 1000),
            });
          }

          return result;
        })
      );

      await Promise.all(downloadTasks);

      // Extend progress bar total for next batch
      if (this.progressBar) {
        this.progressBar.setTotal(this.stats.total);
      }

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
      await this.downloadChannel(client, channelId, messages[messages.length - 1].id, folderName);
    } catch (err) {
      logger.error("An error occurred during download:");
      console.error(err);
    }
  }

  /**
   * Prints the dry run report summary.
   */
  private printDryRunReport(): void {
    const totalMedia = Object.values(this.dryRunMediaTypes).reduce((a, b) => a + b, 0);

    const report: DryRunReport = {
      totalMessages: this.stats.total,
      totalMediaFiles: totalMedia,
      mediaTypes: this.dryRunMediaTypes,
      oldestMessageDate: this.dryRunOldest,
      newestMessageDate: this.dryRunNewest,
    };

    console.log("\n=== Dry Run Report ===");
    console.log(`  Total messages scanned:  ${report.totalMessages}`);
    console.log(`  Total media files found: ${report.totalMediaFiles}`);
    console.log("  Media breakdown:");
    for (const [type, count] of Object.entries(report.mediaTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }
    if (report.oldestMessageDate && report.newestMessageDate) {
      console.log(
        `  Date range: ${new Date(report.oldestMessageDate * 1000).toISOString().slice(0, 10)} to ${new Date(report.newestMessageDate * 1000).toISOString().slice(0, 10)}`
      );
    }
    console.log("  No files were downloaded (dry run mode).\n");
  }

  /**
   * Stops the progress bar and prints a download statistics summary.
   */
  private printStats(): void {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }

    const elapsed = this.downloadStartTime > 0 ? Date.now() - this.downloadStartTime : 0;
    logger.info("=== Download Summary ===");
    logger.success(`Downloaded: ${this.stats.downloaded} files`);
    logger.info(`Skipped (existing): ${this.stats.skipped} files`);
    if (this.stats.failed > 0) {
      logger.error(`Failed: ${this.stats.failed} files`);
    }
    logger.info(`Total size: ${formatBytes(this.stats.totalBytes)}`);
    logger.info(`Elapsed time: ${formatDuration(elapsed)}`);
    if (this.stats.downloaded > 0 && elapsed > 0) {
      const speed = this.stats.totalBytes / (elapsed / 1000);
      logger.info(`Average speed: ${formatBytes(speed)}/s`);
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

    // ── Dry run mode ──
    this.dryRun = Boolean(options.dryRun);
    if (this.dryRun) {
      logger.info("Dry run mode: no files will be downloaded");
    }

    // ── Export format ──
    if (options.format && ["json", "html", "txt", "md"].includes(String(options.format))) {
      this.exportFormat = options.format;
      if (this.exportFormat !== "json") {
        logger.info(`Export format: ${this.exportFormat}`);
      }
    }

    // ── Include profile photo ──
    this.includeProfilePhoto = Boolean(options.includeProfilePhoto);
    if (this.includeProfilePhoto) {
      logger.info("Channel profile photo will be downloaded");
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
          const folderName = buildExportFolderName(this.channelName, channelId);
          logger.info(`Downloading media from channel ${this.channelName}`);

          if (this.includeProfilePhoto) {
            const photoFolder = path.join(process.cwd(), "export", folderName);
            await downloadProfilePhoto(client, channelId, photoFolder);
          }

          await this.downloadChannel(client, channelId, messageOffsetId, folderName);
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
        const folderName = buildExportFolderName(this.channelName, channelId);
        logger.info(`Downloading media from channel ${this.channelName}`);

        if (this.includeProfilePhoto) {
          const photoFolder = path.join(process.cwd(), "export", folderName);
          await downloadProfilePhoto(client, channelId, photoFolder);
        }

        await this.downloadChannel(client, channelId, messageOffsetId, folderName);
      }

      this.printStats();

      if (this.dryRun) {
        this.printDryRunReport();
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
