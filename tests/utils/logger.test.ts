import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import logger from "../../src/utils/logger.js";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tableSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    tableSpy = vi.spyOn(console, "table").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it("should log info messages with [i] icon", () => {
    logger.info("Hello world");
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[i]");
    expect(output).toContain("Hello world");
  });

  it("should log warning messages with [!] icon", () => {
    logger.warn("Something is off");
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[!]");
    expect(output).toContain("Something is off");
  });

  it("should log error messages with [x] icon", () => {
    logger.error("Something broke");
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[x]");
    expect(output).toContain("Something broke");
  });

  it("should log success messages with [+] icon", () => {
    logger.success("All done");
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[+]");
    expect(output).toContain("All done");
  });

  it("should include timestamp when showTimestamp is true", () => {
    logger.info("With time", { showTimestamp: true });
    const output = logSpy.mock.calls[0][0] as string;
    // Should contain a time pattern like [HH:MM:SS]
    expect(output).toMatch(/\[\d{1,2}:\d{2}:\d{2}\s?(AM|PM)?\]/i);
  });

  it("should include level label when showLevel is true", () => {
    logger.info("Leveled", { showLevel: true });
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[INFO]");
  });

  it("should omit icon when showIcon is false", () => {
    logger.info("No icon", { showIcon: false });
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).not.toContain("[i]");
    expect(output).toContain("No icon");
  });

  it("should apply ANSI color codes", () => {
    logger.error("Colored");
    const output = logSpy.mock.calls[0][0] as string;
    // Should contain ANSI escape sequences
    expect(output).toContain("\x1b[");
  });

  it("should delegate table to console.table", () => {
    const data = [{ name: "test", value: 1 }];
    logger.table(data);
    expect(tableSpy).toHaveBeenCalledWith(data);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should default to INFO level via log()", () => {
    logger.log("Default level");
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("[i]");
  });
});
