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

export type DownloadOrder = "byType" | "chronological";

export interface CliOptions {
  channelId?: string;
  channelIds?: string;
  messageIds?: string;
  startDate?: string;
  endDate?: string;
  order?: string;
  includeComments?: string | boolean;
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

export interface DateRange {
  startDate?: number; // Unix timestamp (seconds)
  endDate?: number; // Unix timestamp (seconds)
}

export interface DownloadChannelOptions {
  channelId?: string;
  channelIds?: string;
  downloadableFiles?: DownloadableFiles;
  startDate?: string; // ISO date string e.g. "2024-06-01"
  endDate?: string; // ISO date string e.g. "2024-06-18"
  order?: DownloadOrder;
  includeComments?: boolean;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export interface FileMetadata {
  messageId: number;
  date: number;
  dateISO: string;
  text: string;
  sender?: string | number;
  mediaType?: MediaType;
  fileName: string;
  filePath: string;
}

// ─── Re-exports from GramJS for convenience ──────────────────────────────────

export type { TelegramClient, Api, Dialog };
