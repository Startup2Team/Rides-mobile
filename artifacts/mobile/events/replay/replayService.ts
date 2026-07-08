import type { InMemoryEventStore } from '../store/inMemoryEventStore';
import type { ProjectorRegistry } from '../projectors/projectorRegistry';
import type { ReplayStatus } from '../types';

export interface ReplaySnapshot {
  status: ReplayStatus;
  replayedCount: number;
  lastError: string | null;
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class EventReplayService {
  private status: ReplayStatus = 'idle';
  private replayedCount = 0;
  private lastError: string | null = null;
  private readonly store: InMemoryEventStore;
  private readonly projectors: ProjectorRegistry;

  constructor(store: InMemoryEventStore, projectors: ProjectorRegistry) {
    this.store = store;
    this.projectors = projectors;
  }

  async replayAggregate(aggregateType: string, aggregateId: string) {
    return this.replay(this.store.readAggregateStream(aggregateType, aggregateId));
  }

  async replayEventType(eventType: string) {
    return this.replay(this.store.readEventTypeStream(eventType));
  }

  async replayGlobal() {
    return this.replay(this.store.readGlobalStream());
  }

  getSnapshot(): ReplaySnapshot {
    return {
      status: this.status,
      replayedCount: this.replayedCount,
      lastError: this.lastError,
    };
  }

  private async replay(events: ReturnType<InMemoryEventStore['readGlobalStream']>) {
    this.status = 'running';
    this.replayedCount = 0;
    this.lastError = null;
    try {
      for (const event of events) {
        await this.projectors.project(event);
        this.replayedCount += 1;
      }
      this.status = 'completed';
      return this.replayedCount;
    } catch (error) {
      this.status = 'failed';
      this.lastError = serializeError(error);
      throw error;
    }
  }
}
