const fs = require('fs');
const path = require('path');
const { logMessage } = require('./helper');

const updateCredentials = (credentials) => {
    try {
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(credentials, null, 2));
        logMessage.success('Credentials updated successfully');
    }
    catch (err) {
        logMessage.error(err);
    }
}


const getLastSelection = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, '../export/last_selection.json'));
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

        fs.writeFileSync(path.join(__dirname, '../export/last_selection.json'), JSON.stringify(last, null, 2));
        logMessage.success('Last selection updated successfully');
    }
    catch (err) {
        logMessage.error(err);
    }
}

module.exports = {
    updateCredentials,
    getLastSelection,
    updateLastSelection
}
