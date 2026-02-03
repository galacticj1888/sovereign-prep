/**
 * Logger utility
 * Simple console logger with levels and timestamps
 */

import { config, type LogLevel } from '../config.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = formatTimestamp();
  const color = LOG_COLORS[level];
  const levelLabel = level.toUpperCase().padEnd(5);
  return `${color}[${timestamp}] ${levelLabel}${RESET} ${message}`;
}

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(prefix: string): Logger;
}

export const logger: Logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message), ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), ...args);
    }
  },

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return {
      debug: (msg: string, ...args: unknown[]) => logger.debug(`[${prefix}] ${msg}`, ...args),
      info: (msg: string, ...args: unknown[]) => logger.info(`[${prefix}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => logger.warn(`[${prefix}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => logger.error(`[${prefix}] ${msg}`, ...args),
      child: (childPrefix: string) => logger.child(`${prefix}:${childPrefix}`),
    };
  },
};
