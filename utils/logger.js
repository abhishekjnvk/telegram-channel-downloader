const consoleColors = {
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
  constructor() {
    this.logLevels = {
      INFO: "INFO",
      WARN: "WARN",
      ERROR: "ERROR",
      SUCCESS: "SUCCESS",
    };

    this.colors = {
      INFO: consoleColors.blue,
      WARN: consoleColors.yellow,
      ERROR: consoleColors.red,
      SUCCESS: consoleColors.green,
    };

    this.icons = {
      INFO: "ℹ️",
      WARN: "⚠️",
      ERROR: "❌",
      SUCCESS: "✅",
    };

  }

  log(
    message,
    level = this.logLevels.INFO,
    { showTimestamp, showLevel, showIcon } = {}
  ) {
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

    coloredMessage += message;
    console.log(coloredMessage);
  }

  info(message, options) {
    this.log(message, this.logLevels.INFO, options);
  }

  warn(message, options) {
    this.log(message, this.logLevels.WARN, options);
  }

  error(message, options) {
    this.log(message, this.logLevels.ERROR, options);
  }

  success(message, options) {
    this.log(message, this.logLevels.SUCCESS, options);
  }


  table(data) {
    console.table(data);
  }
}


const logger = new Logger();
module.exports = logger;