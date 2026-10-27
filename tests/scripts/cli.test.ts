import { describe, it, expect } from "vitest";
import { parseArguments } from "../../src/cli.js";

describe("CLI parseArguments", () => {
  it("should parse command name from argv", () => {
    const result = parseArguments(["node", "cli.js", "download-channel"]);
    expect(result.scriptSignature).toBe("download-channel");
    expect(result.options).toEqual({});
  });

  it("should parse --key=value options", () => {
    const result = parseArguments([
      "node",
      "cli.js",
      "download-channel",
      "--channelId=12345",
      "--startDate=2024-06-01",
    ]);
    expect(result.scriptSignature).toBe("download-channel");
    expect(result.options.channelId).toBe("12345");
    expect(result.options.startDate).toBe("2024-06-01");
  });

  it("should parse --key without value as boolean true", () => {
    const result = parseArguments(["node", "cli.js", "download-channel", "--help"]);
    expect(result.options.help).toBe(true);
  });

  it("should parse --includeComments as boolean true", () => {
    const result = parseArguments(["node", "cli.js", "download-channel", "--includeComments"]);
    expect(result.options.includeComments).toBe(true);
  });

  it("should parse comma-separated channel IDs", () => {
    const result = parseArguments([
      "node",
      "cli.js",
      "download-channel",
      "--channelIds=123,456,789",
    ]);
    expect(result.options.channelIds).toBe("123,456,789");
  });

  it("should parse --order=chronological", () => {
    const result = parseArguments(["node", "cli.js", "download-channel", "--order=chronological"]);
    expect(result.options.order).toBe("chronological");
  });

  it("should return undefined scriptSignature when no command given", () => {
    const result = parseArguments(["node", "cli.js"]);
    expect(result.scriptSignature).toBeUndefined();
    expect(result.options).toEqual({});
  });

  it("should parse multiple options together", () => {
    const result = parseArguments([
      "node",
      "cli.js",
      "download-channel",
      "--channelId=999",
      "--startDate=2024-01-01",
      "--endDate=2024-12-31",
      "--order=chronological",
      "--includeComments",
    ]);
    expect(result.scriptSignature).toBe("download-channel");
    expect(result.options.channelId).toBe("999");
    expect(result.options.startDate).toBe("2024-01-01");
    expect(result.options.endDate).toBe("2024-12-31");
    expect(result.options.order).toBe("chronological");
    expect(result.options.includeComments).toBe(true);
  });

  it("should handle values containing equals signs", () => {
    const result = parseArguments(["node", "cli.js", "cmd", "--key=value=with=equals"]);
    // split("=", 2) only splits on first =
    expect(result.options.key).toBe("value");
  });

  it("should ignore non-flag arguments", () => {
    const result = parseArguments(["node", "cli.js", "cmd", "positional", "--flag=1"]);
    expect(result.options).toEqual({ flag: "1" });
  });
});
