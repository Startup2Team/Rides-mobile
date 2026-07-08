export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheck {
  name: string;
  check(): HealthStatus | Promise<HealthStatus>;
}

export interface HealthSnapshot {
  status: HealthStatus;
  checks: Record<string, HealthStatus>;
  checkedAt: string;
}

function rollup(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.every(status => status === 'healthy')) return 'healthy';
  return 'unknown';
}

export class HealthMonitor {
  private readonly checks = new Map<string, HealthCheck>();
  private readonly now: () => Date;
  private snapshot: HealthSnapshot;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
    this.snapshot = { status: 'unknown', checks: {}, checkedAt: this.now().toISOString() };
  }

  register(check: HealthCheck) {
    this.checks.set(check.name, check);
    return () => this.checks.delete(check.name);
  }

  async run() {
    const checks: Record<string, HealthStatus> = {};
    for (const check of this.checks.values()) {
      try {
        checks[check.name] = await check.check();
      } catch {
        checks[check.name] = 'unhealthy';
      }
    }
    this.snapshot = {
      status: rollup(Object.values(checks)),
      checks,
      checkedAt: this.now().toISOString(),
    };
    return this.snapshot;
  }

  getSnapshot() {
    return this.snapshot;
  }
}
