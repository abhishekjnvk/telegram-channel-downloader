const fs = require('fs');
const path = require('path');
const { logMessage } = require('./helper');
const configFile = "../config.json"
const lastSelectionFile = "../export/last_selection.json"

const updateCredentials = (obj) => {
    try {
        let data = fs.readFileSync(path.join(__dirname, configFile));
        let credentials = JSON.parse(data);
        credentials = { ...credentials, ...obj };
        fs.writeFileSync(path.join(__dirname, configFile), JSON.stringify(credentials, null, 2));
        logMessage.success('Credentials updated successfully');
    }
    catch (err) {
        logMessage.error(err);
    }
}

const getCredentials = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, configFile));
        const credentials = JSON.parse(data);
        return credentials;
    }
    catch (err) {
        logMessage.error("Please add your credentials in config.json file, follow https://github.com/abhishekjnvk/telegram-channel-downloader#setup for more info");
        process.exit(1);
    }
}


const getLastSelection = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, lastSelectionFile));
        const last = JSON.parse(data);
        return last;
    }
    catch (err) {
        return {};
    }
}

const updateLastSelection = (object) => {
    try {
        let last = getLastSelection();
        last = {
            ...last,
            ...object
        }

        fs.writeFileSync(path.join(__dirname, lastSelectionFile), JSON.stringify(last, null, 2));
        logMessage.success('Last selection updated successfully');
    }
    catch (err) {
        logMessage.error(err);
    }
}

module.exports = {
    updateCredentials,
    getLastSelection,
    updateLastSelection,
    getCredentials
}
