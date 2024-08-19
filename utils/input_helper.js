const inquirer = require("inquirer");
const { MEDIA_TYPES } = require("./helper");

const mobileNumberInput = async () => {
  const question = {
    type: "input",
    name: "phoneNumber",
    message: "Please enter your mobile number with country code (without +):",
    validate: function (input) {
      const regex = /^\d{1,3}\d{9,11}$/;
      if (!regex.test(input)) {
        return "Please enter a valid mobile number with country code (without +).";
      }
      return true; // Input is valid
    },
  };

  const { phoneNumber } = await inquirer.prompt(question);
  return phoneNumber;
};

const optInput = async () => {
  const question = {
    type: "input",
    name: "otp",
    message: "Please enter the 5-digit OTP:",
    validate: function (input) {
      // Regular expression to match a 5-digit numeric OTP
      const regex = /^\d{5}$/;
      if (!regex.test(input)) {
        return "Please enter a valid 5-digit numeric OTP.";
      }
      return true; // Input is valid
    },
  };

  const { otp } = await inquirer.prompt(question);
  return otp;
};

const textInput = async (message = "Please Enter") => {
  const question = {
    type: "input",
    name: "text",
    message: message,
  };
  const { text } = await inquirer.prompt(question);
  return text;
};

const numberInput = async (
  message = "Please enter a number",
  min = -Infinity,
  max = Infinity
) => {
  const question = {
    type: "input",
    name: "number",
    message: message,
    validate: function (input) {
      const number = parseFloat(input);
      if (isNaN(number)) {
        return "Please enter a valid number.";
      }
      if (number > max || number < min) {
        return `Entered number - ${number} is not between ${max} and ${min}.`;
      }

      return true;
    },
  };

  const { number } = await inquirer.prompt(question);
  return parseFloat(number);
};

const booleanInput = async (message = "Please answer with yes or no") => {
  const question = {
    type: "confirm",
    name: "confirm",
    message: message,
  };

  const { confirm } = await inquirer.prompt(question);
  return confirm;
};

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

const multipleChoice = async (
  message = "Please select multiple choices",
  optionsArr,
  defaultOptions = []
) => {
  const question = {
    type: "checkbox",
    name: "input",
    message: message,
    default: defaultOptions,
    choices: optionsArr,
  }
  const { input } = await inquirer.prompt(question);
  return input;
};


const downloadOptionInput = async () => {
  let fileTypeArray = [
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
    'pdf'
  ];
  let fileExtensions = await multipleChoice(
    "Choose file to download",
    fileTypeArray,
    defaultSelected
  );

  if (fileExtensions?.includes("custom")) {
    let customExtensions = await textInput(
      "Enter file extension separated by comma: "
    );
    const customExtensionsArray = customExtensions
      ?.split(",")
      ?.map((e) => e?.trim().replace(".", "")?.toLowerCase());
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
  fileExtensions?.map((e) => {
    filesToDownload[e] = true;
  });

  return filesToDownload;
};

module.exports = {
  textInput,
  optInput,
  mobileNumberInput,
  numberInput,
  booleanInput,
  selectInput,
  multipleChoice,
  downloadOptionInput
};
