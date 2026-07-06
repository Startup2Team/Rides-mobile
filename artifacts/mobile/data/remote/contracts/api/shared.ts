import type { RideActorRole } from '@/domains/ride/commands';

export interface ApiIdempotencyMetadata {
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: RideActorRole;
  clientTimestamp: string;
}

export interface ApiPaginationRequest {
  cursor?: string | null;
  limit?: number;
}

export interface ApiPaginationResponse {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiErrorDto {
  code:
    | 'backend_unavailable'
    | 'unauthorized'
    | 'forbidden'
    | 'conflict'
    | 'validation_failed'
    | 'rate_limited'
    | 'server_error'
    | 'timeout'
    | 'offline'
    | 'serialization_failed'
    | 'not_implemented';
  message: string;
  retryable?: boolean;
  requestId?: string | null;
  details?: Record<string, unknown> | null;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId?: string | null;
  version: string;
}

export const ApiIdempotencyMetadata = {} as ApiIdempotencyMetadata;
