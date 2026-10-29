import fs from "fs";
import path from "path";
import type { TelegramClient, Api } from "telegram";
import logger from "../utils/logger.js";
import { circularStringify, retryWithBackoff, isRetryableDownloadError } from "../utils/helper.js";

// ─── Get Messages ────────────────────────────────────────────────────────────

/**
 * Checks if an error is a Telegram RPC error with a specific error message.
 */
function isRpcError(error: unknown, errorMessage: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { errorMessage?: string; message?: string };
  return err.errorMessage === errorMessage || (err.message ?? "").includes(errorMessage);
}

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
    if (isRpcError(error, "CHANNEL_PRIVATE")) {
      throw new Error(
        "Access denied: This is a private channel. " +
          "You must join the channel in Telegram first before downloading. " +
          "Open the channel link in your Telegram app, tap 'Join', then try again."
      );
    }
    if (isRpcError(error, "USERNAME_INVALID")) {
      throw new Error(
        "Invalid channel. The channel username or ID is not valid, " +
          "or the channel doesn't exist."
      );
    }
    if (isRpcError(error, "CHANNEL_INVALID")) {
      throw new Error(
        "Invalid channel. The channel ID is not valid, " + "or you don't have access to it."
      );
    }
    throw new Error(`Failed to get messages: ${(error as Error).message}`);
  }
}

// ─── Get Message Detail ──────────────────────────────────────────────────────

export async function getMessageDetail(
  client: TelegramClient,
  channelId: string | number,
  messageIds: number[]
): Promise<Api.Message[]> {
  if (!client || !channelId || !messageIds || messageIds.length === 0) {
    throw new Error("Client, channelId, and messageIds are required");
  }

  try {
    const result = await client.getMessages(channelId, { ids: messageIds });
    return result;
  } catch (error) {
    if (isRpcError(error, "CHANNEL_PRIVATE")) {
      throw new Error(
        "Access denied: This is a private channel. " +
          "You must join the channel in Telegram first before downloading."
      );
    }
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

export interface DownloadResult {
  success: boolean;
  skipped: boolean;
  filePath?: string;
  fileSize?: number;
}

export async function downloadMessageMedia(
  client: TelegramClient,
  message: Api.Message,
  mediaPath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<DownloadResult> {
  try {
    if (!client || !message || !mediaPath) {
      logger.error("Client, message, and mediaPath are required");
      return { success: false, skipped: false };
    }

    if (message.media) {
      const media = message.media as unknown as MediaWithWebpage;

      if (media.webpage) {
        const url = media.webpage.url;
        if (url) {
          const urlPath = path.join(mediaPath, `../${message.id}_url.txt`);
          fs.writeFileSync(urlPath, url);
        }

        mediaPath = path.join(mediaPath, `../${media.webpage.id ?? message.id}_image.jpeg`);
      }

      if (media.poll) {
        const pollPath = path.join(mediaPath, `../${message.id}_poll.json`);
        fs.writeFileSync(pollPath, circularStringify(media.poll, 2));
      }

      // Download to temp file first, then atomically rename to prevent
      // partial files from being mistaken as complete downloads.
      const tempPath = mediaPath + ".tmp";

      await retryWithBackoff(
        async () => {
          await client.downloadMedia(message, {
            outputFile: tempPath,
            progressCallback: (downloaded, total) => {
              if (onProgress) onProgress(Number(downloaded), Number(total));
            },
          });
        },
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 15000,
          shouldRetry: isRetryableDownloadError,
          onRetry: (attempt, error, delayMs) => {
            const name = path.basename(mediaPath);
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn(
              `Download of ${name} failed (attempt ${attempt}/3): ${errMsg}. ` +
                `Retrying in ${delayMs / 1000}s...`
            );
          },
        }
      );

      // Atomic move: temp file is complete, rename to final path
      fs.renameSync(tempPath, mediaPath);

      const stats = fs.statSync(mediaPath);
      const name = path.basename(mediaPath);
      logger.success(`File ${name} downloaded successfully (${stats.size} bytes)`);

      return { success: true, skipped: false, filePath: mediaPath, fileSize: stats.size };
    } else {
      logger.error("No media found in the message");
      return { success: false, skipped: false };
    }
  } catch (err) {
    const name = path.basename(mediaPath);
    logger.error(`Failed to download ${name} after retries.`);
    console.error(err);

    // Clean up temp and partial files so they re-download on next run
    // instead of being skipped as "existing" by checkFileExist.
    for (const p of [mediaPath + ".tmp", mediaPath]) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          logger.info(`Removed partial file: ${path.basename(p)}`);
        }
      } catch (cleanupErr) {
        logger.warn(`Could not remove partial file: ${(cleanupErr as Error).message}`);
      }
    }

    return { success: false, skipped: false };
  }
}

// ─── Comment / Discussion Media ──────────────────────────────────────────────

interface MessageReplies {
  replies?: number;
  channelId?: number | { value?: number };
  linkedChatId?: number | { value?: number };
}

/**
 * Downloads media from the discussion/comments of a channel post.
 *
 * @param client - Telegram client
 * @param channelId - The channel ID (where the post was made)
 * @param message - The channel post message
 * @param outputFolder - Base output folder (comments go into a `comments/` subfolder)
 */
export async function downloadCommentMedia(
  client: TelegramClient,
  message: Api.Message,
  outputFolder: string
): Promise<number> {
  try {
    const replies = (message as unknown as { replies?: MessageReplies }).replies;
    if (!replies) return 0;

    // Get the discussion group ID
    const discussionChatId = replies.channelId || replies.linkedChatId;

    if (!discussionChatId) return 0;

    const discussionId =
      typeof discussionChatId === "object"
        ? Number(discussionChatId.value)
        : Number(discussionChatId);

    if (!discussionId || isNaN(discussionId)) return 0;

    const commentsFolder = path.join(outputFolder, "comments", String(message.id));
    if (!fs.existsSync(commentsFolder)) {
      fs.mkdirSync(commentsFolder, { recursive: true });
    }

    logger.info(`Fetching comments for message ${message.id}...`);

    // Fetch messages from the discussion group
    const commentMessages = await client.getMessages(discussionId, { limit: 50 });
    if (!commentMessages || commentMessages.length === 0) {
      return 0;
    }

    let downloadedCount = 0;
    for (const commentMsg of commentMessages) {
      if (commentMsg.media) {
        const mediaPath = path.join(commentsFolder, `${commentMsg.id}_file`);
        const result = await downloadMessageMedia(client, commentMsg, mediaPath);
        if (result.success) downloadedCount++;
      }
    }

    if (downloadedCount > 0) {
      logger.info(
        `Downloaded ${downloadedCount} media file(s) from comments of message ${message.id}`
      );
    }

    return downloadedCount;
  } catch (err) {
    logger.warn(`Could not download comments for message ${message.id}: ${(err as Error).message}`);
    return 0;
  }
}

// ─── Profile Photo Download ──────────────────────────────────────────────────

/**
 * Downloads the profile photo of a channel/group/user.
 * Returns the file path if successful, or null if no photo exists.
 */
export async function downloadProfilePhoto(
  client: TelegramClient,
  entityId: string | number,
  outputFolder: string
): Promise<string | null> {
  try {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const photoPath = path.join(outputFolder, "profile_photo.jpg");

    // Skip if already downloaded
    if (fs.existsSync(photoPath)) {
      logger.info("Profile photo already exists, skipping");
      return photoPath;
    }

    const result = await client.downloadProfilePhoto(entityId, {
      outputFile: photoPath,
    });

    if (result && result.length > 0) {
      logger.success(`Profile photo downloaded: ${photoPath}`);
      return photoPath;
    }

    logger.info("No profile photo found for this chat");
    return null;
  } catch (err) {
    logger.warn(`Could not download profile photo: ${(err as Error).message}`);
    return null;
  }
}

// ─── Channel Info ────────────────────────────────────────────────────────────

interface EntityWithInfo {
  id?: { toString(): string } | string | number;
  title?: string;
  username?: string;
  about?: string;
  participantsCount?: number;
  date?: number;
  className?: string;
  isChannel?: boolean;
  isGroup?: boolean;
  isUser?: boolean;
}

/**
 * Fetches metadata about a channel/group/user.
 */
export async function getChannelInfo(
  client: TelegramClient,
  channelId: string | number
): Promise<{
  id: string | number;
  title: string;
  username?: string;
  description?: string;
  type: string;
  participantsCount?: number;
  createdDate?: number;
} | null> {
  try {
    const entity = (await client.getEntity(channelId)) as unknown as EntityWithInfo;

    let type = "Unknown";
    if (entity.isChannel) type = "Channel";
    else if (entity.isGroup) type = "Group";
    else if (entity.isUser) type = "User";

    return {
      id: entity.id?.toString() ?? channelId,
      title: entity.title ?? "Unknown",
      username: entity.username,
      description: entity.about,
      type,
      participantsCount: entity.participantsCount,
      createdDate: entity.date,
    };
  } catch (err) {
    logger.error(`Failed to get channel info: ${(err as Error).message}`);
    return null;
  }
}
