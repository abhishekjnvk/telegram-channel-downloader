import inquirer from "inquirer";
import { MEDIA_TYPES } from "./helper.js";
import type { DownloadableFiles, DateRange, DownloadOrder } from "../types/index.js";

// ─── Input Prompts ───────────────────────────────────────────────────────────

export async function mobileNumberInput(): Promise<string> {
  const question = {
    type: "input" as const,
    name: "phoneNumber",
    message: "Please enter your mobile number with country code (without +):",
    validate: (input: string): boolean | string => {
      const regex = /^\d{1,3}\d{9,11}$/;
      return regex.test(input)
        ? true
        : "Please enter a valid mobile number with country code (without +).";
    },
  };

  const { phoneNumber } = await inquirer.prompt<{ phoneNumber: string }>(question);
  return phoneNumber;
}

export async function otpInput(): Promise<string> {
  const question = {
    type: "input" as const,
    name: "otp",
    message: "Please enter the 5-digit OTP:",
    validate: (input: string): boolean | string => {
      const regex = /^\d{5}$/;
      return regex.test(input) ? true : "Please enter a valid 5-digit numeric OTP.";
    },
  };

  const { otp } = await inquirer.prompt<{ otp: string }>(question);
  return otp;
}

export async function textInput(message = "Please Enter"): Promise<string> {
  const question = {
    type: "input" as const,
    name: "text",
    message,
  };

  const { text } = await inquirer.prompt<{ text: string }>(question);
  return text;
}

export async function numberInput(
  message = "Please enter a number",
  min = -Infinity,
  max = Infinity
): Promise<number> {
  const question = {
    type: "input" as const,
    name: "number",
    message,
    validate: (input: string): boolean | string => {
      const num = parseFloat(input);
      if (isNaN(num)) {
        return "Please enter a valid number.";
      }
      if (num > max || num < min) {
        return `Entered number - ${num} is not between ${min} and ${max}.`;
      }
      return true;
    },
  };

  const { number } = await inquirer.prompt<{ number: string }>(question);
  return parseFloat(number);
}

export async function booleanInput(message = "Please answer with yes or no"): Promise<boolean> {
  const question = {
    type: "confirm" as const,
    name: "confirm",
    message,
  };

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>(question);
  return confirm;
}

export async function selectInput<T = string>(
  message = "Please select",
  optionsArr: Array<{ name: string; value: T } | string> = []
): Promise<T | string> {
  const question = {
    type: "list" as const,
    name: "input",
    message,
    choices: optionsArr,
  };

  const { input } = await inquirer.prompt<{ input: T | string }>(question);
  return input;
}

export async function multipleChoice(
  optionsArr: string[],
  message = "Please select multiple choices",
  defaultOptions: string[] = []
): Promise<string[]> {
  const question = {
    type: "checkbox" as const,
    name: "input",
    message,
    default: defaultOptions,
    choices: optionsArr,
  };

  const { input } = await inquirer.prompt<{ input: string[] }>(question);
  return input;
}

// ─── Date Range ──────────────────────────────────────────────────────────────

/**
 * Validates a date string in YYYY-MM-DD format.
 */
function isValidDateString(input: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(input)) return false;
  const date = new Date(input + "T00:00:00Z");
  if (isNaN(date.getTime())) return false;
  // Verify date components match input to reject rolled-over dates (e.g. Feb 31 → Mar 2)
  const [y, m, d] = input.split("-").map(Number);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Prompts the user for an optional date range (start and end dates).
 * Returns Unix timestamps in seconds, or undefined if skipped.
 */
export async function dateRangeInput(): Promise<DateRange> {
  const useDateRange = await booleanInput("Do you want to filter by date range?");
  if (!useDateRange) return {};

  const startDateStr = await textInput(
    "Enter start date (YYYY-MM-DD, leave empty for no start limit):"
  );
  const endDateStr = await textInput("Enter end date (YYYY-MM-DD, leave empty for no end limit):");

  const range: DateRange = {};

  if (startDateStr.trim()) {
    if (!isValidDateString(startDateStr.trim())) {
      throw new Error(`Invalid start date format: "${startDateStr}". Use YYYY-MM-DD.`);
    }
    // Start of day UTC
    range.startDate = Math.floor(new Date(startDateStr.trim() + "T00:00:00Z").getTime() / 1000);
  }

  if (endDateStr.trim()) {
    if (!isValidDateString(endDateStr.trim())) {
      throw new Error(`Invalid end date format: "${endDateStr}". Use YYYY-MM-DD.`);
    }
    // End of day UTC (23:59:59)
    range.endDate = Math.floor(new Date(endDateStr.trim() + "T23:59:59Z").getTime() / 1000);
  }

  if (range.startDate && range.endDate && range.startDate > range.endDate) {
    throw new Error("Start date must be before end date.");
  }

  return range;
}

/**
 * Parses a date string (YYYY-MM-DD) from CLI options into a Unix timestamp (seconds).
 * Returns undefined if the input is empty or invalid.
 */
export function parseDateOption(
  dateStr: string | undefined,
  isEndOfDay = false
): number | undefined {
  if (!dateStr || dateStr === "true") return undefined;
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Use YYYY-MM-DD.`);
  }
  const time = isEndOfDay ? "T23:59:59Z" : "T00:00:00Z";
  return Math.floor(new Date(dateStr + time).getTime() / 1000);
}

// ─── Download Order ──────────────────────────────────────────────────────────

/**
 * Prompts the user to choose download order.
 * Option to save files in chronological (chat) order.
 */
export async function orderInput(): Promise<DownloadOrder> {
  const choice = await selectInput("How should files be organized?", [
    { name: "By type (images/, videos/, documents/, ...)", value: "byType" as DownloadOrder },
    {
      name: "Chronological (in chat order, with metadata)",
      value: "chronological" as DownloadOrder,
    },
  ]);
  return choice as DownloadOrder;
}

// ─── Download Options ────────────────────────────────────────────────────────

export async function downloadOptionInput(): Promise<DownloadableFiles> {
  const fileTypeArray = [
    MEDIA_TYPES.IMAGE,
    MEDIA_TYPES.VIDEO,
    MEDIA_TYPES.AUDIO,
    "pdf",
    "zip",
    "custom",
    "All",
  ];

  const defaultSelected = [MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO, "pdf"];

  let fileExtensions = await multipleChoice(
    fileTypeArray,
    "Choose file to download",
    defaultSelected
  );

  if (fileExtensions.includes("custom")) {
    const customExtensions = await textInput("Enter file extension separated by comma: ");
    const customExtensionsArray = customExtensions
      .split(",")
      .map((e) => e.trim().replace(".", "").toLowerCase());
    fileExtensions = [...fileExtensions, ...customExtensionsArray];
  }

  const filesToDownload: DownloadableFiles = {
    [MEDIA_TYPES.WEBPAGE]: true,
    [MEDIA_TYPES.POLL]: true,
    [MEDIA_TYPES.GEO]: true,
    [MEDIA_TYPES.CONTACT]: true,
    [MEDIA_TYPES.VENUE]: true,
    [MEDIA_TYPES.STICKER]: true,
  };

  for (const ext of fileExtensions) {
    filesToDownload[ext] = true;
  }

  return filesToDownload;
}
