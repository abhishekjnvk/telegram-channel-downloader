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
  dryRun: boolean;
  exportFormat: string;
  includeProfilePhoto: boolean;
  dryRunMediaTypes: Record<string, number>;
  dryRunOldest: number | undefined;
  dryRunNewest: number | undefined;
  channelName: string;
  stats: { total: number; downloaded: number; skipped: number; failed: number; totalBytes: number };
  hasMedia: (message: { media?: unknown }) => boolean;
  isWithinDateRange: (message: { date: number }) => boolean;
  getMediaPathForMessage: (message: { media?: unknown; id: number }) => string;
  fileExistsForMessage: (message: { media?: unknown; id: number }) => boolean;
  recordMessages: (messages: unknown[]) => void;
  exportMetadataJson: () => void;
  exportMessagesToText: () => void;
  exportMessagesToMarkdown: () => void;
  printDryRunReport: () => void;
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

  describe("stats tracking", () => {
    it("should initialize with zero stats", () => {
      const instance = createInstance();
      expect(instance.stats.total).toBe(0);
      expect(instance.stats.downloaded).toBe(0);
      expect(instance.stats.skipped).toBe(0);
      expect(instance.stats.failed).toBe(0);
      expect(instance.stats.totalBytes).toBe(0);
    });

    it("should allow stats to be mutated", () => {
      const instance = createInstance();
      instance.stats.downloaded = 5;
      instance.stats.skipped = 3;
      instance.stats.failed = 1;
      instance.stats.totalBytes = 1024000;
      expect(instance.stats.downloaded).toBe(5);
      expect(instance.stats.skipped).toBe(3);
      expect(instance.stats.failed).toBe(1);
      expect(instance.stats.totalBytes).toBe(1024000);
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

  describe("help text includes new options", () => {
    it("should include --dryRun in help", () => {
      const help = DownloadChannel.help();
      expect(help).toContain("--dryRun");
    });

    it("should include --format in help", () => {
      const help = DownloadChannel.help();
      expect(help).toContain("--format");
    });

    it("should include --includeProfilePhoto in help", () => {
      const help = DownloadChannel.help();
      expect(help).toContain("--includeProfilePhoto");
    });

    it("should include --concurrency in help", () => {
      const help = DownloadChannel.help();
      expect(help).toContain("--concurrency");
    });
  });

  describe("dry run defaults", () => {
    it("should default dryRun to false", () => {
      const instance = createInstance();
      expect(instance.dryRun).toBe(false);
    });

    it("should default exportFormat to json", () => {
      const instance = createInstance();
      expect(instance.exportFormat).toBe("json");
    });

    it("should default includeProfilePhoto to false", () => {
      const instance = createInstance();
      expect(instance.includeProfilePhoto).toBe(false);
    });

    it("should initialize dryRunMediaTypes as empty object", () => {
      const instance = createInstance();
      expect(instance.dryRunMediaTypes).toEqual({});
    });

    it("should initialize dryRunOldest and dryRunNewest as undefined", () => {
      const instance = createInstance();
      expect(instance.dryRunOldest).toBeUndefined();
      expect(instance.dryRunNewest).toBeUndefined();
    });
  });

  describe("exportMessagesToText", () => {
    it("should do nothing when outputFolder is null", () => {
      const instance = createInstance();
      instance.outputFolder = null;
      instance.exportMessagesToText();
    });

    it("should do nothing when all_message.json does not exist", () => {
      const instance = createInstance();
      instance.outputFolder = path.join(tmpDir, "nonexistent");
      instance.exportMessagesToText();
    });

    it("should create messages.txt from all_message.json", () => {
      const instance = createInstance();
      const outputFolder = path.join(tmpDir, "export", "txt-test");
      fs.mkdirSync(outputFolder, { recursive: true });
      instance.outputFolder = outputFolder;
      instance.channelName = "Test Channel";

      const messages = [
        {
          id: 1,
          message: "Hello world",
          date: 1717200000,
          out: false,
          sender: "Alice",
          hasMedia: false,
        },
        {
          id: 2,
          message: "Photo post",
          date: 1717200100,
          out: false,
          sender: "Bob",
          hasMedia: true,
          mediaName: "photo.jpg",
        },
      ];

      fs.writeFileSync(path.join(outputFolder, "all_message.json"), JSON.stringify(messages));

      instance.exportMessagesToText();

      const txtPath = path.join(outputFolder, "messages.txt");
      expect(fs.existsSync(txtPath)).toBe(true);

      const content = fs.readFileSync(txtPath, "utf8");
      expect(content).toContain("Test Channel");
      expect(content).toContain("Hello world");
      expect(content).toContain("Photo post");
      expect(content).toContain("photo.jpg");
    });
  });

  describe("exportMessagesToMarkdown", () => {
    it("should do nothing when outputFolder is null", () => {
      const instance = createInstance();
      instance.outputFolder = null;
      instance.exportMessagesToMarkdown();
    });

    it("should create messages.md from all_message.json", () => {
      const instance = createInstance();
      const outputFolder = path.join(tmpDir, "export", "md-test");
      fs.mkdirSync(outputFolder, { recursive: true });
      instance.outputFolder = outputFolder;
      instance.channelName = "MD Test Channel";

      const messages = [
        {
          id: 1,
          message: "Hello **world**",
          date: 1717200000,
          out: false,
          sender: "Alice",
          hasMedia: false,
        },
        {
          id: 2,
          message: "Check this out",
          date: 1717200100,
          out: true,
          sender: undefined,
          hasMedia: true,
          mediaName: "video.mp4",
        },
      ];

      fs.writeFileSync(path.join(outputFolder, "all_message.json"), JSON.stringify(messages));

      instance.exportMessagesToMarkdown();

      const mdPath = path.join(outputFolder, "messages.md");
      expect(fs.existsSync(mdPath)).toBe(true);

      const content = fs.readFileSync(mdPath, "utf8");
      expect(content).toContain("# MD Test Channel");
      expect(content).toContain("**Alice**");
      expect(content).toContain("Hello **world**");
      expect(content).toContain("video.mp4");
    });
  });

  describe("printDryRunReport", () => {
    it("should print report without throwing", () => {
      const instance = createInstance();
      instance.stats.total = 100;
      instance.dryRunMediaTypes = { image: 50, video: 30, document: 20 };
      instance.dryRunOldest = 1717200000;
      instance.dryRunNewest = 1717300000;

      // Should not throw
      instance.printDryRunReport();
    });

    it("should handle empty media types", () => {
      const instance = createInstance();
      instance.stats.total = 0;
      instance.dryRunMediaTypes = {};
      instance.dryRunOldest = undefined;
      instance.dryRunNewest = undefined;

      // Should not throw
      instance.printDryRunReport();
    });
  });
});
