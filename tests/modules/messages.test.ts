import { describe, it, expect, vi } from "vitest";
import { getMessages, getMessageDetail } from "../../src/modules/messages.js";

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
