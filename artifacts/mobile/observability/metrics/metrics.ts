export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface MetricPoint {
  name: string;
  type: MetricType;
  value: number;
  tags: Record<string, string>;
  timestamp: string;
}

export class MetricsRegistry {
  private points: MetricPoint[] = [];
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  counter(name: string, value = 1, tags: Record<string, string> = {}) {
    return this.record({ name, type: 'counter', value, tags, timestamp: this.now().toISOString() });
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}) {
    return this.record({ name, type: 'gauge', value, tags, timestamp: this.now().toISOString() });
  }

  histogram(name: string, value: number, tags: Record<string, string> = {}) {
    return this.record({ name, type: 'histogram', value, tags, timestamp: this.now().toISOString() });
  }

  timer(name: string, durationMs: number, tags: Record<string, string> = {}) {
    return this.record({ name, type: 'timer', value: durationMs, tags, timestamp: this.now().toISOString() });
  }

  time<T>(name: string, fn: () => T, tags: Record<string, string> = {}) {
    const startedAt = this.now().getTime();
    try {
      return fn();
    } finally {
      this.timer(name, Math.max(0, this.now().getTime() - startedAt), tags);
    }
  }

  async timeAsync<T>(name: string, fn: () => Promise<T>, tags: Record<string, string> = {}) {
    const startedAt = this.now().getTime();
    try {
      return await fn();
    } finally {
      this.timer(name, Math.max(0, this.now().getTime() - startedAt), tags);
    }
  }

  getPoints() {
    return [...this.points];
  }

  clear() {
    this.points = [];
  }

  private record(point: MetricPoint) {
    this.points = [...this.points, point];
    return point;
  }
}
