const mimeDB = require("mime-db");
const fs = require("fs");
const path = require("path");

const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  WEBPAGE: "webpage",
  POLL: "poll",
  GEO: "geo",
  VENUE: "venue",
  CONTACT: "contact",
  STICKER: "sticker",
  DOCUMENT: "document",
  OTHERS: "others",
};

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
    if (message.media.photo) return MEDIA_TYPES.IMAGE;
    if (message.media.video) return MEDIA_TYPES.VIDEO;
    if (message.media.audio) return MEDIA_TYPES.AUDIO;
    if (message.media.webpage) return MEDIA_TYPES.WEBPAGE;
    if (message.media.poll) return MEDIA_TYPES.POLL;
    if (message.media.geo) return MEDIA_TYPES.GEO;
    if (message.media.contact) return MEDIA_TYPES.CONTACT;
    if (message.media.venue) return MEDIA_TYPES.VENUE;
    if (message.media.sticker) return MEDIA_TYPES.STICKER;
    if (message.media.document) {
      const documentMimeType = message.media.document.mimeType;
      if (documentMimeType) {
        if (documentMimeType?.includes(MEDIA_TYPES.IMAGE)) {
          return MEDIA_TYPES.IMAGE;
        }
        if (documentMimeType?.includes(MEDIA_TYPES.VIDEO)) {
          return MEDIA_TYPES.VIDEO;
        }
        if (documentMimeType?.includes(MEDIA_TYPES.AUDIO)) {
          return MEDIA_TYPES.AUDIO;
        }
        if (documentMimeType?.includes(MEDIA_TYPES.STICKER)) {
          return MEDIA_TYPES.STICKER;
        }
      }

      return MEDIA_TYPES.DOCUMENT;
    }
  }

  return MEDIA_TYPES.OTHERS;
};


const checkFileExist = (message, outputFolder) => {
  if (!message) return;

  if (message.media) {
    let isExist = false;
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
    }

    if (message.media.video) {
      fileName = fileName + ".mp4";
    }
    if (message.media.audio) {
      fileName = fileName + ".mp3";
    }
    if (message.media.photo) {
      fileName = fileName + ".jpg";
    }

    let folderType = filterString(getMediaType(message));
    outputFolder = path.join(outputFolder, folderType);
    let filePath = path.join(outputFolder, fileName);
    //check if file already exists
    if (fs.existsSync(filePath)) {
      isExist = true;
    }
    return isExist;
  } else {
    return false;
  }
};

const getMediaPath = (message, outputFolder) => {
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
    }

    if (message.media.video) {
      fileName = fileName + ".mp4";
    }
    if (message.media.audio) {
      fileName = fileName + ".mp3";
    }
    if (message.media.photo) {
      fileName = fileName + ".jpg";
    }

    let folderType = filterString(getMediaType(message));
    outputFolder = path.join(outputFolder, folderType);
    let filePath = path.join(outputFolder, fileName);
    //check if file already exists
    if (fs.existsSync(filePath)) {
      logMessage.info(`File already exists: ${filePath}, Changing name`);
      let ext = path.extname(filePath);
      let baseName = path.basename(filePath, ext);
      let newFileName = `${baseName}_${message.id}${ext}`;
      filePath = path.join(outputFolder, newFileName);
    }
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder);
    }

    return filePath;
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
  checkFileExist,
  getMediaPath,
  getDialogType,
  logMessage,
  wait,
  filterString,
  appendToJSONArrayFile,
  circularStringify,
  MEDIA_TYPES,
};
