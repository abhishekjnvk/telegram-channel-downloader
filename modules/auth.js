const { TelegramClient } = require("telegram");
const { updateCredentials, getCredentials } = require("../utils/file-helper");
const { StringSession } = require("telegram/sessions");
const { logMessage } = require("../utils/helper");

const {
  textInput,
  mobileNumberInput,
  otpInput,
  selectInput,
} = require("../utils/input-helper");

const OTP_METHOD = {
  SMS: "sms",
  APP: "app",
};

let { apiHash, apiId, sessionId } = getCredentials();
const stringSession = new StringSession(sessionId || "");

/**
 * Initializes the authentication process for the Telegram client.
 * @param {string} [otpPreference=OTP_METHOD.APP] - The preferred method for receiving the OTP (either 'app' or 'sms').
 * @returns {Promise<TelegramClient>} - The authenticated Telegram client.
 */
const initAuth = async (otpPreference = OTP_METHOD.APP) => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    if (!sessionId) {
      otpPreference = await selectInput("Where do you want the login OTP:", [
        OTP_METHOD.APP,
        OTP_METHOD.SMS,
      ]);
    }

    const forceSMS = otpPreference === OTP_METHOD.SMS;

    await client.start({
      phoneNumber: async () => await mobileNumberInput(),
      password: async () => await textInput("Enter your password"),
      phoneCode: async (isCodeViaApp) => {
        logMessage.info(`OTP sent over ${isCodeViaApp ? "APP" : "SMS"}`);

        return await otpInput();
      },
      forceSMS,
      onError: (err) => logMessage.error(err),
    });

    logMessage.success("You should now be connected.");

    if (!sessionId) {
      sessionId = client.session.save();
      updateCredentials({ sessionId });
      logMessage.info(
        "To avoid logging in again and again, the session ID has been saved to config.json. Please don't share it with anyone."
      );
    }
  
    return client;
  } catch (err) {
    logMessage.error(err);

    throw err;
  }
};

module.exports = {
  initAuth,
};
