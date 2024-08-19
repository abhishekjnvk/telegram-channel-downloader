const fs = require("fs");
const { getMessages } = require("./modules/messages");
const { getLastSelection } = require("./utils/file_helper");
const { initAuth } = require("./modules/auth");
const { searchDialog, selectDialog, getDialogName, getAllDialogs} = require("./modules/dialoges");
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
  const dialogs = await getAllDialogs(client);

  if (!channelId) {
    await searchOrListChannel(dialogs);
  } else {
    logMessage.success(`Selected channel is: ${getDialogName(channelId)}`);
    const changeChannel = await booleanInput("Do you want to change channel?");
    if (changeChannel) {
      await searchOrListChannel(dialogs);
    }
  }
  const downloadableFiles = await downloadOptionInput();
  await getMessages(client, channelId, downloadableFiles);
  await client.disconnect();

  process.exit(0);
})();

async function searchOrListChannel(dialogs) {
  const searchOrListChannel = await booleanInput("Do you want to search for a channel? If not, all channels will be listed.");
  if (searchOrListChannel) {
    channelId = await searchDialog(dialogs)
  } else {
    channelId = await selectDialog(dialogs);
  }
}
