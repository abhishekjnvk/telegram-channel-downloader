const mimeDB = require("mime-db");
const fs = require("fs");

let consoleColors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  reset: "\x1b[0m",
};

const getMediaType = (message) => {
  if (message.media) {
    if (message.media.photo) return "photo";
    if (message.media.document) {
      return message.media.document.mimeType || "Document";
    }
    if (message.media.video) return "video";
    if (message.media.audio) return "audio";
    if (message.media.webpage) return "webpage";
    if (message.media.poll) return "poll";
    if (message.media.geo) return "geo";
    if (message.media.contact) return "contact";
    if (message.media.venue) return "venue";
    if (message.media.sticker) return "sticker";
  }

  return "unknown";
};

const getMediaName = (message) => {
  if (!message) return;
  if (message.media) {
    let fileName = `${message.id}_file`;
    if (message.media.document) {
      let docAttributes = message?.media?.document?.attributes;
      if (docAttributes) {
        let fileNameObj = docAttributes.find(
          (e) => e.className == "DocumentAttributeFilename"
        );
        if (fileNameObj) {
          fileName = `${fileNameObj.fileName}`;
        } else {
          let ext = mimeDB[message.media.document.mimeType]?.extensions[0];
          if (ext) {
            fileName += "." + ext;
          }
        }
      }

      return fileName;
    }

    if (message.media.video) {
      return fileName + ".mp4";
    }
    if (message.media.audio) {
      return fileName + ".mp3";
    }
    if (message.media.photo) {
      return fileName + ".jpg";
    }

    return fileName;
  } else {
    return "unknown";
  }
};

const getDialogType = (dialog) => {
  if (dialog.isChannel) return "Channel";
  if (dialog.isGroup) return "Group";
  if (dialog.isUser) return "User";
  return "Unknown";
};

const logMessage = {
  info: (message) => {
    let logMessage = `📢: ${consoleColors.magenta} ${message} ${consoleColors.reset}`;
    console.log(logMessage);
  },
  error: (message) => {
    let logMessage = `❌ ${consoleColors.red} ${message} ${consoleColors.reset}`;
    console.log(logMessage);
  },
  success: (message) => {
    let logMessage = `✅ ${consoleColors.cyan} ${message} ${consoleColors.reset}`;
    console.log(logMessage);
  },
  debug: (message) => {
    let logMessage = `⚠️ ${message}`;
    console.log(logMessage);
  },
};

const wait = (second) => {
  logMessage.debug(`Waiting for ${second} seconds to avoid blocking`);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, second * 1000);
  });
};

const filterString = (string) => {
  return string.replace(/[^a-zA-Z0-9]/g, "");
};

const circularStringify = (circularString, indent = 2) => {
  let cache = [];
  const retVal = JSON.stringify(
    circularString,
    (key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent
  );
  cache = null;
  return retVal;
};

const appendToJSONArrayFile = (filePath, dataToAppend) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, circularStringify([dataToAppend], null, 2));
    } else {
      fs.readFile(filePath, function (err, data) {
        var json = JSON.parse(data);
        json.push(dataToAppend);
        fs.writeFileSync(filePath, circularStringify(json, null, 2));
      });
    }
  } catch (e) {
    logMessage.error(`Error appending to JSON Array file ${filePath}`);
    console.log(e);
  }
};

module.exports = {
  getMediaType,
  getMediaName,
  getDialogType,
  logMessage,
  wait,
  filterString,
  appendToJSONArrayFile,
  circularStringify,
};
