import { describe, it, expect } from "vitest";
import { parseDateOption } from "../../src/utils/input-helper.js";

describe("parseDateOption", () => {
  it("should parse a valid start date (beginning of day UTC)", () => {
    const result = parseDateOption("2024-06-01", false);
    expect(result).toBe(1717200000); // 2024-06-01T00:00:00Z
    expect(new Date(result! * 1000).toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });

  it("should parse a valid end date (end of day UTC)", () => {
    const result = parseDateOption("2024-06-18", true);
    expect(result).toBe(1718755199); // 2024-06-18T23:59:59Z
    expect(new Date(result! * 1000).toISOString()).toBe("2024-06-18T23:59:59.000Z");
  });

  it("should return undefined for undefined input", () => {
    expect(parseDateOption(undefined)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(parseDateOption("")).toBeUndefined();
  });

  it("should return undefined for 'true' (flag without value)", () => {
    expect(parseDateOption("true")).toBeUndefined();
  });

  it("should throw for invalid date format", () => {
    expect(() => parseDateOption("06/01/2024")).toThrow('Invalid date format: "06/01/2024"');
    expect(() => parseDateOption("2024-6-1")).toThrow('Invalid date format: "2024-6-1"');
    expect(() => parseDateOption("not-a-date")).toThrow('Invalid date format: "not-a-date"');
  });

  it("should throw for invalid month", () => {
    expect(() => parseDateOption("2024-13-01")).toThrow('Invalid date format: "2024-13-01"');
  });

  it("should throw for invalid day", () => {
    expect(() => parseDateOption("2024-02-31")).toThrow('Invalid date format: "2024-02-31"');
  });

  it("should handle leap year dates correctly", () => {
    const result = parseDateOption("2024-02-29", false); // 2024 is a leap year
    expect(result).toBeDefined();
    expect(new Date(result! * 1000).toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("should default isEndOfDay to false", () => {
    const result = parseDateOption("2024-01-01");
    expect(new Date(result! * 1000).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("should produce start < end for a valid range", () => {
    const start = parseDateOption("2024-06-01", false);
    const end = parseDateOption("2024-06-18", true);
    expect(start!).toBeLessThan(end!);
  });
});
