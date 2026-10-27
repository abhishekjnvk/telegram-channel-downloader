/**
 * Shared type definitions for the Telegram Channel Downloader.
 */

import type { Api } from "telegram/tl";
import type { TelegramClient } from "telegram";
import type { Dialog } from "telegram/tl/custom/dialog";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface Config {
  apiId: number;
  apiHash: string;
  sessionId: string;
}

// ─── Credentials / Session ───────────────────────────────────────────────────

export interface LastSelection {
  channelId?: number | string;
  messageOffsetId?: number;
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export type DialogType = "Channel" | "Group" | "User" | "Unknown";

export interface DialogInfo {
  deletedAccount?: boolean;
  isBot?: boolean;
  username?: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  id: number | string;
  type: DialogType;
}

// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "webpage"
  | "poll"
  | "geo"
  | "venue"
  | "contact"
  | "sticker"
  | "document"
  | "others";

export interface DownloadableFiles {
  image?: boolean;
  video?: boolean;
  audio?: boolean;
  webpage?: boolean;
  poll?: boolean;
  geo?: boolean;
  contact?: boolean;
  venue?: boolean;
  sticker?: boolean;
  document?: boolean;
  pdf?: boolean;
  all?: boolean;
  [extension: string]: boolean | undefined;
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface RecordedMessage {
  id: number;
  message: string;
  date: number;
  out: boolean;
  hasMedia: boolean;
  sender?: string | number;
  mediaType?: MediaType;
  mediaPath?: string;
  mediaName?: string;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS";

export interface LogOptions {
  showTimestamp?: boolean;
  showLevel?: boolean;
  showIcon?: boolean;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

export interface CliOptions {
  channelId?: string;
  messageIds?: string;
  help?: boolean;
  [key: string]: string | boolean | undefined;
}

export interface CommandInfo {
  signature: string;
  path: string;
  description: string;
}

export interface CommandClass {
  new (): CommandInstance;
  description(): string;
  help?(): string;
}

export interface CommandInstance {
  handle(options: CliOptions): Promise<void>;
}

// ─── Download Options ────────────────────────────────────────────────────────

export interface DownloadChannelOptions {
  channelId?: string;
  downloadableFiles?: DownloadableFiles;
}

// ─── Re-exports from GramJS for convenience ──────────────────────────────────

export type { TelegramClient, Api, Dialog };
