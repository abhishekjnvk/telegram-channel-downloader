#!/usr/bin/env node
/**
 * CLI entry point for the Telegram Channel Downloader.
 *
 * Usage: node dist/cli.js <command> [--option=value ...]
 *        npm run cli -- <command> [--option=value ...]
 */

import fs from "fs";
import path from "path";
import { globSync } from "glob";
import logger from "./utils/logger.js";
import type { CliOptions, CommandInfo, CommandClass } from "./types/index.js";

// ─── Global Error Handlers ───────────────────────────────────────────────────

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled Rejection: ${message}`);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
  process.exit(1);
});

// ─── Command Discovery ───────────────────────────────────────────────────────

// In production (compiled JS), scripts are .js files in dist/scripts/.
// In dev mode (tsx), scripts are .ts files in src/scripts/.
// Detect which extension to look for.
const scriptsDir = path.join(__dirname, "scripts");
const isTsx = __filename.endsWith(".ts");
const scriptExt = isTsx ? "ts" : "js";
const commandFiles = globSync(path.join(scriptsDir, `*.${scriptExt}`));

/**
 * Loads command classes from the scripts directory.
 */
function loadCommands(files: string[]): Record<string, CommandInfo> {
  const commands: Record<string, CommandInfo> = {};
  for (const filePath of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const CommandClass = require(filePath) as { default: CommandClass };
    const Cmd = CommandClass.default;
    const signature = path.basename(filePath, `.${scriptExt}`);
    commands[signature] = {
      signature,
      path: filePath,
      description: Cmd.description(),
    };
  }
  return commands;
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

interface ParsedArgs {
  scriptSignature: string | undefined;
  options: CliOptions;
}

export function parseArguments(argv: string[]): ParsedArgs {
  const scriptSignature = argv[2];
  const args = argv.slice(3);
  const options: CliOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      options[key] = value === undefined ? true : value;
    }
  }

  return { scriptSignature, options };
}

// ─── Command Execution ───────────────────────────────────────────────────────

async function runCommand(commandPath: string, options: CliOptions): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CommandModule = require(commandPath) as { default: CommandClass };
  const Command = CommandModule.default;
  logger.info(`${path.basename(commandPath, `.${scriptExt}`)} - ${Command.description()}`);

  if (options.help) {
    if (Command.help) {
      logger.info(Command.help());
    } else {
      logger.info("No help available for this command");
    }
    return;
  }

  const commandInstance = new Command();
  await commandInstance.handle(options);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure export directory exists
  const exportDir = path.join(process.cwd(), "export");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const availableCommands = loadCommands(commandFiles);
  const { scriptSignature, options } = parseArguments(process.argv);

  if (scriptSignature) {
    const commandDetail = availableCommands[scriptSignature];
    if (commandDetail) {
      await runCommand(commandDetail.path, options);
    } else {
      logger.error(`Unknown command: ${scriptSignature}`);
      logAvailableCommands(availableCommands);
      process.exit(1);
    }
  } else {
    logAvailableCommands(availableCommands);
  }
}

function logAvailableCommands(commands: Record<string, CommandInfo>): void {
  logger.success("Available commands:");
  const allCommands = Object.values(commands).map((command) => ({
    signature: command.signature,
    description: command.description,
  }));
  logger.table(allCommands);
}

// Only run main() when executed directly, not when imported for testing
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"));
if (isDirectRun) {
  main().catch((err) => {
    logger.error("Fatal error:");
    console.error(err);
    process.exit(1);
  });
}
