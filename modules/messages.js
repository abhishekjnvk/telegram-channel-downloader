const fs = require("fs");
const {
  getMediaType,
  logMessage,
  wait,
  appendToJSONArrayFile,
  circularStringify,
  checkFileExist,
  getMediaPath,
} = require("../utils/helper");
const {
  getLastSelection,
  updateLastSelection,
} = require("../utils/file_helper");
const path = require("path");

const MAX_PARALLEL_DOWNLOAD = 5;
const MESSAGE_LIMIT = 100;

let { messageOffsetId } = getLastSelection();

const downloadMessageMedia = async (client, message, mediaPath) => {
  try {
    if (message.media) {
      if (message.media.webpage) {
        let url = message.media.webpage.url;
        if (url) {
          let urlPath = path.join(mediaPath, `../${message.id}_url.txt`);
          fs.writeFileSync(urlPath, url);
        }

        mediaPath = path.join(
          mediaPath,
          `../${message?.media?.webpage?.id}_image.jpeg`
        );
      }

      if (message.media.poll) {
        let pollPath = path.join(mediaPath, `../${message.id}_poll.json`);

        fs.writeFileSync(
          pollPath,
          circularStringify(message.media.poll, null, 2)
        );
      }

      await client.downloadMedia(message, {
        outputFile: mediaPath,
        progressCallback: (downloaded, total) => {
          const name = path.basename(mediaPath);
          if (total == downloaded) {
            logMessage.success(`file ${name} downloaded successfully`);
          }
        },
      });

      return true;
    } else {
      return false;
    }
  } catch (err) {
    logMessage.error("Error in downloadMessageMedia()");
    console.log(err);
    return false;
  }
};

const getMessages = async (client, channelId, downloadableFiles = {}) => {
  try {
    let offsetId = messageOffsetId;
    let outputFolder = path.join(__dirname, "../export/", `${channelId}`);
    let rawMessagePath = path.join(outputFolder, "raw_message.json");
    let messageFilePath = path.join(outputFolder, "all_message.json");
    let totalFetched = 0;

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    while (true) {
      let allMessages = [];
      let messages = await client.getMessages(channelId, {
        limit: MESSAGE_LIMIT,
        offsetId: offsetId,
      });
      totalFetched += messages.length;
      appendToJSONArrayFile(rawMessagePath, messages);
      logMessage.info(
        `getting messages (${totalFetched}/${messages.total}) : ${Math.round(
          (totalFetched * 100) / messages.total
        )}%`
      );
      messages = messages.filter(
        (message) => message.message != undefined || message.media != undefined
      );
      messages.forEach((message) => {
        let obj = {
          id: message.id,
          message: message.message,
          date: message.date,
          out: message.out,
          sender: message.fromId?.userId || message.peerId?.userId,
        };
        if (message.media) {
          const mediaPath = getMediaPath(message, outputFolder);
          const fileName = path.basename(mediaPath);
          obj.mediaType = message.media ? getMediaType(message) : null;
          obj.mediaPath = getMediaPath(message, outputFolder);
          obj.mediaName = fileName;
          obj.isMedia = true;
        }

        allMessages.push(obj);
      });

      if (messages.length === 0) {
        logMessage.success(`Done with all messages (${totalFetched}) 100%`);
        break;
      }

      let promArr = [];
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.media) {
          const mediaType = getMediaType(message);
          const mediaPath = getMediaPath(message, outputFolder);
          const fileExist = checkFileExist(message, outputFolder);

          const mediaExtension = path
            .extname(mediaPath)
            ?.toLowerCase()
            ?.replace(".", "");
          const shouldDownload =
            downloadableFiles[mediaType] ||
            downloadableFiles[mediaExtension] ||
            downloadableFiles["all"];

          if (shouldDownload && !fileExist) {
            promArr.push(downloadMessageMedia(client, message, mediaPath));
          } else {
            fileExist 
            ?  logMessage.info(
              `Skipping Existing file ${mediaPath} (${mediaExtension})  download`
            )
            : logMessage.info(
              `Skipping file ${mediaType} (${mediaExtension}) download`
            );
          }

          if (promArr.length === MAX_PARALLEL_DOWNLOAD) {
            logMessage.info(
              `Waiting for files to be downloaded (${MAX_PARALLEL_DOWNLOAD} at a time)`
            );
            await Promise.all(promArr);
            logMessage.success(
              "Files downloaded successfully, adding more files"
            );
            promArr = [];
          }
        }
      }
      if (promArr.length > 0) {
        logMessage.info("Waiting for files to be downloaded");
        await Promise.all(promArr);
      }

      logMessage.success("Files downloaded successfully");

      appendToJSONArrayFile(messageFilePath, allMessages);
      offsetId = messages[messages.length - 1].id;
      updateLastSelection({ messageOffsetId: offsetId });
      await wait(3);
    }

    return true;
  } catch (err) {
    logMessage.error("Error in getMessages()");
    console.log(err);
  }
};

const getMessageDetail = async (client, channelId, messageIds) => {
  try {
    const result = await client.getMessages(channelId, {
      ids: messageIds,
    });
    let outputFolder = `./export/${channelId}`;
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder);
    }

    let promArr = [];
    for (let i = 0; i < result.length; i++) {
      let message = result[i];
      if (message.media) {
        promArr.push(downloadMessageMedia(client, message, outputFolder));
      }else{
        logMessage.info(`No media found in message ${message.id}`);
      }
      if (promArr.length === MAX_PARALLEL_DOWNLOAD) {
        logMessage.info(
          `Waiting for files to be downloaded ${MAX_PARALLEL_DOWNLOAD} at a time`
        );
        await Promise.all(promArr);
        logMessage.success("Files downloaded successfully, adding more files");
        promArr = [];
      }
    }

    if (promArr.length > 0) {
      logMessage.info("Waiting for files to be downloaded");
      await Promise.all(promArr);
      logMessage.success("Files downloaded successfully");
    }
    return true;
  } catch (err) {
    logMessage.error("Error in getMessageDetail()");
    console.log(err);
  }
};

const sendMessage = async (client, channelId, message) => {
  try {
    let res = await client.sendMessage(channelId, { message });

    logMessage.success(`Message sent successfully with ID: ${res.id}`);
  } catch (err) {
    logMessage.error("Error in sendMessage()");
    console.log(err);
  }
};

module.exports = {
  getMessages,
  getMessageDetail,
  sendMessage,
};
