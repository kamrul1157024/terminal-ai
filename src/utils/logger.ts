import chalk from "chalk";
// Use the CommonJS require syntax to avoid TypeScript issues
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked with the terminal renderer
// @ts-expect-error marked-terminal is not typed
marked.use(markedTerminal());

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
  showLogLevel?: boolean;
  parseMarkdown?: boolean;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private colors: boolean;
  private showLogLevel: boolean;
  private parseMarkdown: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.prefix = options.prefix || "";
    this.timestamp =
      options.timestamp !== undefined ? options.timestamp : false;
    this.colors = options.colors !== undefined ? options.colors : true;
    this.showLogLevel =
      options.showLogLevel !== undefined ? options.showLogLevel : false;
    this.parseMarkdown =
      options.parseMarkdown !== undefined ? options.parseMarkdown : false;
  }

  private formatMessage(level: LogLevel, message: string): string {
    let formattedMessage = "";

    // Add timestamp if enabled
    if (this.timestamp) {
      const now = new Date();
      const timestamp = now.toISOString();
      formattedMessage += `[${timestamp}] `;
    }

    // Add prefix if set
    if (this.prefix) {
      formattedMessage += `[${this.prefix}] `;
    }

    // Add log level if enabled
    if (this.showLogLevel) {
      formattedMessage += `[${level}] `;
    }

    // Add the actual message
    formattedMessage += message;

    return formattedMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formattedMessage = this.formatMessage(LogLevel.DEBUG, message);
      if (this.colors) {
        console.log(chalk.gray(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage(LogLevel.INFO, message);
      if (this.colors) {
        console.log(chalk.blue(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formattedMessage = this.formatMessage(LogLevel.WARN, message);
      if (this.colors) {
        console.log(chalk.yellow(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  error(message: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage(LogLevel.ERROR, message);
      if (this.colors) {
        console.error(chalk.red(formattedMessage));
      } else {
        console.error(formattedMessage);
      }
    }
  }

  success(message: string): void {
    if (this.shouldLog(LogLevel.SUCCESS)) {
      const formattedMessage = this.formatMessage(LogLevel.SUCCESS, message);
      if (this.colors) {
        console.log(chalk.green(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  // Special method for command execution
  command(command: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      let message = `Executing: ${command}`;

      if (this.parseMarkdown) {
        message = `\`\`\`bash\n${command}\n\`\`\``;
        // Parse markdown for command
        console.log(marked(message));
      } else {
        const formattedMessage = this.formatMessage(LogLevel.INFO, message);
        if (this.colors) {
          console.log(chalk.cyan(formattedMessage));
        } else {
          console.log(formattedMessage);
        }
      }
    }
  }

  // Special method for user input
  userInput(input: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage(
        LogLevel.INFO,
        `You: ${input}`,
      );
      if (this.colors) {
        console.log(chalk.green(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  // Special method for AI response
  aiResponse(response: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (this.parseMarkdown) {
        // Parse markdown for AI responses
        console.log(marked(response));
      } else {
        const formattedMessage = this.formatMessage(
          LogLevel.INFO,
          `AI: ${response}`,
        );
        if (this.colors) {
          console.log(chalk.yellow(formattedMessage));
        } else {
          console.log(formattedMessage);
        }
      }
    }
  }
}

// Create a default logger instance
export const logger = new Logger();

// Export a function to create a new logger with custom options
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
