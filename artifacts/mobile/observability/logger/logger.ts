export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: Record<string, unknown>;
  error?: { name: string; message: string };
}

export interface LogExporter {
  export(log: StructuredLog): void | Promise<void>;
}

export interface LoggerOptions {
  exporter?: LogExporter;
  now?: () => Date;
  baseContext?: Record<string, unknown>;
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return { name: error.name, message: error.message };
}

export class Logger {
  private readonly exporter?: LogExporter;
  private readonly now: () => Date;
  private readonly baseContext: Record<string, unknown>;
  private logs: StructuredLog[] = [];

  constructor(options: LoggerOptions = {}) {
    this.exporter = options.exporter;
    this.now = options.now ?? (() => new Date());
    this.baseContext = options.baseContext ?? {};
  }

  debug(message: string, context: Record<string, unknown> = {}) {
    return this.write('debug', message, context);
  }

  info(message: string, context: Record<string, unknown> = {}) {
    return this.write('info', message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}) {
    return this.write('warn', message, context);
  }

  error(message: string, context: Record<string, unknown> = {}, error?: unknown) {
    return this.write('error', message, context, error);
  }

  fatal(message: string, context: Record<string, unknown> = {}, error?: unknown) {
    return this.write('fatal', message, context, error);
  }

  child(context: Record<string, unknown>) {
    return new Logger({
      exporter: this.exporter,
      now: this.now,
      baseContext: { ...this.baseContext, ...context },
    });
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }

  private write(level: LogLevel, message: string, context: Record<string, unknown>, error?: unknown) {
    const log: StructuredLog = {
      level,
      message,
      timestamp: this.now().toISOString(),
      context: { ...this.baseContext, ...context },
      error: serializeError(error),
    };
    this.logs = [...this.logs, log];
    void this.exporter?.export(log);
    return log;
  }
}
