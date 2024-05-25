const { getMessageDetail } = require("./modules/messages");
const { logMessage } = require("./utils/helper");
const { initAuth } = require("./modules/auth");
const { textInput } = require("./utils/input_helper");
var client = null;

(async () => {
    client = await initAuth();
    var channelId = textInput('Please Enter Channel ID: ');
    var messageIdsText = textInput('Please Enter Message Id(s) (separated by comma): ');
    let messageIds = messageIdsText.split(",").map((id) => parseInt(id));

    await getMessageDetail(client, channelId, messageIds);
    logMessage.success("Done with downloading messages");

    await client.disconnect();
    process.exit(0);
})()