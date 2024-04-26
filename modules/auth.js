const { TelegramClient } = require("telegram");
const { updateCredentials, getCredentials } = require("../utils/file_helper");

const { StringSession } = require("telegram/sessions");
const { logMessage } = require("../utils/helper");

let { apiHash, apiId, sessionId, otpPreference } = getCredentials();
const stringSession = new StringSession(sessionId || "");

const initAuth = async () => {
  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    const OTP_METHOD = {
      SMS: "sms",
      APP: "app",
    };

    if (!otpPreference) {
      otpPreference = readline.question(
        "Where do you want the login OTP (app/SMS)?: ",
        {
          limit: [OTP_METHOD.APP, OTP_METHOD.SMS],
          limitMessage: `Invalid option, Please choose either 'app' or 'sms'`,
          defaultInput: OTP_METHOD.APP,
        }
      );
      updateCredentials({ otpPreference });
    }

    const forceSMS = otpPreference == OTP_METHOD.SMS ? true : false;

    await client.start({
      phoneNumber: async () =>
        await readline.question("Please enter your number: "),
      password: async () =>
        await readline.question("Please enter your password: "),
      phoneCode: async (isCodeViaApp) => {
        logMessage.info(`OTP sent over ${isCodeViaApp ? "APP" : "SMS"}`);
        return await readline.question("Please enter the code you received: ");
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
