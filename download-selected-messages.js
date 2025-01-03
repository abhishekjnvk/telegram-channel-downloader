const { getMessageDetail } = require("./modules/messages");
const { logMessage } = require("./utils/helper");
const { initAuth } = require("./modules/auth");
const { textInput } = require("./utils/input_helper");

(async () => {
    try {
        const client = await initAuth();
        const channelId = textInput('Please Enter Channel ID: ');
        const messageIdsText = textInput('Please Enter Message Id(s) (separated by comma): ');
        const messageIds = messageIdsText.split(",").map(Number);

        await getMessageDetail(client, channelId, messageIds);
        logMessage.success("Done with downloading messages");
    } catch (error) {
        logMessage.error("An error occurred:", error);
    } finally {
        if (client) {
            await client.disconnect();
        }
        process.exit(0);
    }
})();