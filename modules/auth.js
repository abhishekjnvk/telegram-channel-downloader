const inquirer = require("inquirer");

const { TelegramClient } = require("telegram");
const { updateCredentials, getCredentials } = require("../utils/file_helper");

const { StringSession } = require("telegram/sessions");
const { logMessage } = require("../utils/helper");
const {
  textInput,
  mobileNumberInput,
  optInput,
  selectInput,
} = require("../utils/input_helper");

let { apiHash, apiId, sessionId } = getCredentials();
const stringSession = new StringSession(sessionId || "");
const OTP_METHOD = {
  SMS: "sms",
  APP: "app",
};

const initAuth = async (otpPreference = OTP_METHOD.APP) => {
  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    if (!sessionId) {
      otpPreference = await selectInput("Where do you want the login OTP:", [
        OTP_METHOD.APP,
        OTP_METHOD.SMS,
      ]);
    }

    const forceSMS = otpPreference == OTP_METHOD.SMS ? true : false;
    await client.start({
      phoneNumber: async () => await mobileNumberInput(),
      password: async () => await textInput("Enter your password"),
      phoneCode: async (isCodeViaApp) => {
        logMessage.info(`OTP sent over ${isCodeViaApp ? "APP" : "SMS"}`);
        return await optInput();
      },

      forceSMS,
      onError: (err) => logMessage.error(err),
    });

    logMessage.success("You should now be connected.");
    if (!sessionId) {
      sessionId = client.session.save();
      updateCredentials({ sessionId });
      logMessage.info(
        `To avoid login again and again session id has been saved to config.json, please don't share it with anyone`
      );
    }

    return client;
  } catch (err) {
    logMessage.error(err);
  }
};

module.exports = {
  initAuth,
};
