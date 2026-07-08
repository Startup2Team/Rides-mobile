import type { DomainEvent } from '../types';

export interface DomainProjector<TEvent extends DomainEvent = DomainEvent> {
  id: string;
  eventTypes: string[] | '*';
  project(event: TEvent): void | Promise<void>;
  reset?(): void | Promise<void>;
}

export interface ProjectorRegistrySnapshot {
  projectors: DomainProjector[];
  size: number;
}

export class ProjectorRegistry {
  private readonly projectors = new Map<string, DomainProjector>();

  register(projector: DomainProjector) {
    this.projectors.set(projector.id, projector);
    return () => this.unregister(projector.id);
  }

  unregister(id: string) {
    return this.projectors.delete(id);
  }

  getProjectorsForEvent(eventType: string) {
    return [...this.projectors.values()].filter(projector =>
      projector.eventTypes === '*' || projector.eventTypes.includes(eventType),
    );
  }

  async project(event: DomainEvent) {
    const projectors = this.getProjectorsForEvent(event.eventType);
    await Promise.all(projectors.map(projector => projector.project(event)));
  }

  async resetAll() {
    await Promise.all([...this.projectors.values()].map(projector => projector.reset?.()));
  }

  getSnapshot(): ProjectorRegistrySnapshot {
    const projectors = [...this.projectors.values()];
    return { projectors, size: projectors.length };
  }
}
