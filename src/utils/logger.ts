import type { LogLevel, LogOptions } from "../types/index.js";

const consoleColors: Record<string, string> = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  reset: "\x1b[0m",
};

class Logger {
  private readonly logLevels: Record<string, LogLevel> = {
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
    SUCCESS: "SUCCESS",
  };

  private readonly colors: Record<LogLevel, string> = {
    INFO: consoleColors.blue,
    WARN: consoleColors.yellow,
    ERROR: consoleColors.red,
    SUCCESS: consoleColors.green,
  };

  private readonly icons: Record<LogLevel, string> = {
    INFO: "[i]",
    WARN: "[!]",
    ERROR: "[x]",
    SUCCESS: "[+]",
  };

  log(
    message: string,
    level: LogLevel = this.logLevels.INFO,
    options: LogOptions = {}
  ): void {
    const { showTimestamp = false, showLevel = false, showIcon = true } = options;
    const timestamp = new Date().toLocaleTimeString();
    let coloredMessage = this.colors[level] || "";

    if (showIcon) {
      coloredMessage += `${this.icons[level] || ""}  `;
    }
    if (showTimestamp) {
      coloredMessage += `[${timestamp}] `;
    }
    if (showLevel) {
      coloredMessage += `[${level}] `;
    }

    coloredMessage += message + consoleColors.reset;
    console.log(coloredMessage);
  }

  info(message: string, options?: LogOptions): void {
    this.log(message, this.logLevels.INFO, options);
  }

  warn(message: string, options?: LogOptions): void {
    this.log(message, this.logLevels.WARN, options);
  }

  error(message: string, options?: LogOptions): void {
    this.log(message, this.logLevels.ERROR, options);
  }

  success(message: string, options?: LogOptions): void {
    this.log(message, this.logLevels.SUCCESS, options);
  }

  table(data: unknown[]): void {
    console.table(data);
  }
}

const logger = new Logger();
export default logger;
