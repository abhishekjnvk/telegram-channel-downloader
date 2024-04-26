const ejs = require('ejs');
const fs = require("fs");
const readline = require("readline-sync");
const { updateLastSelection } = require("../utils/file_helper");
const { logMessage, getDialogType, circularStringify } = require("../utils/helper");
const path = require('path');

const getAllDialogs = async (client, sortByName = true) => {
    let dialogList = [];
    let dialogs = await client.getDialogs();
    fs.writeFileSync(
        "./export/raw_dialog_list.json",
        circularStringify(dialogs, null, 2)
    )

    dialogs.forEach(d => {
        dialogList.push({
            deletedAccount: d.entity?.deleted,
            isBot: d.entity?.bot,
            username: d.entity?.username?.trim(),
            lastMessage: d.message?.message?.trim(),
            lastMessageTimestamp: d.message?.date,
            phone: d.entity?.phone,
            firstName: d.entity?.firstName?.trim(),
            lastName: d.entity?.lastName?.trim(),
            username: d.entity?.username?.trim(),
            name: d.title?.trim(),
            id: d.id,
            type: getDialogType(d)
        });
    });

    if (sortByName) {
        dialogList.sort((a, b) => {
            if (a.name < b.name) { return -1; }
            if (a.name > b.name) { return 1; }
            return 0;
        });
    }


    const channelTemplateFile=path.resolve(__dirname, '../templates/channels.ejs')
    const renderedHtml = await ejs.renderFile(channelTemplateFile, { channels: dialogList });
    fs.writeFileSync("./export/dialog_list.html", renderedHtml);
    fs.writeFileSync("./export/dialog_list.json", JSON.stringify(dialogList, null, 2));
    return dialogList;
}

const selectDialog = async (client) => {
    let dialogs = await getAllDialogs(client)
    dialogs.forEach((d, index) => {
        console.log(`${index + 1} - ${d.name}`)
    })
    let selectedChannelNumber = readline.questionInt(`Please select from above list (1-${dialogs.length}): `);
    if (selectedChannelNumber > dialogs.length) {
        logMessage.error("Invalid Input");
        process.exit(0);
    }

    let selectedChannel = dialogs[selectedChannelNumber - 1];
    channelId = selectedChannel.id;
    logMessage.info(`Selected channel: ${selectedChannel.name}`)

    //save channelId into last selection
    updateLastSelection({
        channelId: channelId,
        messageOffsetId: 0
    })
    return channelId;
}

const getDialogName = (channelId) => {
    try {
        let dialogs = require("../export/dialog_list.json")
        if (dialogs) {
            let dialog = dialogs.find(d => d.id == channelId)
            if (dialog) {
                return dialog.name
            }
            return null
        }
        return null
    }
    catch (err) {
        logMessage.error(err)
        return null
    }
}

module.exports = {
    getAllDialogs,
    selectDialog,
    getDialogName
}