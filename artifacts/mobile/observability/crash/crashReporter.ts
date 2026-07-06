export interface CrashReport {
  errorName: string;
  message: string;
  fatal: boolean;
  context: Record<string, unknown>;
  timestamp: string;
}

export interface CrashExporter {
  export(report: CrashReport): void | Promise<void>;
}

export class CrashReporter {
  private reports: CrashReport[] = [];
  private readonly exporter?: CrashExporter;
  private readonly now: () => Date;

  constructor(options: { exporter?: CrashExporter; now?: () => Date } = {}) {
    this.exporter = options.exporter;
    this.now = options.now ?? (() => new Date());
  }

  report(error: unknown, context: Record<string, unknown> = {}, fatal = false) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const report: CrashReport = {
      errorName: normalized.name,
      message: normalized.message,
      fatal,
      context,
      timestamp: this.now().toISOString(),
    };
    this.reports = [...this.reports, report];
    void this.exporter?.export(report);
    return report;
  }

  getReports() {
    return [...this.reports];
  }

  clear() {
    this.reports = [];
  }
}
