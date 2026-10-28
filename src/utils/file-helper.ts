import fs from "fs";
import path from "path";
import type { Config, LastSelection } from "../types/index.js";
import logger from "./logger.js";

const CONFIG_FILE = path.join(process.cwd(), "config.json");
const EXPORT_DIR = path.join(process.cwd(), "export");
const LAST_SELECTION_FILE = path.join(EXPORT_DIR, "last_selection.json");

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

// ─── Generic File I/O ────────────────────────────────────────────────────────

function readFileSync(filePath: string, showError = true): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (showError) {
      logger.error(`Error reading file: ${filePath}`);
      console.error(err);
    }
    throw err;
  }
}

function writeFileSync(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    logger.error(`Error writing file: ${filePath}`);
    console.error(err);
    throw err;
  }
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export function updateCredentials(obj: Partial<Config>): void {
  try {
    const data = readFileSync(CONFIG_FILE);
    const credentials = { ...(JSON.parse(data) as Config), ...obj };
    writeFileSync(CONFIG_FILE, credentials);
  } catch (err) {
    logger.error("Failed to update credentials");
    console.error(err);
  }
}

export function getCredentials(): Config {
  // Environment variable overrides
  const envApiId = process.env.TELEGRAM_API_ID;
  const envApiHash = process.env.TELEGRAM_API_HASH;
  const envSessionId = process.env.TELEGRAM_SESSION;

  if (envApiId && envApiHash) {
    return {
      apiId: Number(envApiId),
      apiHash: envApiHash,
      sessionId: envSessionId || "",
    };
  }

  let data: string;
  try {
    data = readFileSync(CONFIG_FILE);
  } catch {
    logger.error(
      "Please add your credentials in config.json or set TELEGRAM_API_ID / TELEGRAM_API_HASH environment variables. " +
        "See https://github.com/abhishekjnvk/telegram-channel-downloader#setup for more info"
    );
    throw new Error("Missing Telegram credentials");
  }

  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const apiId = Number(parsed.apiId);
    if (!apiId || isNaN(apiId)) {
      throw new Error("Invalid or missing apiId in config.json");
    }
    return {
      apiId,
      apiHash: String(parsed.apiHash ?? ""),
      sessionId: String(parsed.sessionId ?? ""),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("apiId")) {
      logger.error(err.message);
      throw err;
    }
    logger.error("Failed to parse config.json — please check the file format.");
    throw new Error("Invalid Telegram credentials");
  }
}

// ─── Last Selection ──────────────────────────────────────────────────────────

export function getLastSelection(): LastSelection {
  try {
    const data = readFileSync(LAST_SELECTION_FILE, false);
    return JSON.parse(data) as LastSelection;
  } catch {
    return {};
  }
}

export function updateLastSelection(object: Partial<LastSelection>): void {
  try {
    ensureExportDir();
    const last = { ...getLastSelection(), ...object };
    writeFileSync(LAST_SELECTION_FILE, last);
  } catch (err) {
    logger.error("Failed to update last selection");
    console.error(err);
  }
}
