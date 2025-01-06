const inquirer = require("inquirer");
const { MEDIA_TYPES } = require("./helper");

/**
 * Prompts the user to enter their mobile number with country code.
 * @returns {Promise<string>} The entered mobile number.
 */
const mobileNumberInput = async () => {
  const question = {
    type: "input",
    name: "phoneNumber",
    message: "Please enter your mobile number with country code (without +):",
    validate: (input) => {
      const regex = /^\d{1,3}\d{9,11}$/;
      return regex.test(input) ? true : "Please enter a valid mobile number with country code (without +).";
    },
  };

  const { phoneNumber } = await inquirer.prompt(question);
  return phoneNumber;
};

/**
 * Prompts the user to enter a 5-digit OTP.
 * @returns {Promise<string>} The entered OTP.
 */
const otpInput = async () => {
  const question = {
    type: "input",
    name: "otp",
    message: "Please enter the 5-digit OTP:",
    validate: (input) => {
      const regex = /^\d{5}$/;
      return regex.test(input) ? true : "Please enter a valid 5-digit numeric OTP.";
    },
  };

  const { otp } = await inquirer.prompt(question);
  return otp;
};

/**
 * Prompts the user to enter a text input.
 * @param {string} [message="Please Enter"] - The message to display.
 * @returns {Promise<string>} The entered text.
 */
const textInput = async (message = "Please Enter") => {
  const question = {
    type: "input",
    name: "text",
    message: message,
  };

  const { text } = await inquirer.prompt(question);
  return text;
};

/**
 * Prompts the user to enter a number within a specified range.
 * @param {string} [message="Please enter a number"] - The message to display.
 * @param {number} [min=-Infinity] - The minimum value.
 * @param {number} [max=Infinity] - The maximum value.
 * @returns {Promise<number>} The entered number.
 */
const numberInput = async (message = "Please enter a number", min = -Infinity, max = Infinity) => {
  const question = {
    type: "input",
    name: "number",
    message: message,
    validate: (input) => {
      const number = parseFloat(input);
      if (isNaN(number)) {
        return "Please enter a valid number.";
      }
      if (number > max || number < min) {
        return `Entered number - ${number} is not between ${min} and ${max}.`;
      }
      return true;
    },
  };

  const { number } = await inquirer.prompt(question);
  return parseFloat(number);
};

/**
 * Prompts the user to answer with yes or no.
 * @param {string} [message="Please answer with yes or no"] - The message to display.
 * @returns {Promise<boolean>} The user's response.
 */
const booleanInput = async (message = "Please answer with yes or no") => {
  const question = {
    type: "confirm",
    name: "confirm",
    message: message,
  };

  const { confirm } = await inquirer.prompt(question);
  return confirm;
};

/**
 * Prompts the user to select an option from a list.
 * @param {string} [message="Please select"] - The message to display.
 * @param {Array<string>} [optionsArr=[]] - The list of options.
 * @returns {Promise<string>} The selected option.
 */
const selectInput = async (message = "Please select", optionsArr = []) => {
  const question = {
    type: "list",
    name: "input",
    message: message,
    choices: optionsArr,
  };

  const { input } = await inquirer.prompt(question);
  return input;
};

/**
 * Prompts the user to select multiple choices from a list.
 * @param {string} [message="Please select multiple choices"] - The message to display.
 * @param {Array<string>} optionsArr - The list of options.
 * @param {Array<string>} [defaultOptions=[]] - The default selected options.
 * @returns {Promise<Array<string>>} The selected options.
 */
const multipleChoice = async (message = "Please select multiple choices", optionsArr, defaultOptions = []) => {
  const question = {
    type: "checkbox",
    name: "input",
    message: message,
    default: defaultOptions,
    choices: optionsArr,
  };

  const { input } = await inquirer.prompt(question);
  return input;
};

/**
 * Prompts the user to select file types to download and handles custom file extensions.
 * @returns {Promise<Object>} The selected file types to download.
 */
const downloadOptionInput = async () => {
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

  let fileExtensions = await multipleChoice("Choose file to download", fileTypeArray, defaultSelected);

  if (fileExtensions.includes("custom")) {
    const customExtensions = await textInput("Enter file extension separated by comma: ");
    const customExtensionsArray = customExtensions.split(",").map((e) => e.trim().replace(".", "").toLowerCase());
    fileExtensions = [...fileExtensions, ...customExtensionsArray];
  }

  const filesToDownload = {
    [MEDIA_TYPES.WEBPAGE]: true,
    [MEDIA_TYPES.POLL]: true,
    [MEDIA_TYPES.GEO]: true,
    [MEDIA_TYPES.CONTACT]: true,
    [MEDIA_TYPES.VENUE]: true,
    [MEDIA_TYPES.STICKER]: true,
  };

  fileExtensions.forEach((e) => {
    filesToDownload[e] = true;
  });


  return filesToDownload;
};

module.exports = {
  textInput,
  otpInput,
  mobileNumberInput,
  numberInput,
  booleanInput,
  selectInput,
  multipleChoice,
  downloadOptionInput,
};

