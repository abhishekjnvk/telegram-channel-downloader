"use strict";
// example command script
// - node cli script-name --option1=value1 --option2=value2

const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const logger = require("./utils/logger");
const commandFile = path.join(__dirname, "./scripts");

const commandFiles = glob.sync([`${commandFile}/**/*.js`]);

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`
  );
  logger.error(`Promise: ${promise}`);
  if (reason instanceof Error) {
    logger.error(reason.stack);
  }
  process.exit(1);
});

/**
 * Loads command classes from the specified file paths and returns an object
 * mapping command signatures to their respective file paths.
 *
 * @param {string[]} commandFiles - An array of file paths to the command classes.
 * @returns {Object} An object where the keys are command signatures and the values are file paths.
 */
function loadCommands(commandFiles) {
  const commands = {};
  commandFiles.forEach((filePath) => {
    const CommandClass = require(filePath);
    const signature = path.basename(filePath, ".js");
    commands[signature] = {
      signature,
      path: filePath,
      description: CommandClass.description(),
    };
  });

  return commands;
}

/**
 * Logs the available commands to the console.
 * It iterates over the keys of the `availableCommands` object and logs each command signature.
 */
function logAvailableCommands() {
  logger.success("Available commands:");
  const allCommands = Object.values(loadCommands(commandFiles)).map(
    (command) => ({
      signature: command.signature,
      description: command.description,
    })
  );

  logger.table(allCommands);
}

/**
 * Parses command-line arguments into a script signature and options object.
 *
 * @param {string[]} argv - The array of command-line arguments.
 * @returns {Object} An object containing the script signature and options.
 * @returns {string} return.scriptSignature - The script signature (usually the command to run).
 * @returns {Object} return.options - An object containing key-value pairs of options.
 */
function parseArguments(argv) {
  const scriptSignature = argv[2];
  const args = argv.slice(3);
  const options = {};

  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      options[key] = value === undefined ? true : value;
    }
  });

  return { scriptSignature, options };
}

/**
 * Executes a command script located at the given path with the specified options.
 *
 * @param {string} commandPath - The path to the command script to execute.
 * @param {Object} options - The options to pass to the command script.
 * @returns {Promise<void>} - A promise that resolves when the command execution is complete.
 */

async function runCommand(commandPath, options) {
  const Command = require(commandPath);
  logger.info(`${path.basename(commandFile, '.js')} - ${Command.description()}`);

  if (options.help) {
    if (Command.help) {
      logger.info(Command.help());
    } else {
      logger.info("No help available for this command");
    }
  } else {
    const commandInstance = new Command();
    await commandInstance.handle(options);
  }
}

/**
 * Parses the command line arguments and extracts the script signature and options.
 *
 * @param {string[]} process.argv - The array of command line arguments passed to the script.
 * @returns {{ scriptSignature: string, options: object }} An object containing the script signature and options.
 */

(async () => {
  if (!fs.existsSync("./export")) {
    fs.mkdirSync("./export");
  }

  const availableCommands = loadCommands(commandFiles);
  const { scriptSignature, options } = parseArguments(process.argv);

  if (scriptSignature) {
    const commandDetail = availableCommands[scriptSignature];
    if (commandDetail) {
      await runCommand(commandDetail.path, options);
    }
  } else {
    logAvailableCommands();
  }
})();
