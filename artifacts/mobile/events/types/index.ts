export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  sequenceNumber: number;
  timestamp: string;
  correlationId: string;
  causationId: string | null;
  producer: string;
  payload: TPayload;
}

export interface DomainEventEnvelope<TPayload = unknown> {
  event: DomainEvent<TPayload>;
  archivedAt?: string | null;
}

export interface EventValidationIssue {
  code:
    | 'missing_metadata'
    | 'invalid_version'
    | 'duplicate_event'
    | 'invalid_sequence'
    | 'invalid_timestamp';
  message: string;
  eventId?: string;
}

export interface EventValidationResult {
  ok: boolean;
  issues: EventValidationIssue[];
}

export interface EventPlatformSnapshot {
  eventCount: number;
  projectorCount: number;
  lastEvent: DomainEvent | null;
  deadLetterCount: number;
  replayStatus: ReplayStatus;
}

export type ReplayStatus = 'idle' | 'running' | 'completed' | 'failed';
