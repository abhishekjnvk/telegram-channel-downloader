import mimeDB from "mime-db";
import fs from "fs";
import path from "path";
import type { Api } from "telegram/tl";
import type { MediaType, RecordedMessage } from "../types/index.js";
import logger from "./logger.js";

// ─── Media Types ─────────────────────────────────────────────────────────────

export const MEDIA_TYPES: Record<string, MediaType> = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  WEBPAGE: "webpage",
  POLL: "poll",
  GEO: "geo",
  VENUE: "venue",
  CONTACT: "contact",
  STICKER: "sticker",
  DOCUMENT: "document",
  OTHERS: "others",
};

// ─── Media Type Detection ────────────────────────────────────────────────────

type TelegramMessage = Api.Message;

interface MediaWithDocument {
  document?: {
    mimeType?: string;
    attributes?: Array<{ className?: string; fileName?: string }>;
  };
  photo?: unknown;
  video?: unknown;
  audio?: unknown;
  webpage?: unknown;
  poll?: unknown;
  geo?: unknown;
  contact?: unknown;
  venue?: unknown;
  sticker?: unknown;
}

export function getMediaType(message: TelegramMessage): MediaType {
  if (!message.media) return MEDIA_TYPES.OTHERS;

  const media = message.media as unknown as MediaWithDocument;

  if (media.photo) return MEDIA_TYPES.IMAGE;
  if (media.video) return MEDIA_TYPES.VIDEO;
  if (media.audio) return MEDIA_TYPES.AUDIO;
  if (media.webpage) return MEDIA_TYPES.WEBPAGE;
  if (media.poll) return MEDIA_TYPES.POLL;
  if (media.geo) return MEDIA_TYPES.GEO;
  if (media.contact) return MEDIA_TYPES.CONTACT;
  if (media.venue) return MEDIA_TYPES.VENUE;
  if (media.sticker) return MEDIA_TYPES.STICKER;

  if (media.document) {
    const mimeType = media.document.mimeType;
    if (mimeType) {
      if (mimeType.includes(MEDIA_TYPES.IMAGE)) return MEDIA_TYPES.IMAGE;
      if (mimeType.includes(MEDIA_TYPES.VIDEO)) return MEDIA_TYPES.VIDEO;
      if (mimeType.includes(MEDIA_TYPES.AUDIO)) return MEDIA_TYPES.AUDIO;
      if (mimeType.includes(MEDIA_TYPES.STICKER)) return MEDIA_TYPES.STICKER;
    }
    return MEDIA_TYPES.DOCUMENT;
  }

  return MEDIA_TYPES.OTHERS;
}

// ─── File Name Resolution ────────────────────────────────────────────────────

interface DocumentAttribute {
  className?: string;
  fileName?: string;
}

interface DocumentMedia {
  mimeType?: string;
  attributes?: DocumentAttribute[];
}

interface MediaForFileName {
  document?: DocumentMedia;
  video?: unknown;
  audio?: unknown;
  photo?: unknown;
}

/**
 * Resolves the file name for a message's media.
 * Shared between checkFileExist and getMediaPath to avoid duplication.
 */
function getMediaFileName(message: TelegramMessage): string {
  let fileName = `${message.id}_file`;
  const media = message.media as unknown as MediaForFileName | undefined;

  if (!media) return fileName;

  if (media.document) {
    const docAttributes = media.document.attributes;
    if (docAttributes) {
      const fileNameAttr = docAttributes.find(
        (attr) => attr.className === "DocumentAttributeFilename"
      );
      if (fileNameAttr?.fileName) {
        fileName = fileNameAttr.fileName;
      } else {
        const mimeType = media.document.mimeType;
        const ext = mimeType ? mimeDB[mimeType]?.extensions?.[0] : undefined;
        if (ext) fileName += `.${ext}`;
      }
    }
  }

  if (media.video) fileName += ".mp4";
  if (media.audio) fileName += ".mp3";
  if (media.photo) fileName += ".jpg";

  return fileName;
}

// ─── File Existence Check ────────────────────────────────────────────────────

export function checkFileExist(message: TelegramMessage, outputFolder: string): boolean {
  if (!message.media) return false;

  const fileName = getMediaFileName(message);
  const folderType = filterString(getMediaType(message));
  const filePath = path.join(outputFolder, folderType, fileName);

  return fs.existsSync(filePath);
}

// ─── Media Path Resolution ───────────────────────────────────────────────────

export function getMediaPath(
  message: TelegramMessage,
  outputFolder: string,
  silent = false
): string {
  if (!message.media) return "unknown";

  let fileName = getMediaFileName(message);
  const folderType = filterString(getMediaType(message));
  let filePath = path.join(outputFolder, folderType, fileName);

  if (fs.existsSync(filePath)) {
    if (!silent) {
      logger.info(`File already exists: ${filePath}, changing name`);
    }
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    fileName = `${baseName}_${message.id}${ext}`;
    filePath = path.join(outputFolder, folderType, fileName);
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return filePath;
}

// ─── Dialog Type ─────────────────────────────────────────────────────────────

interface DialogLike {
  isChannel?: boolean;
  isGroup?: boolean;
  isUser?: boolean;
}

export function getDialogType(dialog: DialogLike): "Channel" | "Group" | "User" | "Unknown" {
  if (dialog.isChannel) return "Channel";
  if (dialog.isGroup) return "Group";
  if (dialog.isUser) return "User";
  return "Unknown";
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

export function filterString(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * JSON.stringify that handles circular references.
 */
export function circularStringify(obj: unknown, indent = 2): string {
  const cache = new Set<unknown>();
  const retVal = JSON.stringify(
    obj,
    (_key, value: unknown) =>
      typeof value === "object" && value !== null
        ? cache.has(value)
          ? undefined
          : (cache.add(value), value)
        : value,
    indent
  );
  cache.clear();
  return retVal;
}

/**
 * Appends data to a JSON array file.
 * Fixed: uses spread to append elements instead of nesting the array.
 */
export function appendToJSONArrayFile<T>(filePath: string, dataToAppend: T[]): void {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, circularStringify(dataToAppend, 2));
    } else {
      const data = fs.readFileSync(filePath, "utf8");
      const json = JSON.parse(data) as T[];
      json.push(...dataToAppend);
      fs.writeFileSync(filePath, circularStringify(json, 2));
    }
  } catch (err) {
    logger.error(`Error appending to JSON array file: ${filePath}`);
    console.error(err);
  }
}

// ─── Message Recording Helper ────────────────────────────────────────────────

interface MessageEntity {
  className?: string;
  url?: string;
  offset: number;
  length: number;
}

interface MessageWithEntities {
  id: number;
  message?: string;
  date: number;
  out: boolean;
  media?: unknown;
  entities?: MessageEntity[];
  fromId?: { userId?: string | number };
  peerId?: { userId?: string | number };
}

export function formatMessageText(
  messageText: string,
  entities: MessageEntity[] | undefined
): string {
  if (!entities || entities.length === 0) return messageText;

  // Sort descending by offset so replacements don't shift indices
  const sorted = [...entities].sort((a, b) => b.offset - a.offset);
  let text = messageText;

  for (const entity of sorted) {
    if (entity.className === "MessageEntityTextUrl" && entity.url) {
      const linkText = text.substring(entity.offset, entity.offset + entity.length);
      text =
        text.substring(0, entity.offset) +
        `<a href="${entity.url}">${linkText}</a>` +
        text.substring(entity.offset + entity.length);
    }
  }

  return text;
}

export function buildRecordedMessage(
  msg: MessageWithEntities,
  outputFolder: string,
  hasMediaFn: (m: TelegramMessage) => boolean,
  getMediaTypeFn: (m: TelegramMessage) => MediaType,
  getMediaPathFn: (m: TelegramMessage, folder: string, silent?: boolean) => string
): RecordedMessage {
  const hasMedia = hasMediaFn(msg as unknown as TelegramMessage);
  const messageText = formatMessageText(msg.message || "", msg.entities);

  return {
    id: msg.id,
    message: messageText,
    date: msg.date,
    out: msg.out,
    hasMedia,
    sender: msg.fromId?.userId || msg.peerId?.userId,
    mediaType: hasMedia ? getMediaTypeFn(msg as unknown as TelegramMessage) : undefined,
    mediaPath: hasMedia
      ? getMediaPathFn(msg as unknown as TelegramMessage, outputFolder, true)
      : undefined,
    mediaName: hasMedia
      ? path.basename(getMediaPathFn(msg as unknown as TelegramMessage, outputFolder, true))
      : undefined,
  };
}
