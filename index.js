const fs = require("fs");
const readline = require("readline-sync");
const { getMessages } = require("./modules/messages");
const { getLastSelection } = require("./utils/file_helper");
const { initAuth } = require("./modules/auth");
const { selectDialog, getDialogName } = require("./modules/dialoges");
const { logMessage } = require("./utils/helper");

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
    if (readline.keyInYN("Do you want to change channel?")) {
      channelId = await selectDialog(client);
    }
  }

  let downloadMedia = false;
  if (readline.keyInYN("Do you want to download media?")) {
    downloadMedia = true;
  }

  await getMessages(client, channelId, downloadMedia);
  await client.disconnect();

  process.exit(0);
})();
