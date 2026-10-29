import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  filterString,
  circularStringify,
  appendToJSONArrayFile,
  retryWithBackoff,
  isRetryableDownloadError,
  formatMessageText,
  formatMessageMarkdown,
  formatMessagePlainText,
  getMediaType,
  getMediaPath,
  getMediaPathChronological,
  checkFileExist,
  checkFileExistChronological,
  getDialogType,
  wait,
  sanitizeFilename,
  formatBytes,
  formatDuration,
  createConcurrencyLimiter,
  buildExportFolderName,
  MEDIA_TYPES,
} from "../../src/utils/helper.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tgdl-test-"));
}

function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Creates a mock Telegram message with media. */
function mockMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    date: 1717200000,
    out: false,
    message: "Hello",
    media: {
      photo: {},
    },
    ...overrides,
  };
}

// ─── filterString ────────────────────────────────────────────────────────────

describe("filterString", () => {
  it("should remove non-alphanumeric characters", () => {
    expect(filterString("image")).toBe("image");
    expect(filterString("my-file_name!")).toBe("myfilename");
    expect(filterString("a.b c/d")).toBe("abcd");
    expect(filterString("")).toBe("");
    expect(filterString("123!@#")).toBe("123");
  });
});

// ─── circularStringify ───────────────────────────────────────────────────────

describe("circularStringify", () => {
  it("should stringify a simple object", () => {
    expect(circularStringify({ a: 1, b: "hello" })).toBe(
      JSON.stringify({ a: 1, b: "hello" }, null, 2)
    );
  });

  it("should handle circular references", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj;
    const result = circularStringify(obj);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("test");
    expect(parsed.self).toBeUndefined();
  });

  it("should handle null", () => {
    expect(JSON.parse(circularStringify(null))).toBeNull();
  });

  it("should handle undefined by returning undefined from stringify", () => {
    // JSON.stringify(undefined) returns undefined (not a string)
    expect(circularStringify(undefined as unknown as object)).toBeUndefined();
  });
});

// ─── appendToJSONArrayFile ───────────────────────────────────────────────────

describe("appendToJSONArrayFile", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    filePath = path.join(tmpDir, "test.json");
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should create a new JSON array file", () => {
    appendToJSONArrayFile(filePath, [{ id: 1 }, { id: 2 }]);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should append elements to an existing array (not nest)", () => {
    // First call creates the file
    appendToJSONArrayFile(filePath, [{ id: 1 }, { id: 2 }]);
    // Second call should append, not nest
    appendToJSONArrayFile(filePath, [{ id: 3 }, { id: 4 }]);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    expect(data).toHaveLength(4); // Not 2 with a nested array
  });

  it("should handle empty array append", () => {
    appendToJSONArrayFile(filePath, [{ id: 1 }]);
    appendToJSONArrayFile(filePath, []);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(data).toEqual([{ id: 1 }]);
  });
});

// ─── retryWithBackoff ────────────────────────────────────────────────────────

describe("retryWithBackoff", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("recovered");

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after exhausting all retries", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("always fails"));

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("should not retry if shouldRetry returns false", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("CHANNEL_PRIVATE"));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        shouldRetry: isRetryableDownloadError,
      })
    ).rejects.toThrow("CHANNEL_PRIVATE");
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it("should call onRetry callback with attempt info", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
  });
});

// ─── isRetryableDownloadError ────────────────────────────────────────────────

describe("isRetryableDownloadError", () => {
  it("should identify retryable Telegram errors", () => {
    expect(isRetryableDownloadError(new Error("RPCError: -503: Timeout"))).toBe(true);
    expect(isRetryableDownloadError(new Error("FLOOD_WAIT_30"))).toBe(true);
    expect(isRetryableDownloadError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableDownloadError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableDownloadError(new Error("FILE_MIGRATE_5"))).toBe(true);
    expect(isRetryableDownloadError(new Error("NETWORK_ERROR"))).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    expect(isRetryableDownloadError(new Error("CHANNEL_PRIVATE"))).toBe(false);
    expect(isRetryableDownloadError(new Error("AUTH_KEY_UNREGISTERED"))).toBe(false);
    expect(isRetryableDownloadError(new Error("MESSAGE_ID_INVALID"))).toBe(false);
  });

  it("should return true for unknown errors (safe default)", () => {
    expect(isRetryableDownloadError(new Error("something weird"))).toBe(true);
    expect(isRetryableDownloadError(null)).toBe(true);
    expect(isRetryableDownloadError("string error")).toBe(true);
  });
});

// ─── formatMessageText ───────────────────────────────────────────────────────

describe("formatMessageText", () => {
  it("should return original text when no entities", () => {
    expect(formatMessageText("Hello world", undefined)).toBe("Hello world");
    expect(formatMessageText("Hello world", [])).toBe("Hello world");
  });

  it("should convert MessageEntityTextUrl to HTML links", () => {
    const entities = [
      { className: "MessageEntityTextUrl", url: "https://example.com", offset: 6, length: 5 },
    ];
    const result = formatMessageText("Hello world", entities);
    expect(result).toBe('Hello <a href="https://example.com">world</a>');
  });

  it("should handle multiple text URL entities", () => {
    const entities = [
      { className: "MessageEntityTextUrl", url: "https://a.com", offset: 0, length: 3 },
      { className: "MessageEntityTextUrl", url: "https://b.com", offset: 4, length: 3 },
    ];
    const result = formatMessageText("foo bar", entities);
    expect(result).toBe('<a href="https://a.com">foo</a> <a href="https://b.com">bar</a>');
  });

  it("should ignore non-text-url entities", () => {
    const entities = [{ className: "MessageEntityBold", offset: 0, length: 5 }];
    const result = formatMessageText("Hello world", entities);
    expect(result).toBe("Hello world");
  });

  it("should not mutate the original entities array", () => {
    const entities = [
      { className: "MessageEntityTextUrl", url: "https://example.com", offset: 6, length: 5 },
    ];
    const originalOrder = [...entities];
    formatMessageText("Hello world", entities);
    expect(entities).toEqual(originalOrder);
  });
});

// ─── getMediaType ────────────────────────────────────────────────────────────

describe("getMediaType", () => {
  it("should return 'others' for message without media", () => {
    expect(getMediaType({ id: 1, media: undefined } as never)).toBe(MEDIA_TYPES.OTHERS);
    expect(getMediaType({ id: 1, media: null } as never)).toBe(MEDIA_TYPES.OTHERS);
  });

  it("should identify photo as image", () => {
    const msg = mockMessage({ media: { photo: {} } });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.IMAGE);
  });

  it("should identify video", () => {
    const msg = mockMessage({ media: { video: {} } });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.VIDEO);
  });

  it("should identify audio", () => {
    const msg = mockMessage({ media: { audio: {} } });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.AUDIO);
  });

  it("should identify document by mime type", () => {
    const msg = mockMessage({
      media: { document: { mimeType: "image/png", attributes: [] } },
    });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.IMAGE);
  });

  it("should identify sticker document", () => {
    const msg = mockMessage({
      media: { document: { mimeType: "application/x-tgsticker", attributes: [] } },
    });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.STICKER);
  });

  it("should default to document for unknown mime types", () => {
    const msg = mockMessage({
      media: { document: { mimeType: "application/zip", attributes: [] } },
    });
    expect(getMediaType(msg as never)).toBe(MEDIA_TYPES.DOCUMENT);
  });

  it("should identify webpage, poll, geo, contact, venue, sticker", () => {
    expect(getMediaType(mockMessage({ media: { webpage: {} } }) as never)).toBe(
      MEDIA_TYPES.WEBPAGE
    );
    expect(getMediaType(mockMessage({ media: { poll: {} } }) as never)).toBe(MEDIA_TYPES.POLL);
    expect(getMediaType(mockMessage({ media: { geo: {} } }) as never)).toBe(MEDIA_TYPES.GEO);
    expect(getMediaType(mockMessage({ media: { contact: {} } }) as never)).toBe(
      MEDIA_TYPES.CONTACT
    );
    expect(getMediaType(mockMessage({ media: { venue: {} } }) as never)).toBe(MEDIA_TYPES.VENUE);
    expect(getMediaType(mockMessage({ media: { sticker: {} } }) as never)).toBe(
      MEDIA_TYPES.STICKER
    );
  });
});

// ─── getMediaPath & checkFileExist ───────────────────────────────────────────

describe("getMediaPath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should return 'unknown' for message without media", () => {
    expect(getMediaPath({ id: 1, media: undefined } as never, tmpDir)).toBe("unknown");
  });

  it("should create path with media type folder", () => {
    const msg = mockMessage({ media: { photo: {} } });
    const result = getMediaPath(msg as never, tmpDir, true);
    expect(result).toContain(tmpDir);
    expect(result).toContain("image");
    expect(result).toContain(".jpg");
  });

  it("should create necessary directories", () => {
    const msg = mockMessage({ media: { video: {} } });
    const result = getMediaPath(msg as never, tmpDir, true);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("should generate unique name if file already exists", () => {
    const msg = mockMessage({ id: 42, media: { photo: {} } });
    const result1 = getMediaPath(msg as never, tmpDir, true);
    fs.writeFileSync(result1, "existing");
    const result2 = getMediaPath(msg as never, tmpDir, true);
    expect(result2).not.toBe(result1);
    expect(result2).toContain("42");
  });
});

describe("checkFileExist", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should return false for message without media", () => {
    expect(checkFileExist({ id: 1, media: undefined } as never, tmpDir)).toBe(false);
  });

  it("should return false if file does not exist", () => {
    const msg = mockMessage({ media: { photo: {} } });
    expect(checkFileExist(msg as never, tmpDir)).toBe(false);
  });

  it("should return true if file exists", () => {
    const msg = mockMessage({ id: 99, media: { photo: {} } });
    // Create the expected file path
    const mediaPath = getMediaPath(msg as never, tmpDir, true);
    fs.writeFileSync(mediaPath, "content");
    expect(checkFileExist(msg as never, tmpDir)).toBe(true);
  });
});

// ─── getMediaPathChronological & checkFileExistChronological ─────────────────

describe("getMediaPathChronological", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should save in 'messages' subfolder with message ID prefix", () => {
    const msg = mockMessage({ id: 123, media: { photo: {} } });
    const result = getMediaPathChronological(msg as never, tmpDir, true);
    expect(result).toContain("messages");
    expect(result).toContain("123_");
    expect(result).toContain(".jpg");
  });

  it("should create the messages directory", () => {
    const msg = mockMessage({ id: 456, media: { photo: {} } });
    const result = getMediaPathChronological(msg as never, tmpDir, true);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("should return 'unknown' for message without media", () => {
    expect(getMediaPathChronological({ id: 1, media: undefined } as never, tmpDir)).toBe("unknown");
  });
});

describe("checkFileExistChronological", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("should return false for message without media", () => {
    expect(checkFileExistChronological({ id: 1, media: undefined } as never, tmpDir)).toBe(false);
  });

  it("should detect existing file in messages folder", () => {
    const msg = mockMessage({ id: 789, media: { photo: {} } });
    const mediaPath = getMediaPathChronological(msg as never, tmpDir, true);
    fs.writeFileSync(mediaPath, "content");
    expect(checkFileExistChronological(msg as never, tmpDir)).toBe(true);
  });

  it("should return false if file does not exist", () => {
    const msg = mockMessage({ id: 999, media: { photo: {} } });
    expect(checkFileExistChronological(msg as never, tmpDir)).toBe(false);
  });
});

// ─── getDialogType ───────────────────────────────────────────────────────────

describe("getDialogType", () => {
  it("should identify channel", () => {
    expect(getDialogType({ isChannel: true })).toBe("Channel");
  });

  it("should identify group", () => {
    expect(getDialogType({ isGroup: true })).toBe("Group");
  });

  it("should identify user", () => {
    expect(getDialogType({ isUser: true })).toBe("User");
  });

  it("should return Unknown for unrecognized", () => {
    expect(getDialogType({})).toBe("Unknown");
  });
});

// ─── wait ────────────────────────────────────────────────────────────────────

describe("wait", () => {
  it("should resolve after the specified time", async () => {
    const start = Date.now();
    await wait(0.05); // 50ms
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
  });
});

// ─── sanitizeFilename ────────────────────────────────────────────────────────

describe("sanitizeFilename", () => {
  it("should remove invalid Windows characters", () => {
    // Invalid chars are replaced with _, then consecutive _ are collapsed
    expect(sanitizeFilename('file<>:"/\\|?*.txt')).toBe("file_.txt");
  });

  it("should replace spaces with underscores", () => {
    expect(sanitizeFilename("my file name.pdf")).toBe("my_file_name.pdf");
  });

  it("should collapse multiple underscores", () => {
    expect(sanitizeFilename("file   name.txt")).toBe("file_name.txt");
  });

  it("should remove leading dots", () => {
    expect(sanitizeFilename("..hidden")).toBe("hidden");
  });

  it("should truncate to 255 characters", () => {
    const longName = "a".repeat(300);
    expect(sanitizeFilename(longName)).toHaveLength(255);
  });

  it("should leave clean filenames unchanged", () => {
    expect(sanitizeFilename("normal_file-123.pdf")).toBe("normal_file-123.pdf");
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe("formatBytes", () => {
  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 Bytes");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("should format with custom decimals", () => {
    expect(formatBytes(1536, 1)).toBe("1.5 KB");
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("should format seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("should format minutes and seconds", () => {
    expect(formatDuration(90000)).toBe("1m 30s");
  });

  it("should format hours, minutes, and seconds", () => {
    expect(formatDuration(3661000)).toBe("1h 1m 1s");
  });

  it("should format 0 ms", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

// ─── createConcurrencyLimiter ────────────────────────────────────────────────

describe("createConcurrencyLimiter", () => {
  it("should limit concurrency to the specified limit", async () => {
    const limit = createConcurrencyLimiter(2);
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }, (_, i) =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return i;
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("should resolve all tasks even with limit 1", async () => {
    const limit = createConcurrencyLimiter(1);
    const tasks = Array.from({ length: 3 }, (_, i) =>
      limit(async () => {
        await Promise.resolve();
        return i;
      })
    );
    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2]);
  });

  it("should propagate errors", async () => {
    const limit = createConcurrencyLimiter(2);
    const tasks = [
      limit(async () => {
        await Promise.resolve();
        return "ok";
      }),
      limit(async () => {
        await Promise.resolve();
        throw new Error("fail");
      }),
    ];
    const results = await Promise.allSettled(tasks);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
  });
});

// ─── formatMessageMarkdown ───────────────────────────────────────────────────

describe("formatMessageMarkdown", () => {
  it("should return original text when no entities", () => {
    expect(formatMessageMarkdown("Hello world", undefined)).toBe("Hello world");
    expect(formatMessageMarkdown("Hello world", [])).toBe("Hello world");
  });

  it("should convert bold to **text**", () => {
    const entities = [{ className: "MessageEntityBold", offset: 0, length: 5 }];
    expect(formatMessageMarkdown("Hello world", entities)).toBe("**Hello** world");
  });

  it("should convert italic to *text*", () => {
    const entities = [{ className: "MessageEntityItalic", offset: 6, length: 5 }];
    expect(formatMessageMarkdown("Hello world", entities)).toBe("Hello *world*");
  });

  it("should convert code to `text`", () => {
    const entities = [{ className: "MessageEntityCode", offset: 0, length: 4 }];
    expect(formatMessageMarkdown("code here", entities)).toBe("`code` here");
  });

  it("should convert pre to fenced code block", () => {
    const entities = [{ className: "MessageEntityPre", offset: 0, length: 4 }];
    expect(formatMessageMarkdown("code", entities)).toBe("```\ncode\n```");
  });

  it("should convert text URL to [text](url)", () => {
    const entities = [
      { className: "MessageEntityTextUrl", url: "https://example.com", offset: 0, length: 5 },
    ];
    expect(formatMessageMarkdown("Click", entities)).toBe("[Click](https://example.com)");
  });

  it("should convert strikethrough to ~~text~~", () => {
    const entities = [{ className: "MessageEntityStrike", offset: 0, length: 4 }];
    expect(formatMessageMarkdown("gone", entities)).toBe("~~gone~~");
  });

  it("should convert blockquote to > text", () => {
    const entities = [{ className: "MessageEntityBlockquote", offset: 0, length: 5 }];
    expect(formatMessageMarkdown("quote", entities)).toBe("> quote");
  });

  it("should handle multiple entities", () => {
    const entities = [
      { className: "MessageEntityBold", offset: 0, length: 5 },
      { className: "MessageEntityItalic", offset: 6, length: 5 },
    ];
    expect(formatMessageMarkdown("Hello world", entities)).toBe("**Hello** *world*");
  });

  it("should not mutate the original entities array", () => {
    const entities = [{ className: "MessageEntityBold", offset: 0, length: 5 }];
    const original = [...entities];
    formatMessageMarkdown("Hello", entities);
    expect(entities).toEqual(original);
  });
});

// ─── formatMessagePlainText ──────────────────────────────────────────────────

describe("formatMessagePlainText", () => {
  it("should format a basic message", () => {
    const msg = { id: 1, date: 1717200000, message: "Hello world" };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("msg #1");
    expect(result).toContain("Hello world");
  });

  it("should show 'You' for outgoing messages", () => {
    const msg = { id: 1, date: 1717200000, out: true, message: "Hi" };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("You");
  });

  it("should show sender for incoming messages", () => {
    const msg = { id: 1, date: 1717200000, out: false, sender: "Alice", message: "Hi" };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("User Alice");
  });

  it("should include media name when present", () => {
    const msg = { id: 1, date: 1717200000, message: "Photo", mediaName: "photo.jpg" };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("[media: photo.jpg]");
  });

  it("should include date in the output", () => {
    const msg = { id: 1, date: 1717200000, message: "Test" };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("2024-");
  });

  it("should handle message without text", () => {
    const msg = { id: 1, date: 1717200000 };
    const result = formatMessagePlainText(msg);
    expect(result).toContain("msg #1");
  });
});

// ─── buildExportFolderName ───────────────────────────────────────────────────

describe("buildExportFolderName", () => {
  it("should combine name and id with ' - ' separator", () => {
    expect(buildExportFolderName("My Channel", "12345")).toBe("My_Channel - 12345");
  });

  it("should sanitize special characters in name", () => {
    expect(buildExportFolderName('My <Channel>: "test"', "123")).toBe("My_Channel_test_ - 123");
  });

  it("should sanitize the id", () => {
    expect(buildExportFolderName("Test", "abc/def")).toBe("Test - abc_def");
  });

  it("should fall back to just the id when name is undefined", () => {
    expect(buildExportFolderName(undefined, "99999")).toBe("99999");
  });

  it("should fall back to just the id when name is empty string", () => {
    expect(buildExportFolderName("", "99999")).toBe("99999");
  });

  it("should handle numeric channel id", () => {
    expect(buildExportFolderName("News", 12345)).toBe("News - 12345");
  });

  it("should collapse multiple spaces/underscores", () => {
    expect(buildExportFolderName("My   Cool   Channel", "1")).toBe("My_Cool_Channel - 1");
  });
});
