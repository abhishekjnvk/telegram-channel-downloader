import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getMessages,
  getMessageDetail,
  downloadProfilePhoto,
  getChannelInfo,
} from "../../src/modules/messages.js";

// ─── Mock Telegram Client ────────────────────────────────────────────────────

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    getMessages: vi.fn(),
    downloadMedia: vi.fn(),
    ...overrides,
  };
}

// ─── getMessages ─────────────────────────────────────────────────────────────

describe("getMessages", () => {
  it("should throw if client is missing", async () => {
    await expect(getMessages(null as never, "123")).rejects.toThrow(
      "Client and channelId are required"
    );
  });

  it("should throw if channelId is missing", async () => {
    const client = createMockClient();
    await expect(getMessages(client as never, "")).rejects.toThrow(
      "Client and channelId are required"
    );
  });

  it("should return messages on success", async () => {
    const mockMessages = [{ id: 1 }, { id: 2 }];
    const client = createMockClient({
      getMessages: vi.fn().mockResolvedValue(mockMessages),
    });
    const result = await getMessages(client as never, "12345", 10, 0);
    expect(result).toEqual(mockMessages);
    expect(client.getMessages).toHaveBeenCalledWith("12345", { limit: 10, offsetId: 0 });
  });

  it("should throw helpful error for CHANNEL_PRIVATE", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockRejectedValue({
        errorMessage: "CHANNEL_PRIVATE",
        message: "400: CHANNEL_PRIVATE (caused by messages.GetHistory)",
      }),
    });
    await expect(getMessages(client as never, "12345")).rejects.toThrow(
      "Access denied: This is a private channel"
    );
  });

  it("should throw helpful error for USERNAME_INVALID", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockRejectedValue({
        errorMessage: "USERNAME_INVALID",
        message: "400: USERNAME_INVALID",
      }),
    });
    await expect(getMessages(client as never, "badname")).rejects.toThrow(
      "Invalid channel. The channel username or ID is not valid"
    );
  });

  it("should throw helpful error for CHANNEL_INVALID", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockRejectedValue({
        errorMessage: "CHANNEL_INVALID",
        message: "400: CHANNEL_INVALID",
      }),
    });
    await expect(getMessages(client as never, "99999")).rejects.toThrow(
      "Invalid channel. The channel ID is not valid"
    );
  });

  it("should throw generic error for unknown errors", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockRejectedValue(new Error("Some unknown error")),
    });
    await expect(getMessages(client as never, "12345")).rejects.toThrow(
      "Failed to get messages: Some unknown error"
    );
  });

  it("should pass limit and offsetId to client", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockResolvedValue([]),
    });
    await getMessages(client as never, "12345", 50, 100);
    expect(client.getMessages).toHaveBeenCalledWith("12345", { limit: 50, offsetId: 100 });
  });
});

// ─── getMessageDetail ────────────────────────────────────────────────────────

describe("getMessageDetail", () => {
  it("should throw if any parameter is missing", async () => {
    const client = createMockClient();
    await expect(getMessageDetail(null as never, "123", [1])).rejects.toThrow(
      "Client, channelId, and messageIds are required"
    );
    await expect(getMessageDetail(client as never, "", [1])).rejects.toThrow(
      "Client, channelId, and messageIds are required"
    );
    await expect(getMessageDetail(client as never, "123", [])).rejects.toThrow(
      "Client, channelId, and messageIds are required"
    );
  });

  it("should return message details on success", async () => {
    const mockMessages = [{ id: 1, message: "hello" }];
    const client = createMockClient({
      getMessages: vi.fn().mockResolvedValue(mockMessages),
    });
    const result = await getMessageDetail(client as never, "12345", [1, 2]);
    expect(result).toEqual(mockMessages);
    expect(client.getMessages).toHaveBeenCalledWith("12345", { ids: [1, 2] });
  });

  it("should throw helpful error for CHANNEL_PRIVATE", async () => {
    const client = createMockClient({
      getMessages: vi.fn().mockRejectedValue({
        errorMessage: "CHANNEL_PRIVATE",
        message: "400: CHANNEL_PRIVATE",
      }),
    });
    await expect(getMessageDetail(client as never, "12345", [1])).rejects.toThrow(
      "Access denied: This is a private channel"
    );
  });
});

// ─── downloadProfilePhoto ────────────────────────────────────────────────────

describe("downloadProfilePhoto", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tgdl-pp-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create output directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "folder");
    const client = createMockClient({
      downloadProfilePhoto: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    });
    await downloadProfilePhoto(client as never, "12345", nestedDir);
    expect(fs.existsSync(nestedDir)).toBe(true);
  });

  it("should skip if photo already exists", async () => {
    const photoPath = path.join(tmpDir, "profile_photo.jpg");
    fs.writeFileSync(photoPath, "existing");
    const client = createMockClient({
      downloadProfilePhoto: vi.fn(),
    });
    const result = await downloadProfilePhoto(client as never, "12345", tmpDir);
    expect(result).toBe(photoPath);
    expect(client.downloadProfilePhoto).not.toHaveBeenCalled();
  });

  it("should return path on successful download", async () => {
    const client = createMockClient({
      downloadProfilePhoto: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    });
    const result = await downloadProfilePhoto(client as never, "12345", tmpDir);
    expect(result).toBe(path.join(tmpDir, "profile_photo.jpg"));
    expect(client.downloadProfilePhoto).toHaveBeenCalledWith("12345", {
      outputFile: path.join(tmpDir, "profile_photo.jpg"),
    });
  });

  it("should return null if no photo is returned", async () => {
    const client = createMockClient({
      downloadProfilePhoto: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    });
    const result = await downloadProfilePhoto(client as never, "12345", tmpDir);
    expect(result).toBeNull();
  });

  it("should return null on error", async () => {
    const client = createMockClient({
      downloadProfilePhoto: vi.fn().mockRejectedValue(new Error("No photo")),
    });
    const result = await downloadProfilePhoto(client as never, "12345", tmpDir);
    expect(result).toBeNull();
  });
});

// ─── getChannelInfo ──────────────────────────────────────────────────────────

describe("getChannelInfo", () => {
  it("should return channel info on success", async () => {
    const client = createMockClient({
      getEntity: vi.fn().mockResolvedValue({
        id: { toString: () => "12345" },
        title: "Test Channel",
        username: "testchannel",
        about: "A test channel",
        isChannel: true,
        participantsCount: 5000,
        date: 1600000000,
      }),
    });
    const result = await getChannelInfo(client as never, "12345");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("12345");
    expect(result?.title).toBe("Test Channel");
    expect(result?.username).toBe("testchannel");
    expect(result?.description).toBe("A test channel");
    expect(result?.type).toBe("Channel");
    expect(result?.participantsCount).toBe(5000);
    expect(result?.createdDate).toBe(1600000000);
  });

  it("should identify groups", async () => {
    const client = createMockClient({
      getEntity: vi.fn().mockResolvedValue({
        id: { toString: () => "999" },
        title: "Test Group",
        isGroup: true,
      }),
    });
    const result = await getChannelInfo(client as never, "999");
    expect(result?.type).toBe("Group");
  });

  it("should identify users", async () => {
    const client = createMockClient({
      getEntity: vi.fn().mockResolvedValue({
        id: { toString: () => "111" },
        title: "John Doe",
        isUser: true,
      }),
    });
    const result = await getChannelInfo(client as never, "111");
    expect(result?.type).toBe("User");
  });

  it("should handle entity with missing fields", async () => {
    const client = createMockClient({
      getEntity: vi.fn().mockResolvedValue({
        id: { toString: () => "42" },
      }),
    });
    const result = await getChannelInfo(client as never, "42");
    expect(result?.title).toBe("Unknown");
    expect(result?.type).toBe("Unknown");
  });

  it("should return null on error", async () => {
    const client = createMockClient({
      getEntity: vi.fn().mockRejectedValue(new Error("Not found")),
    });
    const result = await getChannelInfo(client as never, "99999");
    expect(result).toBeNull();
  });
});
