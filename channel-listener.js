const { getMessageDetail } = require("./modules/messages");
const { logMessage } = require("./utils/helper");
const { initAuth } = require("./modules/auth");
const { textInput, booleanInput } = require("./utils/input_helper");
const { getLastSelection, updateLastSelection } = require("./utils/file_helper");
const { NewMessage } = require("telegram/events");
const { getDialogName } = require("./modules/dialoges");
let client = null;
let channelId = null;

const initializeClient = async () => {
  client = await initAuth();
};

const getChannelId = async () => {
  const args = process.argv || [];
  channelId = args[2];

  if (!channelId) {
    const lastSelection = getLastSelection();
    channelId = lastSelection.channelId;

    if (channelId) {
      const changeChannel = await booleanInput("Do you want to change channel?");
      if (changeChannel) {
        channelId = await textInput("Please Enter Channel ID: ");
        updateLastSelection({ channelId });
      }
    } else {
      channelId = await textInput("Please Enter Channel ID: ");
      updateLastSelection({ channelId });
    }
  }

  return channelId;
};

const handleNewMessage = async (event) => {
  const messageChatId = event.message?.peerId?.chatId;
  const messageId = event.message?.id;
  const isMedia = !!event.message?.media;

  logMessage.info(`New Message: ${messageId}`);

  if (Math.abs(messageChatId) === Math.abs(channelId) && isMedia) {
    await getMessageDetail(client, channelId, [messageId]);
  }
};

const startListening = async (channelId) => {
  logMessage.info(`Listening for new messages in channel: ${getDialogName(channelId)}`);
  client.addEventHandler(handleNewMessage, new NewMessage({}));
};

(async () => {
  await initializeClient();
  const channelId = await getChannelId();
  await startListening(channelId);
})();
