import type { DomainEvent } from '@/events';
import type { ProjectorRegistry } from '@/events/projectors/projectorRegistry';
import type { RealtimeHeartbeat } from '@/realtime/heartbeat/heartbeat';

export function createStorageWriteFailureChaos() {
  return {
    write() {
      throw new Error('storage.write.failure');
    },
  };
}

export function createStorageReadCorruptionChaos() {
  return {
    read() {
      return '{"mutations":[{"corrupted":true}]';
    },
  };
}

export function createNetworkDropDuringProcessingChaos() {
  return {
    drop() {
      return { isOnline: false, isInternetReachable: false } as const;
    },
  };
}

export function createProcessorFailureChaos() {
  return {
    process() {
      throw new Error('processor.failure');
    },
  };
}

export function createHeartbeatTimeoutChaos(heartbeat: RealtimeHeartbeat) {
  return {
    trigger() {
      return heartbeat.checkTimeout();
    },
  };
}

export function createInvalidEventPayloadChaos() {
  return {
    create() {
      return {
        eventId: 'invalid-event',
        aggregateId: '',
        aggregateType: 'ride',
        eventType: 'ride.requested',
        eventVersion: 1,
        sequenceNumber: 1,
        timestamp: 'bad-timestamp',
        correlationId: 'correlation-invalid',
        causationId: null,
        producer: 'test',
        payload: null,
      } satisfies DomainEvent;
    },
  };
}

export function createProjectorExceptionChaos(projectors: ProjectorRegistry) {
  return {
    register() {
      return projectors.register({
        id: 'chaos.projector',
        eventTypes: '*',
        project: () => {
          throw new Error('projector.failure');
        },
      });
    },
  };
}

export function createReplayFailureChaos() {
  return {
    replay() {
      throw new Error('replay.failure');
    },
  };
}
