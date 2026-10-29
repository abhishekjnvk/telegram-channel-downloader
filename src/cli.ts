#!/usr/bin/env node
/**
 * CLI entry point for the Telegram Channel Downloader.
 *
 * Usage: node dist/cli.js <command> [--option=value ...]
 *        node dist/cli.js              (interactive menu)
 *        node dist/cli.js help         (list all commands)
 *        node dist/cli.js --version    (show version)
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { globSync } from "glob";
import logger from "./utils/logger.js";
import { selectInput, booleanInput } from "./utils/input-helper.js";
import type { CliOptions, CommandInfo, CommandClass } from "./types/index.js";

// createRequire gives us a typed require function that works in both CJS and ESM output
const localRequire = createRequire(__filename);

// ─── Version ─────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ─── Global Error Handlers ───────────────────────────────────────────────────

/**
 * Checks if an error is a non-fatal GramJS update-loop TIMEOUT.
 * These occur when the updates polling times out during normal operation
 * or disconnection — they should not crash the process.
 */
function isNonFatalTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: string; stack?: string };
  const msg = (err.message ?? "").toUpperCase();
  const stack = err.stack ?? "";
  return msg === "TIMEOUT" && stack.includes("telegram/client/updates");
}

process.on("uncaughtException", (error) => {
  if (isNonFatalTimeout(error)) {
    logger.warn("Update loop timeout (non-fatal, continuing)");
    return;
  }
  logger.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (isNonFatalTimeout(reason)) {
    logger.warn("Update loop timeout (non-fatal, continuing)");
    return;
  }
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
 * Returns commands sorted alphabetically by signature.
 */
function loadCommands(files: string[]): Record<string, CommandInfo> {
  const commands: Record<string, CommandInfo> = {};
  for (const filePath of files) {
    const CommandClass = localRequire(filePath) as { default: CommandClass };
    const Cmd = CommandClass.default;
    const signature = path.basename(filePath, `.${scriptExt}`);
    commands[signature] = {
      signature,
      path: filePath,
      description: Cmd.description(),
    };
  }
  // Sort alphabetically by signature
  return Object.fromEntries(Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)));
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
  const CommandModule = localRequire(commandPath) as { default: CommandClass };
  const Command = CommandModule.default;
  const signature = path.basename(commandPath, `.${scriptExt}`);

  logger.info(`${signature} — ${Command.description()}`);
  console.log(""); // spacer

  if (options.help) {
    if (Command.help) {
      console.log(Command.help());
    } else {
      logger.info("No help available for this command");
    }
    return;
  }

  const commandInstance = new Command();
  await commandInstance.handle(options);
}

// ─── Display Helpers ─────────────────────────────────────────────────────────

function printBanner(): void {
  const version = getVersion();
  const line = "─".repeat(52);
  console.log("");
  console.log(`  Telegram Channel Downloader  v${version}`);
  console.log(`  ${line}`);
  console.log(`  Download media, messages & metadata from Telegram`);
  console.log(`  ${line}`);
  console.log("");
}

function printHelp(commands: Record<string, CommandInfo>): void {
  const entries = Object.values(commands);
  console.log("");
  logger.success(`Available commands (${entries.length}):`);
  console.log("");
  for (const cmd of entries) {
    console.log(`  ${cmd.signature.padEnd(28)} ${cmd.description}`);
  }
  console.log("");
  console.log(`  ${"help".padEnd(28)} Show this help message`);
  console.log(`  ${"--version, -v".padEnd(28)} Show version`);
  console.log("");
  console.log("  Usage:");
  console.log("    node dist/cli.js <command> [--option=value ...]");
  console.log("    node dist/cli.js              (interactive mode)");
  console.log("");
}

function findSimilarCommands(input: string, commands: Record<string, CommandInfo>): string[] {
  const signatures = Object.keys(commands);
  const lower = input.toLowerCase();
  // Only suggest if input is at least 3 chars and shares a meaningful prefix
  if (lower.length < 3) return [];
  return signatures.filter((sig) => {
    const sigLower = sig.toLowerCase();
    if (sigLower.startsWith(lower)) return true;
    // Check if sig contains the input as a substring
    if (sigLower.includes(lower)) return true;
    // Check Levenshtein-like: share first 3 chars
    return sigLower.slice(0, 3) === lower.slice(0, 3);
  });
}

// ─── Interactive Menu ────────────────────────────────────────────────────────

interface MenuChoice {
  name: string;
  value: string;
  short?: string;
}

/**
 * Shows an interactive menu to select and run a command.
 * Loops until the user chooses to exit.
 */
async function showInteractiveMenu(commands: Record<string, CommandInfo>): Promise<void> {
  const entries = Object.values(commands); // already sorted alphabetically

  let running = true;
  while (running) {
    printBanner();

    const choices: MenuChoice[] = entries.map((cmd, i) => ({
      name: `${(i + 1).toString().padStart(2)}. ${cmd.signature.padEnd(26)} ${cmd.description}`,
      value: cmd.signature,
      short: cmd.signature,
    }));

    choices.push(
      { name: `${"─".repeat(52)}`, value: "__separator__" },
      {
        name: `${(entries.length + 1).toString().padStart(2)}. ${"help".padEnd(26)} Show all commands with usage info`,
        value: "__help__",
        short: "help",
      },
      {
        name: `${(entries.length + 2).toString().padStart(2)}. ${"exit".padEnd(26)} Exit the program`,
        value: "__exit__",
        short: "exit",
      }
    );

    const selected = await selectInput("What would you like to do?", choices);

    if (selected === "__exit__") {
      logger.info("Goodbye!");
      running = false;
      break;
    }

    if (selected === "__help__") {
      printHelp(commands);
      const again = await booleanInput("Return to main menu?");
      if (!again) {
        logger.info("Goodbye!");
        running = false;
        break;
      }
      continue;
    }

    if (selected === "__separator__") {
      continue; // shouldn't happen with inquirer list, but just in case
    }

    const commandDetail = commands[selected];
    if (commandDetail) {
      console.log(""); // spacer
      try {
        await runCommand(commandDetail.path, {});
      } catch (err) {
        logger.error("Command failed:");
        console.error(err);
      }
      console.log(""); // spacer
      const again = await booleanInput("Return to main menu?");
      if (!again) {
        logger.info("Goodbye!");
        running = false;
        break;
      }
    }
  }
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

  // ── Handle --version / -v / version ──
  if (
    scriptSignature === "--version" ||
    scriptSignature === "-v" ||
    scriptSignature === "version"
  ) {
    console.log(`telegram-channel-downloader v${getVersion()}`);
    return;
  }

  // ── Handle help ──
  if (scriptSignature === "help" || scriptSignature === "--help" || scriptSignature === "-h") {
    printHelp(availableCommands);
    return;
  }

  if (scriptSignature) {
    const commandDetail = availableCommands[scriptSignature];
    if (commandDetail) {
      await runCommand(commandDetail.path, options);
    } else {
      logger.error(`Unknown command: "${scriptSignature}"`);
      console.log("");
      const similar = findSimilarCommands(scriptSignature, availableCommands);
      if (similar.length > 0) {
        logger.info("Did you mean:");
        for (const sig of similar) {
          console.log(`  ${sig}`);
        }
        console.log("");
      }
      printHelp(availableCommands);
      process.exit(1);
    }
  } else {
    // No command given — show interactive menu
    await showInteractiveMenu(availableCommands);
  }
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
