const { NewMessage } = require("telegram/events");
const { getAllDialogs, getDialogName } = require("../modules/dialoges");
const { downloadMessageMedia, getMessageDetail } = require("../modules/messages");
const { getMediaPath, wait } = require("../utils/helper");
const logger = require("../utils/logger");
const { initAuth } = require("../modules/auth");
const { selectInput } = require("../utils/input-helper");
const path = require("path");

class ListenChannel {
  constructor() {
    this.channelId = null;
    this.client = null;
    this.handleNewMessage = this.handleNewMessage.bind(this);
  }

  static description() {
    return "Listen to a channel and download media from incoming messages";
  }
  
  async handleNewMessage(event) {
    const messageChatId =
      event.message?.peerId?.chatId ||
      event.message?.peerId?.channelId ||
      event.message?.peerId?.userId;
    if (Number(messageChatId) !== Number(this.channelId)) {
      logger.info("Message from another channel");
      return;
    }

    const messageId = event.message?.id;
    const isMedia = !!event.message?.media;
    if (isMedia) {
      const outputFolder = path.join(
        process.cwd(),
        "export",
        this.channelId.toString()
      );

      const details = await getMessageDetail(this.client, this.channelId, [
        messageId,
      ]);
      for (const msg of details) {
        await downloadMessageMedia(
          this.client,
          msg,
          getMediaPath(msg, outputFolder)
        );
        logger.info(`Downloaded media from message: ${msg.id}`);
      }
    } else {
      logger.info("No media found in the message");
    }
  }

  async handle(options = {}) {
    let channelId = Number(options.channelId);
    let client;
    await wait(1);
    try {
      client = await initAuth();

      if (!channelId) {
        logger.info("Please select a channel to download media from");
        const allChannels = await getAllDialogs(client);
        const options = allChannels.map((d) => ({
          name: d.name,
          value: d.id,
        }));

        channelId = await selectInput("Please select a channel", options);
      }

      this.channelId = channelId;
      this.client = client;

      const dialogName = await getDialogName(client, channelId);
      logger.info(`Listening to: ${dialogName}`);
      client.addEventHandler(this.handleNewMessage, new NewMessage({}));
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    }
  }
}

module.exports = ListenChannel;
