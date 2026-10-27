import path from "path";
import { NewMessage, type NewMessageEvent } from "telegram/events";
import type { TelegramClient } from "telegram";
import { getAllDialogs, getDialogName } from "../modules/dialogs.js";
import { downloadMessageMedia, getMessageDetail } from "../modules/messages.js";
import { getMediaPath, wait } from "../utils/helper.js";
import logger from "../utils/logger.js";
import { initAuth } from "../modules/auth.js";
import { selectInput } from "../utils/input-helper.js";
import type { CliOptions } from "../types/index.js";

/**
 * Listens to a channel and downloads media from incoming messages.
 */
class ListenChannel {
  private channelId: number | string | null = null;
  private client: TelegramClient | null = null;

  constructor() {
    this.handleNewMessage = this.handleNewMessage.bind(this);
  }

  static description(): string {
    return "Listen to a channel and download media from incoming messages";
  }

  static help(): string {
    return [
      "Usage: listen-channel [--channelId=<id>]",
      "",
      "Options:",
      "  --channelId  The Telegram channel ID to listen to.",
      "               If omitted, you will be prompted to select one.",
      "  --help       Show this help message.",
    ].join("\n");
  }

  private async handleNewMessage(event: NewMessageEvent): Promise<void> {
    if (!this.channelId) return;

    const peerId = event.message?.peerId as unknown as {
      chatId?: number;
      channelId?: number;
      userId?: number;
    } | undefined;

    const messageChatId = peerId?.chatId || peerId?.channelId || peerId?.userId;
    if (Number(messageChatId) !== Number(this.channelId)) {
      logger.info("Message from another channel, skipping");
      return;
    }

    const messageId = event.message?.id;
    const isMedia = !!event.message?.media;

    if (isMedia && messageId && this.client) {
      const outputFolder = path.join(
        process.cwd(),
        "export",
        this.channelId.toString()
      );

      const details = await getMessageDetail(this.client, this.channelId, [messageId]);
      for (const msg of details) {
        await downloadMessageMedia(this.client, msg, getMediaPath(msg, outputFolder));
        logger.info(`Downloaded media from message: ${msg.id}`);
      }
    } else {
      logger.info("No media found in the message");
    }
  }

  async handle(options: CliOptions = {}): Promise<void> {
    let channelId = options.channelId ? Number(options.channelId) : NaN;
    let client: TelegramClient | null = null;
    await wait(1);

    try {
      client = await initAuth();

      if (isNaN(channelId)) {
        logger.info("Please select a channel to download media from");
        const allChannels = await getAllDialogs(client);
        const channelOptions = allChannels.map((d) => ({
          name: d.name,
          value: d.id,
        }));

        channelId = (await selectInput("Please select a channel", channelOptions)) as number;
      }

      this.channelId = channelId;
      this.client = client;

      const dialogName = await getDialogName(client, channelId);
      logger.info(`Listening to: ${dialogName ?? channelId}`);
      client.addEventHandler(this.handleNewMessage, new NewMessage({}));
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
      if (client) await client.disconnect();
    }
  }
}

export default ListenChannel;
