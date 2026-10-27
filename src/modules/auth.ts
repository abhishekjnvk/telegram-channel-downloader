import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { updateCredentials, getCredentials } from "../utils/file-helper.js";
import type { Config } from "../types/index.js";
import logger from "../utils/logger.js";
import {
  textInput,
  mobileNumberInput,
  otpInput,
  selectInput,
} from "../utils/input-helper.js";

const OTP_METHOD = {
  SMS: "sms",
  APP: "app",
} as const;

type OtpMethod = (typeof OTP_METHOD)[keyof typeof OTP_METHOD];

// Credentials are loaded lazily inside initAuth() so that importing this
// module (e.g. by the CLI command loader) does not fail when config.json
// is missing.
let cachedCredentials: Config | null = null;
let cachedSessionId = "";
let cachedStringSession: StringSession | null = null;

function loadCredentials(): { credentials: Config; sessionId: string; stringSession: StringSession } {
  if (!cachedCredentials) {
    cachedCredentials = getCredentials();
    cachedSessionId = cachedCredentials.sessionId || "";
    cachedStringSession = new StringSession(cachedSessionId);
  }
  return {
    credentials: cachedCredentials,
    sessionId: cachedSessionId,
    stringSession: cachedStringSession as StringSession,
  };
}

/**
 * Initializes the authentication process for the Telegram client.
 */
export async function initAuth(otpPreference: OtpMethod = OTP_METHOD.APP): Promise<TelegramClient> {
  const { credentials, stringSession } = loadCredentials();
  let { sessionId } = loadCredentials();

  const client = new TelegramClient(stringSession, credentials.apiId, credentials.apiHash, {
    connectionRetries: 5,
  });

  try {
    if (!sessionId) {
      otpPreference = (await selectInput("Where do you want the login OTP:", [
        { name: "Telegram App", value: OTP_METHOD.APP },
        { name: "SMS", value: OTP_METHOD.SMS },
      ])) as OtpMethod;
    }

    const forceSMS = otpPreference === OTP_METHOD.SMS;

    await client.start({
      phoneNumber: async () => await mobileNumberInput(),
      password: async () => await textInput("Enter your password"),
      phoneCode: async (isCodeViaApp) => {
        logger.info(`OTP sent over ${isCodeViaApp ? "APP" : "SMS"}`);
        return await otpInput();
      },
      forceSMS,
      onError: (err) => logger.error(String(err)),
    });

    logger.success("You should now be connected.");

    if (!sessionId) {
      sessionId = client.session.save() as unknown as string;
      cachedSessionId = sessionId;
      updateCredentials({ sessionId });
      logger.info(
        "To avoid logging in again, the session ID has been saved to config.json. " +
          "Please don't share it with anyone."
      );
    }

    return client;
  } catch (err) {
    logger.error("Authentication failed");
    console.error(err);
    throw err;
  }
}
