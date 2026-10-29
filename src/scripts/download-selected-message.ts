import path from "path";
import type { TelegramClient } from "telegram";
import { initAuth } from "../modules/auth.js";
import { getMessageDetail, downloadMessageMedia } from "../modules/messages.js";
import { getMediaPath } from "../utils/helper.js";
import { textInput } from "../utils/input-helper.js";
import logger from "../utils/logger.js";
import type { CliOptions } from "../types/index.js";

/**
 * Downloads media from specific messages.
 */
class DownloadSelectedMessage {
  static description(): string {
    return "Download media from selected messages";
  }

  static help(): string {
    return [
      "Usage: download-selected-message [--channelId=<id>] [--messageIds=<ids>]",
      "",
      "Options:",
      "  --channelId   The Telegram channel ID.",
      "  --messageIds  Comma-separated message IDs to download.",
      "  --help        Show this help message.",
    ].join("\n");
  }

  private async downloadMessage(
    client: TelegramClient,
    channelId: string | number,
    messageIds: number[]
  ): Promise<void> {
    const outputFolder = path.join(process.cwd(), "export", channelId.toString());

    const messageArr = await getMessageDetail(client, channelId, messageIds);
    let downloaded = 0;
    let failed = 0;
    for (const message of messageArr) {
      const result = await downloadMessageMedia(
        client,
        message,
        getMediaPath(message, outputFolder)
      );
      if (result.success) downloaded++;
      else failed++;
    }
    logger.success(`Done: ${downloaded} downloaded, ${failed} failed`);
  }

  async handle(options: CliOptions = {}): Promise<void> {
    let client: TelegramClient | null = null;
    try {
      client = await initAuth();

      const channelIdInput = options.channelId ?? (await textInput("Please enter Channel ID: "));
      const messageIdsText =
        options.messageIds ??
        (await textInput("Please enter Message ID(s) (separated by comma): "));

      const channelId = channelIdInput;
      const messageIds = messageIdsText.split(",").map((id) => Number(id.trim()));

      await this.downloadMessage(client, channelId, messageIds);
    } catch (error) {
      logger.error("An error occurred:");
      console.error(error);
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  }
}

export default DownloadSelectedMessage;
