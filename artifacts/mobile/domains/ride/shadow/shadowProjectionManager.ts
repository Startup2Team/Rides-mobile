import type { DomainEvent, InMemoryEventStore, ProjectorRegistry } from '@/events';
import { domainEventStore, domainProjectors } from '@/events/store/singleton';
import { rideEventTypes, type RideLifecycleEvent } from '../events';
import { projectActiveRideEvent, projectDriverRequestEvent, projectRideHistoryEvent } from '../projectors';
import type { RideProviderSnapshot, RideShadowSnapshot, RideShadowTelemetry } from './shadowTypes';
import { ENABLE_SHADOW_RIDE_PROJECTION } from './shadowTypes';
import { compareRideShadow } from './shadowComparator';
import { ObservabilityRideShadowTelemetry } from './shadowMetrics';

const rideEventTypeValues = new Set<string>(Object.values(rideEventTypes));

export interface RideShadowProjectionManagerOptions {
  enabled?: boolean;
  projectors?: ProjectorRegistry;
  eventStore?: InMemoryEventStore;
  telemetry?: RideShadowTelemetry;
}

function isRideLifecycleEvent(event: DomainEvent): event is RideLifecycleEvent {
  return event.aggregateType === 'ride' && rideEventTypeValues.has(event.eventType);
}

export class RideShadowProjectionManager {
  private readonly enabled: boolean;
  private readonly projectors: ProjectorRegistry;
  private readonly eventStore: InMemoryEventStore;
  private readonly telemetry: RideShadowTelemetry;
  private unregister: Array<() => void> = [];
  private snapshot: RideShadowSnapshot = {
    enabled: false,
    running: false,
    projectionStatus: 'idle',
    lastProcessedEvent: null,
    comparisonCount: 0,
    mismatchCount: 0,
    lastComparison: null,
    shadowActiveRide: null,
    shadowRideHistory: [],
    shadowDriverRequests: [],
  };

  constructor(options: RideShadowProjectionManagerOptions = {}) {
    this.enabled = options.enabled ?? ENABLE_SHADOW_RIDE_PROJECTION;
    this.projectors = options.projectors ?? domainProjectors;
    this.eventStore = options.eventStore ?? domainEventStore;
    this.telemetry = options.telemetry ?? new ObservabilityRideShadowTelemetry();
    this.snapshot = { ...this.snapshot, enabled: this.enabled };
  }

  start() {
    if (!this.enabled || this.snapshot.running) return this.getSnapshot();
    this.unregister = [
      this.projectors.register({
        id: 'ride.shadow.activeRideProjector',
        eventTypes: '*',
        project: event => {
          this.processActiveRideEvent(event);
        },
      }),
      this.projectors.register({
        id: 'ride.shadow.rideHistoryProjector',
        eventTypes: '*',
        project: event => {
          this.processRideHistoryEvent(event);
        },
      }),
      this.projectors.register({
        id: 'ride.shadow.driverRequestProjector',
        eventTypes: '*',
        project: event => {
          this.processDriverRequestEvent(event);
        },
      }),
    ];
    this.snapshot = { ...this.snapshot, running: true, projectionStatus: 'running' };
    return this.getSnapshot();
  }

  stop() {
    this.unregister.forEach(unregister => unregister());
    this.unregister = [];
    this.snapshot = { ...this.snapshot, running: false, projectionStatus: 'stopped' };
    return this.getSnapshot();
  }

  reset() {
    this.snapshot = {
      ...this.snapshot,
      projectionStatus: this.snapshot.running ? 'running' : 'idle',
      lastProcessedEvent: null,
      comparisonCount: 0,
      mismatchCount: 0,
      lastComparison: null,
      shadowActiveRide: null,
      shadowRideHistory: [],
      shadowDriverRequests: [],
    };
    return this.getSnapshot();
  }

  processEvent(event: DomainEvent) {
    if (!this.enabled || !isRideLifecycleEvent(event)) return this.getSnapshot();
    this.snapshot = {
      ...this.snapshot,
      projectionStatus: 'running',
      lastProcessedEvent: event,
      shadowActiveRide: projectActiveRideEvent(this.snapshot.shadowActiveRide, event),
      shadowRideHistory: projectRideHistoryEvent(this.snapshot.shadowRideHistory, event),
      shadowDriverRequests: projectDriverRequestEvent(this.snapshot.shadowDriverRequests, event),
    };
    this.telemetry.recordProjection(event);
    return this.getSnapshot();
  }

  processActiveRideEvent(event: DomainEvent) {
    if (!this.enabled || !isRideLifecycleEvent(event)) return this.getSnapshot();
    this.snapshot = {
      ...this.snapshot,
      projectionStatus: 'running',
      lastProcessedEvent: event,
      shadowActiveRide: projectActiveRideEvent(this.snapshot.shadowActiveRide, event),
    };
    this.telemetry.recordProjection(event);
    return this.getSnapshot();
  }

  processRideHistoryEvent(event: DomainEvent) {
    if (!this.enabled || !isRideLifecycleEvent(event)) return this.getSnapshot();
    this.snapshot = {
      ...this.snapshot,
      projectionStatus: 'running',
      lastProcessedEvent: event,
      shadowRideHistory: projectRideHistoryEvent(this.snapshot.shadowRideHistory, event),
    };
    this.telemetry.recordProjection(event);
    return this.getSnapshot();
  }

  processDriverRequestEvent(event: DomainEvent) {
    if (!this.enabled || !isRideLifecycleEvent(event)) return this.getSnapshot();
    this.snapshot = {
      ...this.snapshot,
      projectionStatus: 'running',
      lastProcessedEvent: event,
      shadowDriverRequests: projectDriverRequestEvent(this.snapshot.shadowDriverRequests, event),
    };
    this.telemetry.recordProjection(event);
    return this.getSnapshot();
  }

  replay(production?: RideProviderSnapshot) {
    if (!this.enabled) return this.getSnapshot();
    const events = this.eventStore.readGlobalStream().filter(isRideLifecycleEvent);
    this.reset();
    this.snapshot = { ...this.snapshot, projectionStatus: 'replaying' };
    events.forEach(event => this.processEvent(event));
    this.telemetry.recordReplay(events.length);
    this.snapshot = { ...this.snapshot, projectionStatus: this.snapshot.running ? 'running' : 'idle' };
    if (production) {
      this.compareWithProduction(production);
    }
    return this.getSnapshot();
  }

  compareWithProduction(production: RideProviderSnapshot) {
    if (!this.enabled) return this.getSnapshot().lastComparison;
    const comparison = compareRideShadow(production, this.snapshot, this.snapshot.lastProcessedEvent);
    this.snapshot = {
      ...this.snapshot,
      comparisonCount: this.snapshot.comparisonCount + 1,
      mismatchCount: this.snapshot.mismatchCount + (comparison.mismatch ? 1 : 0),
      lastComparison: comparison,
    };
    if (comparison.mismatch) {
      this.telemetry.recordMismatch(comparison.mismatch);
    }
    return comparison;
  }

  getSnapshot(): RideShadowSnapshot {
    return {
      ...this.snapshot,
      shadowRideHistory: [...this.snapshot.shadowRideHistory],
      shadowDriverRequests: [...this.snapshot.shadowDriverRequests],
    };
  }
}

export const rideShadowProjectionManager = new RideShadowProjectionManager();
