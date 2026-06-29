export type PendingMutationStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'completed';

export type PendingMutationPriority = 'critical' | 'high' | 'normal' | 'low';

export type CollapseStrategy = 'none' | 'replace-latest';

export interface PendingMutation<TPayload = unknown> {
  id: string;
  idempotencyKey: string;
  type: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  nextRetryAt: string | null;
  priority: PendingMutationPriority;
  status: PendingMutationStatus;
  expiresAt: string | null;
  lastError: string | null;
  collapseKey?: string;
  collapseStrategy?: CollapseStrategy;
}

export interface EnqueueMutationInput<TPayload = unknown> {
  type: string;
  payload: TPayload;
  id?: string;
  idempotencyKey?: string;
  createdAt?: string;
  priority?: PendingMutationPriority;
  expiresAt?: string | null;
  collapseKey?: string;
  collapseStrategy?: CollapseStrategy;
}

export interface OfflineQueueState {
  mutations: PendingMutation[];
  paused: boolean;
  processing: boolean;
}

export interface OfflineNetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

export interface OfflineQueueSnapshot extends OfflineQueueState {
  size: number;
  retryCount: number;
  oldestMutation: PendingMutation | null;
  network: OfflineNetworkState;
}

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetryCount: number;
  jitterRatio: number;
}

export interface ProcessMutationResult {
  ok: boolean;
  error?: string;
}

export type MutationProcessor = (mutation: PendingMutation) => Promise<ProcessMutationResult | void>;

export interface OfflineQueueOptions {
  now?: () => Date;
  idFactory?: () => string;
  retryPolicy?: Partial<RetryPolicy>;
  processor?: MutationProcessor;
}
