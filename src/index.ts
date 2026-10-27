/**
 * Programmatic entry point for the Telegram Channel Downloader.
 *
 * Usage:
 *   import DownloadChannel from "telegram-channel-downloader";
 *   const downloader = new DownloadChannel();
 *   await downloader.handle({ channelId: "12345" });
 */

import DownloadChannel from "./scripts/download-channel.js";

export { DownloadChannel };
export { default as DownloadSelectedMessage } from "./scripts/download-selected-message.js";
export { default as ListenChannel } from "./scripts/listen-channel.js";

export default DownloadChannel;
