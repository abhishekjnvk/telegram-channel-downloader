import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock inquirer before importing modules that use it
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock file-helper to avoid filesystem dependencies
vi.mock("../../src/utils/file-helper.js", () => ({
  updateLastSelection: vi.fn(),
  getLastSelection: vi.fn(() => ({})),
}));

import inquirer from "inquirer";
import type { DialogInfo } from "../../src/types/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDialog(overrides: Partial<DialogInfo> = {}): DialogInfo {
  return {
    name: "Test Channel",
    id: "12345",
    type: "Channel",
    ...overrides,
  };
}

function makeMockClient(dialogs: unknown[]) {
  return {
    getDialogs: vi.fn().mockResolvedValue(dialogs),
  } as never;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const sampleDialogs: DialogInfo[] = [
  makeDialog({ name: "Alpha News", id: "100", type: "Channel" }),
  makeDialog({ name: "Beta Chat", id: "200", type: "Group" }),
  makeDialog({ name: "Gamma Photos", id: "300", type: "Channel" }),
  makeDialog({ name: "Delta Blog", id: "400", type: "Channel" }),
  makeDialog({ name: "Epsilon Dev", id: "500", type: "Group" }),
  makeDialog({ name: "Zeta Sports", id: "600", type: "Channel" }),
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("dialogs", () => {
  let tmpDir: string;
  let originalCwd: string;
  // Dynamically imported so EXPORT_DIR picks up the temp cwd
  let dialogsModule: typeof import("../../src/modules/dialogs.js");

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgdl-dialogs-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(tmpDir, "export"), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
    dialogsModule = await import("../../src/modules/dialogs.js");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getAllDialogs", () => {
    it("should fetch dialogs and return DialogInfo array", async () => {
      const rawDialogs = [
        {
          entity: { username: "alpha", firstName: "Alpha" },
          message: { message: "Hello", date: 1700000000 },
          title: "Alpha News",
          id: { toString: () => "100" },
          isChannel: true,
        },
      ];
      const client = makeMockClient(rawDialogs);

      const result = await dialogsModule.getAllDialogs(client);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alpha News");
      expect(result[0].id).toBe("100");
      expect(result[0].type).toBe("Channel");
    });

    it("should sort dialogs by name when sortByName is true", async () => {
      const rawDialogs = [
        { title: "Zeta", id: { toString: () => "1" }, isChannel: true },
        { title: "Alpha", id: { toString: () => "2" }, isChannel: true },
        { title: "Mu", id: { toString: () => "3" }, isChannel: true },
      ];
      const client = makeMockClient(rawDialogs);

      const result = await dialogsModule.getAllDialogs(client, true);

      expect(result.map((d) => d.name)).toEqual(["Alpha", "Mu", "Zeta"]);
    });

    it("should not sort when sortByName is false", async () => {
      const rawDialogs = [
        { title: "Zeta", id: { toString: () => "1" }, isChannel: true },
        { title: "Alpha", id: { toString: () => "2" }, isChannel: true },
      ];
      const client = makeMockClient(rawDialogs);

      const result = await dialogsModule.getAllDialogs(client, false);

      expect(result.map((d) => d.name)).toEqual(["Zeta", "Alpha"]);
    });

    it("should write dialog_list.json to export directory", async () => {
      const rawDialogs = [{ title: "Test", id: { toString: () => "1" }, isChannel: true }];
      const client = makeMockClient(rawDialogs);

      await dialogsModule.getAllDialogs(client);

      const jsonPath = path.join(tmpDir, "export", "dialog_list.json");
      expect(fs.existsSync(jsonPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      expect(data[0].name).toBe("Test");
    });

    it("should throw when client.getDialogs fails", async () => {
      const client = {
        getDialogs: vi.fn().mockRejectedValue(new Error("Connection failed")),
      } as never;

      await expect(dialogsModule.getAllDialogs(client)).rejects.toThrow("Connection failed");
    });
  });

  describe("getDialogName", () => {
    it("should return name from cached dialog_list.json", async () => {
      const dialogs = [{ name: "Cached Channel", id: "999", type: "Channel" as const }];
      fs.writeFileSync(path.join(tmpDir, "export", "dialog_list.json"), JSON.stringify(dialogs));

      const client = makeMockClient([]);
      const name = await dialogsModule.getDialogName(client, "999");

      expect(name).toBe("Cached Channel");
    });

    it("should return null if dialog not found in cache", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "export", "dialog_list.json"),
        JSON.stringify([{ name: "Other", id: "1", type: "Channel" }])
      );

      const client = makeMockClient([]);
      const name = await dialogsModule.getDialogName(client, "999");

      expect(name).toBeNull();
    });

    it("should fetch dialogs if cache file does not exist", async () => {
      // Ensure no cache file exists
      const cachePath = path.join(tmpDir, "export", "dialog_list.json");
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

      const rawDialogs = [
        { title: "Fresh Channel", id: { toString: () => "777" }, isChannel: true },
      ];
      const client = makeMockClient(rawDialogs);

      const name = await dialogsModule.getDialogName(client, "777");

      expect(name).toBe("Fresh Channel");
    });

    it("should return null on error", async () => {
      const client = {
        getDialogs: vi.fn().mockRejectedValue(new Error("Boom")),
      } as never;

      const name = await dialogsModule.getDialogName(client, "123");
      expect(name).toBeNull();
    });
  });

  describe("selectChannel", () => {
    it("should throw if dialogs list is empty", async () => {
      await expect(dialogsModule.selectChannel([])).rejects.toThrow("No dialogs/channels found");
    });

    it("should use selectInput directly for small lists (<=5)", async () => {
      const smallList = sampleDialogs.slice(0, 3);
      vi.mocked(inquirer.prompt).mockResolvedValue({ input: "100" });

      const result = await dialogsModule.selectChannel(smallList);

      expect(result).toBe("100");
      expect(inquirer.prompt).toHaveBeenCalledOnce();
    });

    it("should offer search for large lists (>5)", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ confirm: true }) // booleanInput
        .mockResolvedValueOnce({ text: "Alpha" }) // textInput
        .mockResolvedValueOnce({ input: "100" }); // selectInput

      const result = await dialogsModule.selectChannel(sampleDialogs);

      expect(result).toBe("100");
      expect(inquirer.prompt).toHaveBeenCalledTimes(3);
    });

    it("should browse all when user declines search", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ confirm: false }) // booleanInput — no search
        .mockResolvedValueOnce({ input: "300" }); // selectInput

      const result = await dialogsModule.selectChannel(sampleDialogs);

      expect(result).toBe("300");
    });

    it("should retry with full list when search returns no results", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ confirm: true }) // search? yes
        .mockResolvedValueOnce({ text: "nonexistent" }) // search text
        .mockResolvedValueOnce({ confirm: true }) // retry: search? yes again
        .mockResolvedValueOnce({ text: "Alpha" }) // search text
        .mockResolvedValueOnce({ input: "100" }); // select

      const result = await dialogsModule.selectChannel(sampleDialogs);

      expect(result).toBe("100");
    });
  });

  describe("userDialogSelection", () => {
    it("should return the selected dialog id", async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ number: "2" });

      const result = await dialogsModule.userDialogSelection(sampleDialogs);

      expect(result).toBe("200"); // Beta Chat
    });

    it("should throw on invalid selection", async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ number: "999" });

      await expect(dialogsModule.userDialogSelection(sampleDialogs)).rejects.toThrow(
        "Invalid dialog selection"
      );
    });
  });

  describe("selectDialog", () => {
    it("should list dialogs and return selection", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(inquirer.prompt).mockResolvedValue({ number: "1" });

      const result = await dialogsModule.selectDialog(sampleDialogs);

      expect(result).toBe("100");
    });
  });

  describe("searchDialog", () => {
    it("should return selection when user confirms found", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ text: "Alpha" }) // search text
        .mockResolvedValueOnce({ confirm: true }) // found?
        .mockResolvedValueOnce({ number: "1" }); // selection

      const result = await dialogsModule.searchDialog(sampleDialogs);

      expect(result).toBe("100");
    });
  });
});
