import { createListenerSet } from '@/state/storeUtils';
import { observability } from '@/observability/context/observabilityContext';
import { observeMutationEngine } from '@/observability/performance/instrumentation';
import { DEFAULT_RETRY_POLICY, canRetry, getNextRetryAt, isExpired, isRetryDue } from '../retry/backoff';
import { loadOfflineQueueState, saveOfflineQueueState } from '../storage/offlineQueueStorage';
import type {
  EnqueueMutationInput,
  MutationProcessor,
  OfflineNetworkState,
  OfflineQueueOptions,
  OfflineQueueSnapshot,
  OfflineQueueState,
  PendingMutation,
  PendingMutationPriority,
  RetryPolicy,
} from '../types';

const priorityRank: Record<PendingMutationPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function defaultIdFactory() {
  return `mutation_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createIdempotencyKey(type: string, id: string) {
  return `${type}:${id}`;
}

function sortMutations(mutations: PendingMutation[]) {
  return [...mutations].sort((a, b) => {
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    if (priority !== 0) return priority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function activeMutations(mutations: PendingMutation[]) {
  return mutations.filter(mutation => !['cancelled', 'expired', 'completed'].includes(mutation.status));
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class OfflineMutationQueue {
  private state: OfflineQueueState = { mutations: [], paused: false, processing: false };
  private network: OfflineNetworkState = { isOnline: true, isInternetReachable: true };
  private readonly listeners = createListenerSet<OfflineQueueSnapshot>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly retryPolicy: RetryPolicy;
  private readonly processor: MutationProcessor;

  constructor(options: OfflineQueueOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.retryPolicy };
    this.processor = options.processor ?? (async () => undefined);
  }

  subscribe(listener: (snapshot: OfflineQueueSnapshot) => void) {
    return this.listeners.add(listener);
  }

  getSnapshot(): OfflineQueueSnapshot {
    const mutations = this.getOrderedMutations();
    return {
      ...this.state,
      mutations,
      size: activeMutations(mutations).length,
      retryCount: mutations.reduce((total, mutation) => total + mutation.retryCount, 0),
      oldestMutation: mutations[0] ?? null,
      network: this.network,
    };
  }

  async restore() {
    this.state = await loadOfflineQueueState();
    this.state.processing = false;
    this.notify();
    return this.getSnapshot();
  }

  setNetworkState(network: OfflineNetworkState) {
    this.network = network;
    if (!network.isOnline) {
      this.state = { ...this.state, paused: true, processing: false };
    } else if (this.state.paused) {
      this.state = { ...this.state, paused: false };
    }
    void this.persist();
    this.notify();
  }

  async enqueue<TPayload>(input: EnqueueMutationInput<TPayload>) {
    observeMutationEngine('enqueue');
    const createdAt = input.createdAt ?? this.now().toISOString();
    const id = input.id ?? this.idFactory();
    const mutation: PendingMutation<TPayload> = {
      id,
      idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(input.type, id),
      type: input.type,
      payload: input.payload,
      createdAt,
      updatedAt: createdAt,
      retryCount: 0,
      nextRetryAt: null,
      priority: input.priority ?? 'normal',
      status: this.state.paused ? 'paused' : 'pending',
      expiresAt: input.expiresAt ?? null,
      lastError: null,
      collapseKey: input.collapseKey,
      collapseStrategy: input.collapseStrategy ?? 'none',
    };

    const shouldCollapse = mutation.collapseStrategy === 'replace-latest' && mutation.collapseKey;
    const mutations = shouldCollapse
      ? this.state.mutations.filter(item => item.collapseKey !== mutation.collapseKey || item.status === 'processing')
      : this.state.mutations;
    this.state = { ...this.state, mutations: sortMutations([...mutations, mutation]) };
    await this.persistAndNotify();
    return mutation;
  }

  async dequeue() {
    const next = this.peek();
    if (!next) return null;
    this.state = { ...this.state, mutations: this.state.mutations.filter(mutation => mutation.id !== next.id) };
    await this.persistAndNotify();
    return next;
  }

  peek() {
    const now = this.now();
    return this.getOrderedMutations().find(mutation =>
      ['pending', 'failed', 'paused'].includes(mutation.status) &&
      !isExpired(mutation, now) &&
      isRetryDue(mutation, now)
    ) ?? null;
  }

  async cancel(id: string) {
    await this.replace(id, mutation => ({ ...mutation, status: 'cancelled', updatedAt: this.now().toISOString() }));
  }

  async replace(id: string, next: PendingMutation | ((current: PendingMutation) => PendingMutation)) {
    this.state = {
      ...this.state,
      mutations: this.state.mutations.map(mutation => {
        if (mutation.id !== id) return mutation;
        return typeof next === 'function' ? next(mutation) : next;
      }),
    };
    await this.persistAndNotify();
  }

  async clear() {
    this.state = { mutations: [], paused: this.state.paused, processing: false };
    await this.persistAndNotify();
  }

  size() {
    return this.getSnapshot().size;
  }

  async pause() {
    this.state = {
      ...this.state,
      paused: true,
      processing: false,
      mutations: this.state.mutations.map(mutation =>
        mutation.status === 'pending' ? { ...mutation, status: 'paused', updatedAt: this.now().toISOString() } : mutation,
      ),
    };
    await this.persistAndNotify();
  }

  async resume() {
    if (!this.network.isOnline) return;
    this.state = {
      ...this.state,
      paused: false,
      mutations: this.state.mutations.map(mutation =>
        mutation.status === 'paused' ? { ...mutation, status: 'pending', updatedAt: this.now().toISOString() } : mutation,
      ),
    };
    await this.persistAndNotify();
  }

  async process() {
    observeMutationEngine('process');
    if (this.state.paused || !this.network.isOnline || this.state.processing) return null;
    await this.expireDueMutations();
    const mutation = this.peek();
    if (!mutation) return null;

    if (isExpired(mutation, this.now())) {
      await this.replace(mutation.id, current => ({ ...current, status: 'expired', updatedAt: this.now().toISOString() }));
      return null;
    }

    this.state = {
      ...this.state,
      processing: true,
      mutations: this.state.mutations.map(item =>
        item.id === mutation.id ? { ...item, status: 'processing', updatedAt: this.now().toISOString() } : item,
      ),
    };
    this.notify();

    try {
      const result = await this.processor(mutation);
      if (result?.ok === false) throw new Error(result.error ?? 'Mutation failed');
      observeMutationEngine('process', 'completed');
      this.state = {
        ...this.state,
        processing: false,
        mutations: this.state.mutations.filter(item => item.id !== mutation.id),
      };
      await this.persistAndNotify();
      return mutation;
    } catch (error) {
      observeMutationEngine('process', 'failed');
      observability.logger.warn('offline.mutation.failed', { mutationType: mutation.type });
      const retryCount = mutation.retryCount + 1;
      const now = this.now();
      const status = canRetry({ ...mutation, retryCount }, this.retryPolicy) ? 'failed' : 'expired';
      this.state = {
        ...this.state,
        processing: false,
        mutations: this.state.mutations.map(item => item.id === mutation.id
          ? {
              ...item,
              status,
              retryCount,
              updatedAt: now.toISOString(),
              nextRetryAt: status === 'failed' ? getNextRetryAt(now, retryCount, this.retryPolicy) : null,
              lastError: serializeError(error),
            }
          : item),
      };
      await this.persistAndNotify();
      return null;
    }
  }

  private getOrderedMutations() {
    return sortMutations(activeMutations(this.state.mutations));
  }

  private async expireDueMutations() {
    const now = this.now();
    const next = this.state.mutations.map(mutation => (
      isExpired(mutation, now)
        ? { ...mutation, status: 'expired' as const, updatedAt: now.toISOString() }
        : mutation
    ));
    if (next.some((mutation, index) => mutation !== this.state.mutations[index])) {
      this.state = { ...this.state, mutations: next };
      await this.persistAndNotify();
    }
  }

  private async persistAndNotify() {
    await this.persist();
    this.notify();
  }

  private async persist() {
    await saveOfflineQueueState(this.state);
  }

  private notify() {
    this.listeners.notify(this.getSnapshot());
  }
}
