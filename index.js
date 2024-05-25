const fs = require("fs");
const { getMessages } = require("./modules/messages");
const { getLastSelection } = require("./utils/file_helper");
const { initAuth } = require("./modules/auth");
const { selectDialog, getDialogName } = require("./modules/dialoges");
const { logMessage, MEDIA_TYPES } = require("./utils/helper");
const {
  booleanInput,
  downloadOptionInput,
} = require("./utils/input_helper");

let { channelId } = getLastSelection();
var client = null;

(async () => {
  if (!fs.existsSync("./export")) {
    fs.mkdirSync("./export");
  }
  client = await initAuth();

  if (!channelId) {
    channelId = await selectDialog(client);
  } else {
    logMessage.success(`Selected channel is: ${getDialogName(channelId)}`);
    const changeChannel = await booleanInput("Do you want to change channel?");
    if (changeChannel) {
      channelId = await selectDialog(client);
    }
  }
  const downloadableFiles = await downloadOptionInput();
  await getMessages(client, channelId, downloadableFiles);
  await client.disconnect();

  process.exit(0);
})();
