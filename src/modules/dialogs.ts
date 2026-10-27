import ejs from "ejs";
import fs from "fs";
import path from "path";
import type { TelegramClient } from "telegram";
import { updateLastSelection } from "../utils/file-helper.js";
import { getDialogType, circularStringify } from "../utils/helper.js";
import logger from "../utils/logger.js";
import { numberInput, textInput, booleanInput } from "../utils/input-helper.js";
import type { DialogInfo, DialogType } from "../types/index.js";

const EXPORT_DIR = path.join(process.cwd(), "export");

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/** Subset of entity properties used for dialog listing. */
interface EntityLike {
  deleted?: boolean;
  bot?: boolean;
  username?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

/** Loose shape of a dialog for property access. */
interface DialogShape {
  entity?: EntityLike;
  message?: {
    message?: string;
    date?: number;
  };
  title?: string;
  id?: { toString(): string };
  isChannel?: boolean;
  isGroup?: boolean;
  isUser?: boolean;
}

/**
 * Fetches all dialogs from the client, sorts them by name, and exports them to JSON and HTML files.
 */
export async function getAllDialogs(
  client: TelegramClient,
  sortByName = true
): Promise<DialogInfo[]> {
  try {
    ensureExportDir();
    const dialogs = await client.getDialogs();
    const dialogList: DialogInfo[] = dialogs.map((d) => {
      const dialog = d as unknown as DialogShape;
      return {
        deletedAccount: dialog.entity?.deleted,
        isBot: dialog.entity?.bot,
        username: dialog.entity?.username?.trim(),
        lastMessage: dialog.message?.message?.trim(),
        lastMessageTimestamp: dialog.message?.date,
        phone: dialog.entity?.phone,
        firstName: dialog.entity?.firstName?.trim(),
        lastName: dialog.entity?.lastName?.trim(),
        name: dialog.title?.trim() || "",
        id: dialog.id?.toString() || "",
        type: getDialogType(dialog) as DialogType,
      };
    });

    if (sortByName) {
      dialogList.sort((a, b) => a.name.localeCompare(b.name));
    }

    const channelTemplateFile = path.resolve(__dirname, "../../templates/channels.ejs");
    const renderedHtml = await ejs.renderFile(channelTemplateFile, { channels: dialogList });

    fs.writeFileSync(
      path.join(EXPORT_DIR, "raw_dialog_list.json"),
      circularStringify(dialogs, 2)
    );
    fs.writeFileSync(path.join(EXPORT_DIR, "dialog_list.html"), renderedHtml);
    fs.writeFileSync(
      path.join(EXPORT_DIR, "dialog_list.json"),
      JSON.stringify(dialogList, null, 2)
    );

    return dialogList;
  } catch (error) {
    logger.error(`Failed to get dialogs: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Prompts the user to select a dialog from the list by number.
 */
export async function userDialogSelection(dialogs: DialogInfo[]): Promise<string | number> {
  try {
    const selectedChannelNumber = await numberInput(
      `Please select from above list (1-${dialogs.length}): `,
      1,
      dialogs.length
    );

    const selectedChannel = dialogs[selectedChannelNumber - 1];
    if (!selectedChannel) {
      logger.error("Invalid selection");
      throw new Error("Invalid dialog selection");
    }

    const channelId = selectedChannel.id;
    logger.info(`Selected channel: ${selectedChannel.name}`);

    updateLastSelection({
      channelId: String(channelId),
      messageOffsetId: 0,
    });

    return channelId;
  } catch (error) {
    logger.error(`Failed to select dialog: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Displays the list of dialogs and prompts the user to select one.
 */
export async function selectDialog(dialogs: DialogInfo[]): Promise<string | number> {
  dialogs.forEach((d, index) => {
    console.log(`${index + 1} - ${d.name}`);
  });

  return await userDialogSelection(dialogs);
}

/**
 * Searches through the dialogs for a given search string.
 */
function searchThroughDialogsWithSearchString(dialogs: DialogInfo[], searchString: string): void {
  dialogs.forEach((d, index) => {
    if (d.name.toUpperCase().includes(searchString.toUpperCase())) {
      console.log(`${index + 1} - ${d.name}`);
    }
  });
}

/**
 * Prompts the user to search for a dialog by name.
 */
export async function searchDialog(dialogs: DialogInfo[]): Promise<string | number> {
  try {
    const searchString = await textInput("Please enter name of channel to search");
    searchThroughDialogsWithSearchString(dialogs, searchString);

    const foundWantedDialog = await booleanInput(
      'Found channel? If answering with "no" you can search again'
    );
    if (foundWantedDialog) {
      return await userDialogSelection(dialogs);
    } else {
      return await searchDialog(dialogs);
    }
  } catch (error) {
    logger.error(`Failed to search dialog: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Retrieves the name of a dialog by its ID.
 * Fixed: uses fs.readFileSync + JSON.parse instead of require() to avoid caching.
 * Fixed: no longer calls process.exit().
 */
export async function getDialogName(
  client: TelegramClient,
  channelId: string | number
): Promise<string | null> {
  try {
    const dialogListPath = path.join(EXPORT_DIR, "dialog_list.json");
    if (!fs.existsSync(dialogListPath)) {
      const dialogs = await getAllDialogs(client);
      const dialog = dialogs.find((d) => String(d.id) === String(channelId));
      return dialog ? dialog.name : null;
    }

    const raw = fs.readFileSync(dialogListPath, "utf8");
    const dialogs = JSON.parse(raw) as DialogInfo[];
    const dialog = dialogs.find((d) => String(d.id) === String(channelId));
    return dialog ? dialog.name : null;
  } catch (error) {
    logger.error(`Failed to get dialog name: ${(error as Error).message}`);
    return null;
  }
}
