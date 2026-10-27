import fs from "fs";
import path from "path";
import type { TelegramClient, Api } from "telegram";
import logger from "../utils/logger.js";
import { circularStringify } from "../utils/helper.js";

// ─── Get Messages ────────────────────────────────────────────────────────────

export async function getMessages(
  client: TelegramClient,
  channelId: string | number,
  limit = 10,
  offsetId = 0
): Promise<Api.Message[]> {
  if (!client || !channelId) {
    throw new Error("Client and channelId are required");
  }

  try {
    const result = await client.getMessages(channelId, { limit, offsetId });
    return result;
  } catch (error) {
    throw new Error(`Failed to get messages: ${(error as Error).message}`);
  }
}

// ─── Get Message Detail ──────────────────────────────────────────────────────

export async function getMessageDetail(
  client: TelegramClient,
  channelId: string | number,
  messageIds: number[]
): Promise<Api.Message[]> {
  if (!client || !channelId || !messageIds) {
    throw new Error("Client, channelId, and messageIds are required");
  }

  try {
    const result = await client.getMessages(channelId, { ids: messageIds });
    return result;
  } catch (error) {
    throw new Error(`Failed to get message details: ${(error as Error).message}`);
  }
}

// ─── Download Message Media ──────────────────────────────────────────────────

interface MediaWithWebpage {
  webpage?: {
    url?: string;
    id?: number;
  };
  poll?: unknown;
}

export async function downloadMessageMedia(
  client: TelegramClient,
  message: Api.Message,
  mediaPath: string
): Promise<boolean> {
  try {
    if (!client || !message || !mediaPath) {
      logger.error("Client, message, and mediaPath are required");
      return false;
    }

    if (message.media) {
      const media = message.media as unknown as MediaWithWebpage;

      if (media.webpage) {
        const url = media.webpage.url;
        if (url) {
          const urlPath = path.join(mediaPath, `../${message.id}_url.txt`);
          fs.writeFileSync(urlPath, url);
        }

        mediaPath = path.join(
          mediaPath,
          `../${media.webpage.id ?? message.id}_image.jpeg`
        );
      }

      if (media.poll) {
        const pollPath = path.join(mediaPath, `../${message.id}_poll.json`);
        fs.writeFileSync(pollPath, circularStringify(media.poll, 2));
      }

      await client.downloadMedia(message, {
        outputFile: mediaPath,
        progressCallback: (downloaded, total) => {
          const name = path.basename(mediaPath);
          if (total === downloaded) {
            logger.success(`File ${name} downloaded successfully`);
          }
        },
      });

      return true;
    } else {
      logger.error("No media found in the message");
      return false;
    }
  } catch (err) {
    logger.error("Error in downloadMessageMedia()");
    console.error(err);
    return false;
  }
}
