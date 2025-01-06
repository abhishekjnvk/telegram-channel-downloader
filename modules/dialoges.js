const ejs = require('ejs');
const fs = require("fs");
const path = require('path');
const { updateLastSelection } = require("../utils/file-helper");
const { logMessage, getDialogType, circularStringify } = require("../utils/helper");
const { numberInput, textInput, booleanInput } = require('../utils/input-helper');

/**
 * Fetches all dialogs from the client, sorts them by name, and exports them to JSON and HTML files.
 * @param {Object} client - The client object to fetch dialogs from.
 * @param {boolean} [sortByName=true] - Whether to sort the dialogs by name.
 * @returns {Promise<Array>} - A promise that resolves to the list of dialogs.
 */
const getAllDialogs = async (client, sortByName = true) => {
    try {
        const dialogs = await client.getDialogs();
        const dialogList = dialogs.map(d => ({
            deletedAccount: d.entity?.deleted,
            isBot: d.entity?.bot,
            username: d.entity?.username?.trim(),
            lastMessage: d.message?.message?.trim(),
            lastMessageTimestamp: d.message?.date,
            phone: d.entity?.phone,
            firstName: d.entity?.firstName?.trim(),
            lastName: d.entity?.lastName?.trim(),
            name: d.title?.trim(),
            id: d.id,
            type: getDialogType(d)
        }));

        if (sortByName) {
            dialogList.sort((a, b) => a.name.localeCompare(b.name));
        }

        const channelTemplateFile = path.resolve(__dirname, '../templates/channels.ejs');
        const renderedHtml = await ejs.renderFile(channelTemplateFile, { channels: dialogList });

        fs.writeFileSync("./export/raw_dialog_list.json", circularStringify(dialogs, null, 2));
        fs.writeFileSync("./export/dialog_list.html", renderedHtml);
        fs.writeFileSync("./export/dialog_list.json", JSON.stringify(dialogList, null, 2));

        return dialogList;
    } catch (error) {
        logMessage.error(`Failed to get dialogs: ${error.message}`);
        throw error;
    }
};

/**
 * Prompts the user to select a dialog from the list.
 * @param {Array} dialogs - The list of dialogs.
 * @returns {Promise<number>} - A promise that resolves to the selected dialog's ID.
 */
const userDialogSelection = async (dialogs) => {
    try {
        const selectedChannelNumber = await numberInput(`Please select from above list (1-${dialogs.length}): `, 1, dialogs.length);

        if (selectedChannelNumber > dialogs.length) {
            logMessage.error("Invalid Input");
            process.exit(0);
        }

        const selectedChannel = dialogs[selectedChannelNumber - 1];
        const channelId = selectedChannel.id;
        logMessage.info(`Selected channel: ${selectedChannel.name}`);

        updateLastSelection({
            channelId: channelId,
            messageOffsetId: 0
        });

        return channelId;
    } catch (error) {
        logMessage.error(`Failed to select dialog: ${error.message}`);
        throw error;
    }
};

/**
 * Displays the list of dialogs and prompts the user to select one.
 * @param {Array} dialogs - The list of dialogs.
 * @returns {Promise<number>} - A promise that resolves to the selected dialog's ID.
 */
const selectDialog = async (dialogs) => {
    dialogs.forEach((d, index) => {
        console.log(`${index + 1} - ${d.name}`);
    });
    
    return await userDialogSelection(dialogs);
};

/**
 * Prompts the user to search for a dialog by name.
 * @param {Array} dialogs - The list of dialogs.
 * @returns {Promise<number>} - A promise that resolves to the selected dialog's ID.
 */
const searchDialog = async (dialogs) => {
    try {
        const searchString = await textInput('Please enter name of channel to search');
        searchThroughDialogsWithSearchString(dialogs, searchString);

        const foundWantedDialog = await booleanInput('Found channel? If answering with "no" you can search again');
        if (foundWantedDialog) {
            return await userDialogSelection(dialogs);
        } else {
            return await searchDialog(dialogs);
        }
    } catch (error) {
        logMessage.error(`Failed to search dialog: ${error.message}`);
        throw error;
    }
};

/**
 * Searches through the dialogs for a given search string and logs the results.
 * @param {Array} dialogs - The list of dialogs.
 * @param {string} searchString - The search string.
 */
const searchThroughDialogsWithSearchString = (dialogs, searchString) => {
    dialogs.forEach((d, index) => {
        if (d.name.toUpperCase().includes(searchString.toUpperCase())) {
            console.log(`${index + 1} - ${d.name}`);
        }
    });
};

/**
 * Retrieves the name of a dialog by its ID.
 * @param {number} channelId - The ID of the channel.
 * @returns {string|null} - The name of the dialog, or null if not found.
 */
const getDialogName = async (client, channelId) => {
    try {
        const diaLogPath = path.resolve(process.cwd(), "./export/dialog_list.json");
        if(!fs.existsSync(diaLogPath)) {
            await getAllDialogs(client);
            process.exit(0);
        }

        const dialogs = require(diaLogPath);
        const dialog = dialogs.find(d => d.id == channelId);
        return dialog ? dialog.name : null;
    } catch (error) {
        logMessage.error(`Failed to get dialog name: ${error.message}`);
        return null;
    }
};

module.exports = {
    getAllDialogs,
    selectDialog,
    searchDialog,
    getDialogName
};