import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock modules that have side effects
vi.mock("../../src/modules/auth.js", () => ({
  initAuth: vi.fn(),
}));

vi.mock("../../src/utils/file-helper.js", () => ({
  updateLastSelection: vi.fn(),
  getLastSelection: vi.fn(() => ({})),
}));

vi.mock("../../src/utils/input-helper.js", () => ({
  downloadOptionInput: vi.fn(),
  dateRangeInput: vi.fn(() => ({})),
  parseDateOption: vi.fn(),
  orderInput: vi.fn(() => "byType"),
}));

import DownloadChannel from "../../src/scripts/download-channel.js";
import type { DownloadableFiles, DateRange } from "../../src/types/index.js";

// ─── Helpers to access private members for testing ───────────────────────────

type DownloadChannelInstance = DownloadChannel & {
  outputFolder: string | null;
  downloadableFiles: DownloadableFiles | null;
  dateRange: DateRange;
  order: string;
  includeComments: boolean;
  hasMedia: (message: { media?: unknown }) => boolean;
  isWithinDateRange: (message: { date: number }) => boolean;
  canDownload: (message: { media?: unknown; id: number; date: number }) => boolean;
  getMediaPathForMessage: (message: { media?: unknown; id: number }) => string;
  fileExistsForMessage: (message: { media?: unknown; id: number }) => boolean;
  recordMessages: (messages: unknown[]) => void;
  exportMetadataJson: () => void;
};

function createInstance(): DownloadChannelInstance {
  return new DownloadChannel() as DownloadChannelInstance;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DownloadChannel", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgdl-dc-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("static methods", () => {
    it("should return a description", () => {
      expect(DownloadChannel.description()).toBe("Download all media from a channel");
    });

    it("should return help text with options", () => {
      const help = DownloadChannel.help();
      expect(help).toContain("Usage:");
      expect(help).toContain("--channelId");
      expect(help).toContain("--startDate");
      expect(help).toContain("--endDate");
      expect(help).toContain("--order");
      expect(help).toContain("--includeComments");
      expect(help).toContain("--channelIds");
    });
  });

  describe("constructor", () => {
    it("should create export directory if it does not exist", () => {
      createInstance();
      expect(fs.existsSync(path.join(tmpDir, "export"))).toBe(true);
    });
  });

  describe("hasMedia", () => {
    it("should return true when message has media", () => {
      const instance = createInstance();
      expect(instance.hasMedia({ media: { photo: {} } })).toBe(true);
    });

    it("should return false when message has no media", () => {
      const instance = createInstance();
      expect(instance.hasMedia({ media: undefined })).toBe(false);
      expect(instance.hasMedia({})).toBe(false);
    });
  });

  describe("isWithinDateRange", () => {
    it("should return true when no date range is set", () => {
      const instance = createInstance();
      instance.dateRange = {};
      expect(instance.isWithinDateRange({ date: 1700000000 })).toBe(true);
    });

    it("should return true when message is within range", () => {
      const instance = createInstance();
      instance.dateRange = {
        startDate: 1700000000,
        endDate: 1700100000,
      };
      expect(instance.isWithinDateRange({ date: 1700050000 })).toBe(true);
    });

    it("should return false when message is before start date", () => {
      const instance = createInstance();
      instance.dateRange = {
        startDate: 1700000000,
        endDate: 1700100000,
      };
      expect(instance.isWithinDateRange({ date: 1699990000 })).toBe(false);
    });

    it("should return false when message is after end date", () => {
      const instance = createInstance();
      instance.dateRange = {
        startDate: 1700000000,
        endDate: 1700100000,
      };
      expect(instance.isWithinDateRange({ date: 1700200000 })).toBe(false);
    });

    it("should check only start date when end date is not set", () => {
      const instance = createInstance();
      instance.dateRange = { startDate: 1700000000 };
      expect(instance.isWithinDateRange({ date: 1700050000 })).toBe(true);
      expect(instance.isWithinDateRange({ date: 1699990000 })).toBe(false);
    });

    it("should check only end date when start date is not set", () => {
      const instance = createInstance();
      instance.dateRange = { endDate: 1700100000 };
      expect(instance.isWithinDateRange({ date: 1700050000 })).toBe(true);
      expect(instance.isWithinDateRange({ date: 1700200000 })).toBe(false);
    });
  });

  describe("canDownload", () => {
    it("should return false when message has no media", () => {
      const instance = createInstance();
      instance.outputFolder = tmpDir;
      instance.downloadableFiles = { all: true };
      expect(instance.canDownload({ media: undefined, id: 1, date: 1700000000 })).toBe(false);
    });

    it("should return false when outputFolder is not set", () => {
      const instance = createInstance();
      instance.outputFolder = null;
      instance.downloadableFiles = { all: true };
      expect(instance.canDownload({ media: { photo: {} }, id: 1, date: 1700000000 })).toBe(false);
    });

    it("should return false when downloadableFiles is not set", () => {
      const instance = createInstance();
      instance.outputFolder = tmpDir;
      instance.downloadableFiles = null;
      expect(instance.canDownload({ media: { photo: {} }, id: 1, date: 1700000000 })).toBe(false);
    });
  });

  describe("recordMessages", () => {
    it("should do nothing when outputFolder is null", () => {
      const instance = createInstance();
      instance.outputFolder = null;
      // Should not throw
      instance.recordMessages([]);
    });

    it("should create all_message.json in the output folder", () => {
      const instance = createInstance();
      const outputFolder = path.join(tmpDir, "export", "test-channel");
      fs.mkdirSync(outputFolder, { recursive: true });
      instance.outputFolder = outputFolder;

      // recordMessages with empty array should still create the file
      instance.recordMessages([]);

      const jsonPath = path.join(outputFolder, "all_message.json");
      expect(fs.existsSync(jsonPath)).toBe(true);
    });
  });

  describe("exportMetadataJson", () => {
    it("should do nothing when outputFolder is null", () => {
      const instance = createInstance();
      instance.outputFolder = null;
      // Should not throw
      instance.exportMetadataJson();
    });

    it("should do nothing when all_message.json does not exist", () => {
      const instance = createInstance();
      instance.outputFolder = path.join(tmpDir, "nonexistent");
      // Should not throw
      instance.exportMetadataJson();
    });

    it("should create metadata.json from all_message.json", () => {
      const instance = createInstance();
      const outputFolder = path.join(tmpDir, "export", "meta-test");
      fs.mkdirSync(outputFolder, { recursive: true });
      instance.outputFolder = outputFolder;

      const messages = [
        {
          id: 2,
          message: "Second",
          date: 1700000200,
          out: false,
          hasMedia: true,
          mediaType: "image",
          mediaName: "2_photo.jpg",
          mediaPath: "/path/to/2_photo.jpg",
        },
        {
          id: 1,
          message: "First",
          date: 1700000100,
          out: false,
          hasMedia: false,
        },
        {
          id: 3,
          message: "Third",
          date: 1700000300,
          out: true,
          hasMedia: true,
          mediaType: "video",
          mediaName: "3_video.mp4",
          mediaPath: "/path/to/3_video.mp4",
        },
      ];

      fs.writeFileSync(path.join(outputFolder, "all_message.json"), JSON.stringify(messages));

      instance.exportMetadataJson();

      const metadataPath = path.join(outputFolder, "metadata.json");
      expect(fs.existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      // Only messages with media should be included
      expect(metadata).toHaveLength(2);
      // Should be sorted by messageId
      expect(metadata[0].messageId).toBe(2);
      expect(metadata[1].messageId).toBe(3);
      expect(metadata[0].fileName).toBe("2_photo.jpg");
      expect(metadata[1].fileName).toBe("3_video.mp4");
      expect(metadata[0].dateISO).toContain("2023-");
    });
  });
});
