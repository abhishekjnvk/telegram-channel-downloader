const fs = require("fs");
const readline = require("readline-sync");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { getMessageDetail } = require("./modules/messages");
const { logMessage } = require("./utils/helper");
const { updateCredentials, getLastSelection, getCredentials } = require("./utils/file_helper");
let { apiHash, apiId, sessionId } = getCredentials()


const stringSession = new StringSession(sessionId || "");
let { channelId } = getLastSelection()
var client = null;

const init = async () => {
    if (!fs.existsSync("./export")) {
        fs.mkdirSync("./export");
    }

    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    try {
        await client.start({
            phoneNumber: async () => await readline.question("Please enter your number: "),
            password: async () => await readline.question("Please enter your password: "),
            phoneCode: async () =>
                await readline.question("Please enter the code you received: "),
            onError: (err) => logMessage.error(err),
        });
        logMessage.success("You should now be connected.");
        if (!sessionId) {
            sessionId = client.session.save();
            updateCredentials({sessionId});
            logMessage.info(`To avoid login again and again session id has been saved to config.json, please don't share it with anyone`);
        }

        return client;
    }
    catch (err) {
        logMessage.error(err)
    }
}

(async () => {
    await init();
    var channelId = readline.question('Please Enter Channel ID: ');
    var messageIdsText = readline.question('Please Enter Message Id(s) (separated by comma): ');

    let messageIds = messageIdsText.split(",").map((id) => parseInt(id));



    await getMessageDetail(client, channelId, messageIds);
    logMessage.success("Done with downloading messages");

    await client.disconnect();
    process.exit(0);

})()