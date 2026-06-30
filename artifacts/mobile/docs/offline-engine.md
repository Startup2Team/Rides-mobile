# Offline Mutation Engine

Phase 8C introduces an infrastructure-only offline mutation engine. It is not wired into current ride, payment, package, realtime, or transaction flows.

## Architecture

The engine lives under `offline/`:

- `types/`: pending mutation, retry, queue, and network contracts
- `queue/`: in-memory priority queue and singleton exports
- `storage/`: versioned AsyncStorage persistence
- `retry/`: exponential backoff and retry eligibility helpers
- `network/`: NetInfo-backed online/offline monitor
- `scheduler/`: queue processing loop
- `hooks/`: read-only React subscription hook
- `debug/`: hidden queue inspector component
- `tests/`: infrastructure tests

## Lifecycle

1. A caller creates a pending mutation with `enqueue()`.
2. The queue assigns a `mutationId` (`id`) and `idempotencyKey` when the caller does not provide them.
3. The queue persists immediately.
4. The scheduler processes due mutations only when the queue is not paused and the network monitor reports online.
5. Successful mutations are removed from persisted queue state.
6. Failed mutations are retained with `retryCount`, `lastError`, and `nextRetryAt`.
7. Expired or exhausted mutations are removed from the active queue.

No backend calls exist in this phase. A processor can be provided later by domain integrations.

## Priority Classes

Priority order is:

1. `critical`
2. `high`
3. `normal`
4. `low`

Within the same priority, older mutations process first.

## Retry

The retry helper uses exponential backoff:

`delay = min(maxDelayMs, baseDelayMs * 2 ^ (retryCount - 1))`

Policy supports:

- `baseDelayMs`
- `maxDelayMs`
- `maxRetryCount`
- `jitterRatio`

The queue stores `nextRetryAt` so retry schedules survive app restarts.

## Collapse

Safe mutations can use:

- `collapseStrategy: 'replace-latest'`
- `collapseKey: '<domain-specific-key>'`

This is appropriate for replaceable state such as repeated profile edits. It must not be used for:

- book ride
- accept ride
- complete ride
- payment operations
- transaction truth

Those actions require ordered, auditable commands.

## Idempotency

Every pending mutation has:

- `id`: local mutation id
- `idempotencyKey`: backend idempotency key

Future backend integration should require clients to send both. The backend should persist the idempotency key per mutation type and return the original result when the same key is retried.

## Network Awareness

`createNetworkMonitor()` wraps NetInfo. When offline, the queue pauses. When online, it resumes and the scheduler can process due mutations.

## Debug Inspector

`QueueInspector` is hidden by default and exposes:

- queue size
- processing state
- paused state
- total retry count
- oldest mutation id
- network state

It is not mounted in production UI by this phase.

## Future Integration

Later phases can integrate domain processors behind repository boundaries. The engine is ready for backend and realtime integration, but current runtime behavior intentionally does not change.

## Production Readiness

Phase 9F adds readiness gates that stress the offline queue with throughput, retry/backoff, persistence restore, expiry handling, pause/resume, and collapse checks. CI uses a smaller deterministic profile; the full counts are documented in `docs/production-readiness.md`.
