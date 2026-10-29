import fs from "fs";
import path from "path";
import type { TelegramClient } from "telegram";
import { initAuth } from "../modules/auth.js";
import { getChannelInfo, downloadProfilePhoto } from "../modules/messages.js";
import logger from "../utils/logger.js";
import type { CliOptions, ChannelInfo } from "../types/index.js";

/**
 * Exports channel/group metadata and profile photo to JSON.
 */
class ExportChannelInfo {
  static description(): string {
    return "Export channel/group metadata and profile photo to JSON";
  }

  static help(): string {
    return [
      "Usage: export-channel-info [options]",
      "",
      "Options:",
      "  --channelId=<id>       Channel ID to export info for (required).",
      "                         Accepts comma-separated IDs: --channelId=123,456",
      "  --includePhoto         Also download the channel/group profile photo.",
      "  --help                 Show this help message.",
      "",
      "Examples:",
      "  export-channel-info --channelId=12345",
      "  export-channel-info --channelId=12345 --includePhoto",
      "  export-channel-info --channelId=123,456,789",
    ].join("\n");
  }

  async handle(options: CliOptions = {}): Promise<void> {
    let client: TelegramClient | null = null;
    try {
      client = await initAuth();

      const channelIdInput = options.channelId;
      if (!channelIdInput) {
        logger.error("--channelId is required. Use --help for usage.");
        return;
      }

      const channelIds = String(channelIdInput)
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const includePhoto = Boolean(options.includePhoto);

      for (let i = 0; i < channelIds.length; i++) {
        const cid = channelIds[i];
        if (channelIds.length > 1) {
          logger.info(`\n=== Channel ${i + 1}/${channelIds.length}: ${cid} ===`);
        }

        const info = await getChannelInfo(client, cid);
        if (!info) {
          logger.error(`Could not fetch info for channel ${cid}`);
          continue;
        }

        const outputFolder = path.join(process.cwd(), "export", String(cid));
        if (!fs.existsSync(outputFolder)) {
          fs.mkdirSync(outputFolder, { recursive: true });
        }

        const channelInfo: ChannelInfo = {
          id: info.id,
          title: info.title,
          username: info.username,
          description: info.description,
          type: info.type,
          participantsCount: info.participantsCount,
          createdDate: info.createdDate,
        };

        // Download profile photo if requested
        if (includePhoto) {
          const photoPath = await downloadProfilePhoto(client, cid, outputFolder);
          if (photoPath) {
            channelInfo.profilePhotoPath = photoPath;
          }
        }

        const jsonPath = path.join(outputFolder, "channel_info.json");
        fs.writeFileSync(jsonPath, JSON.stringify(channelInfo, null, 2));

        logger.success(`Channel info exported: ${jsonPath}`);
        logger.info(`  Title:       ${channelInfo.title}`);
        logger.info(`  Type:        ${channelInfo.type}`);
        if (channelInfo.username) logger.info(`  Username:    @${channelInfo.username}`);
        if (channelInfo.participantsCount !== undefined) {
          logger.info(`  Participants: ${channelInfo.participantsCount}`);
        }
        if (channelInfo.description) {
          const desc =
            channelInfo.description.length > 100
              ? channelInfo.description.slice(0, 100) + "..."
              : channelInfo.description;
          logger.info(`  Description: ${desc}`);
        }
        if (channelInfo.profilePhotoPath) {
          logger.info(`  Profile photo: ${channelInfo.profilePhotoPath}`);
        }
      }
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    } finally {
      if (client) await client.disconnect();
    }
  }
}

export default ExportChannelInfo;
