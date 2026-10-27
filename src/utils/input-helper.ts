import inquirer from "inquirer";
import { MEDIA_TYPES } from "./helper.js";
import type { DownloadableFiles } from "../types/index.js";

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

  const defaultSelected = [
    MEDIA_TYPES.IMAGE,
    MEDIA_TYPES.VIDEO,
    MEDIA_TYPES.AUDIO,
    "pdf",
  ];

  let fileExtensions = await multipleChoice(fileTypeArray, "Choose file to download", defaultSelected);

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
