import fs from "fs";
import path from "path";
import type { TelegramClient } from "telegram";
import { initAuth } from "../modules/auth.js";
import { getAllDialogs } from "../modules/dialogs.js";
import logger from "../utils/logger.js";
import type { CliOptions } from "../types/index.js";

/**
 * Exports the list of all chats/channels/groups to a JSON file.
 */
class ExportChatList {
  static description(): string {
    return "Export list of all chats/channels/groups to JSON and HTML";
  }

  static help(): string {
    return [
      "Usage: export-chat-list [options]",
      "",
      "Options:",
      "  --output=<filename>  Output JSON file path (default: export/chat_list.json)",
      "  --help               Show this help message.",
    ].join("\n");
  }

  async handle(options: CliOptions = {}): Promise<void> {
    let client: TelegramClient | null = null;
    try {
      client = await initAuth();

      logger.info("Fetching dialogs...");
      const dialogs = await getAllDialogs(client);

      // Write JSON
      const outputFile = options.output
        ? String(options.output)
        : path.join(process.cwd(), "export", "chat_list.json");

      const dir = path.dirname(outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputFile, JSON.stringify(dialogs, null, 2));
      logger.success(`Exported ${dialogs.length} chats to ${outputFile}`);

      // HTML export is already handled by getAllDialogs() → export/dialog_list.html
      const htmlPath = path.join(process.cwd(), "export", "dialog_list.html");
      if (fs.existsSync(htmlPath)) {
        logger.info(`HTML export available at: ${htmlPath}`);
      }
    } catch (err) {
      logger.error("An error occurred:");
      console.error(err);
    } finally {
      if (client) await client.disconnect();
    }
  }
}

export default ExportChatList;
