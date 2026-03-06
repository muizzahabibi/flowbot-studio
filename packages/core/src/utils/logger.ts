import { redactValue } from './redaction.js';

export interface FlowLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

class ConsoleFlowLogger implements FlowLogger {
  debug(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.debug(message, meta ? redactValue(meta) : undefined);
  }

  info(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.info(message, meta ? redactValue(meta) : undefined);
  }

  warn(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(message, meta ? redactValue(meta) : undefined);
  }

  error(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(message, meta ? redactValue(meta) : undefined);
  }
}

export const defaultLogger: FlowLogger = new ConsoleFlowLogger();
