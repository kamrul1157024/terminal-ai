import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private colors: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.prefix = options.prefix || '';
    this.timestamp = options.timestamp !== undefined ? options.timestamp : true;
    this.colors = options.colors !== undefined ? options.colors : true;
  }

  private formatMessage(level: LogLevel, message: string): string {
    let formattedMessage = '';
    
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
    
    // Add log level
    formattedMessage += `[${level}] `;
    
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
      const formattedMessage = this.formatMessage(LogLevel.INFO, `Executing: ${command}`);
      if (this.colors) {
        console.log(chalk.cyan(formattedMessage));
      } else {
        console.log(formattedMessage);
      }
    }
  }

  // Special method for user input
  userInput(input: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage(LogLevel.INFO, `You: ${input}`);
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
      const formattedMessage = this.formatMessage(LogLevel.INFO, `AI: ${response}`);
      if (this.colors) {
        console.log(chalk.yellow(formattedMessage));
      } else {
        console.log(formattedMessage);
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