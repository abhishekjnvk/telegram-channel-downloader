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
  getMediaType,
  getMediaPath,
  getMediaPathChronological,
  checkFileExist,
  checkFileExistChronological,
  getDialogType,
  wait,
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
