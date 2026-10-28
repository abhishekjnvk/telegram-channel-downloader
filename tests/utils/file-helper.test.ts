import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// We need to test file-helper functions which use process.cwd() for paths.
// Strategy: create a temp directory, change cwd to it, run tests, restore cwd.

describe("file-helper", () => {
  let tmpDir: string;
  let originalCwd: string;
  let fileHelper: typeof import("../../src/utils/file-helper.js");

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgdl-fh-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    // Re-import to pick up new cwd
    vi.resetModules();
    fileHelper = await import("../../src/utils/file-helper.js");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getCredentials", () => {
    it("should read credentials from config.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: 12345, apiHash: "abc123", sessionId: "" })
      );
      const creds = fileHelper.getCredentials();
      expect(creds.apiId).toBe(12345);
      expect(creds.apiHash).toBe("abc123");
      expect(creds.sessionId).toBe("");
    });

    it("should prefer environment variables over config.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: 11111, apiHash: "file_hash", sessionId: "file_session" })
      );
      process.env.TELEGRAM_API_ID = "99999";
      process.env.TELEGRAM_API_HASH = "env_hash";
      process.env.TELEGRAM_SESSION = "env_session";

      const creds = fileHelper.getCredentials();
      expect(creds.apiId).toBe(99999);
      expect(creds.apiHash).toBe("env_hash");
      expect(creds.sessionId).toBe("env_session");

      delete process.env.TELEGRAM_API_ID;
      delete process.env.TELEGRAM_API_HASH;
      delete process.env.TELEGRAM_SESSION;
    });

    it("should throw if config.json does not exist and no env vars", () => {
      expect(() => fileHelper.getCredentials()).toThrow("Missing Telegram credentials");
    });

    it("should coerce string apiId from config.json to number", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: "12345", apiHash: "abc123", sessionId: "" })
      );
      const creds = fileHelper.getCredentials();
      expect(creds.apiId).toBe(12345);
      expect(typeof creds.apiId).toBe("number");
    });

    it("should throw if apiId is missing or invalid in config.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: 0, apiHash: "abc123", sessionId: "" })
      );
      expect(() => fileHelper.getCredentials()).toThrow("apiId");
    });

    it("should throw if apiId is not a number in config.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: "not_a_number", apiHash: "abc123", sessionId: "" })
      );
      expect(() => fileHelper.getCredentials()).toThrow("apiId");
    });

    it("should throw if config.json is malformed JSON", () => {
      fs.writeFileSync(path.join(tmpDir, "config.json"), "{invalid json}");
      expect(() => fileHelper.getCredentials()).toThrow("Invalid Telegram credentials");
    });
  });

  describe("updateCredentials", () => {
    it("should update credentials in config.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ apiId: 12345, apiHash: "abc123", sessionId: "" })
      );
      fileHelper.updateCredentials({ sessionId: "new_session_123" });
      const creds = fileHelper.getCredentials();
      expect(creds.sessionId).toBe("new_session_123");
      expect(creds.apiId).toBe(12345); // Unchanged
    });
  });

  describe("getLastSelection / updateLastSelection", () => {
    it("should return empty object when no file exists", () => {
      const sel = fileHelper.getLastSelection();
      expect(sel).toEqual({});
    });

    it("should save and retrieve last selection", () => {
      fileHelper.updateLastSelection({ channelId: "12345", messageOffsetId: 100 });
      const sel = fileHelper.getLastSelection();
      expect(sel.channelId).toBe("12345");
      expect(sel.messageOffsetId).toBe(100);
    });

    it("should merge with existing selection", () => {
      fileHelper.updateLastSelection({ channelId: "12345", messageOffsetId: 100 });
      fileHelper.updateLastSelection({ messageOffsetId: 200 });
      const sel = fileHelper.getLastSelection();
      expect(sel.channelId).toBe("12345"); // Preserved
      expect(sel.messageOffsetId).toBe(200); // Updated
    });

    it("should create export directory if it does not exist", () => {
      expect(fs.existsSync(path.join(tmpDir, "export"))).toBe(false);
      fileHelper.updateLastSelection({ channelId: "123" });
      expect(fs.existsSync(path.join(tmpDir, "export"))).toBe(true);
    });
  });
});
