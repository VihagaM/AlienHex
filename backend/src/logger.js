import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * LogHub keeps a ring buffer, appends entries to a text file, and streams each
 * new entry to every connected dashboard through Socket.io.
 */
const logFilePath = fileURLToPath(new URL('../logs.txt', import.meta.url));
const COLORS = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  message: '\x1b[90m',
  command: '\x1b[35m',
};

class LogHub {
  constructor(maxEntries = 300) {
    this.maxEntries = maxEntries;
    this.buffer = [];
    this.io = null;
    this.counter = 0;
    this.fileStream = createWriteStream(logFilePath, { flags: 'a' });
    this.fileStream.on('error', (err) => {
      console.error(`Could not write log file ${logFilePath}: ${err.message}`);
    });
  }

  attach(io) {
    this.io = io;
  }

  history() {
    return this.buffer;
  }

  add(level, message) {
    const entry = {
      id: ++this.counter,
      ts: new Date().toISOString(),
      level,
      message: String(message),
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) this.buffer.shift();

    const color = COLORS[level] || '';
    console.log(`${color}[${entry.ts.slice(11, 19)}] ${level.toUpperCase().padEnd(7)}\x1b[0m ${entry.message}`);

    this.fileStream.write(`[${entry.ts}] ${level.toUpperCase()} ${entry.message}\n`);
    this.io?.emit('log', entry);
    return entry;
  }
}

export const logHub = new LogHub();

export const log = {
  info: (msg) => logHub.add('info', msg),
  success: (msg) => logHub.add('success', msg),
  warn: (msg) => logHub.add('warn', msg),
  error: (msg) => logHub.add('error', msg),
  message: (msg) => logHub.add('message', msg),
  command: (msg) => logHub.add('command', msg),
};
