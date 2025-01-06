const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { circularStringify } = require("../utils/helper");

const getMessages = async (client, channelId, limit = 10, offsetId = 0) => {
  if (!client || !channelId) {
    throw new Error("Client and channelId are required");
  }

  try {
    const result = await client.getMessages(channelId, { limit, offsetId });
    return result;
  } catch (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }
};

const getMessageDetail = async (client, channelId, messageIds) => {
  if (!client || !channelId || !messageIds) {
    throw new Error("Client, channelId, and messageIds are required");
  }

  try {
    const result = await client.getMessages(channelId, { ids: messageIds });
    return result;
  } catch (error) {
    throw new Error(`Failed to get message details: ${error.message}`);
  }
};

const downloadMessageMedia = async (client, message, mediaPath) => {
  try {
    if (!client || !message || !mediaPath) {
      logger.error("Client, message, and mediaPath are required");
      return false;
    }

    if (message.media) {
      if (message.media.webpage) {
        const url = message.media.webpage.url;
        if (url) {
          const urlPath = path.join(mediaPath, `../${message.id}_url.txt`);
          fs.writeFileSync(urlPath, url);
        }

        mediaPath = path.join(
          mediaPath,
          `../${message?.media?.webpage?.id}_image.jpeg`
        );
      }

      if (message.media.poll) {
        const pollPath = path.join(mediaPath, `../${message.id}_poll.json`);
        fs.writeFileSync(
          pollPath,
          circularStringify(message.media.poll, null, 2)
        );
      }

      await client.downloadMedia(message, {
        outputFile: mediaPath,
        progressCallback: (downloaded, total) => {
          const name = path.basename(mediaPath);
          if (total === downloaded) {
            logger.success(`File ${name} downloaded successfully`);
          }
        },
      });

      return true;
    } else {
      logger.error("No media found in the message");
      return false;
    }

  } catch (err) {
    logger.error("Error in downloadMessageMedia()");
    console.error(err);
    return false;
  }
};

module.exports = {
  getMessages,
  getMessageDetail,
  downloadMessageMedia,
};
