# Domain Event Platform

Phase 8E adds a CQRS-ready domain event platform as infrastructure only. It is not wired into ride lifecycle, realtime, notifications, payment, UI, or backend code.

## Architecture

The platform lives in `artifacts/mobile/events/`:

- `types/` defines the generic `DomainEvent<TPayload>` model.
- `bus/` provides local publish/subscribe delivery.
- `dispatcher/` validates, deduplicates, orders by sequence, dispatches, archives, and dead-letters failed events.
- `projectors/` registers read-model projectors without feature-specific implementations.
- `store/` provides the in-memory event store and singleton infrastructure.
- `replay/` replays aggregate, event-type, or global streams through projectors.
- `validation/` validates metadata, version, duplicate event ids, timestamps, and aggregate sequence.
- `dead-letter/` captures failed events for retry, archive, and inspection.
- `debug/` contains a hidden event inspector.

The store is intentionally in-memory for this phase. No backend or persistence behavior is introduced.

## Event Model

Every domain event contains:

- `eventId`
- `aggregateId`
- `aggregateType`
- `eventType`
- `eventVersion`
- `sequenceNumber`
- `timestamp`
- `correlationId`
- `causationId`
- `producer`
- `payload`

The model is generic so feature domains can add typed payloads later without changing the event platform.

## CQRS-Ready Design

Commands and writes can eventually append domain events through the dispatcher. Projectors can consume those events to build read models. In Phase 8E, no command handlers or feature projectors are registered.

The dispatcher is the boundary that keeps event handling consistent:

1. Validate metadata and sequence.
2. Reject duplicate event ids.
3. Append to the event store.
4. Publish to subscribers.
5. Run all registered projectors.
6. Archive successfully dispatched events.
7. Send failures to the dead-letter queue.

## Projectors

Projectors register with an id and either a list of event types or `*`. Multiple projectors can consume the same event. Projectors may expose `reset()` so future replay workflows can rebuild read models.

Ride read-model projectors are now implemented and tested in `domains/ride/projectors/` as pure functions. They are not registered with the runtime event platform yet. The next ride lifecycle phase should register them in parallel/shadow mode before any production behavior is migrated.

## Event Bus

The event bus supports:

- `publish(event)`
- `subscribe(eventType, listener)`
- `unsubscribe(eventType, listener)`
- `unsubscribeAll(eventType?)`

Subscribers can listen to a specific event type or `*` for all events.

## Replay

Replay supports:

- single aggregate stream
- single event type stream
- global stream

Replay sends stored events through registered projectors. It does not republish commands or call backend services.

## Dead Letter Queue

Validation failures and projector/subscriber errors are captured as dead-letter entries. Entries can be inspected, retried, archived, removed, or cleared. Retry is bookkeeping only in this phase; future phases can use it to re-dispatch after operator or automated correction.

## Future Integration

Future backend integration should persist events server-side and assign durable global ordering. Future realtime integration can translate remote event messages into validated `DomainEvent` objects. Future ride lifecycle migration can register ride command handlers and ride read-model projectors without changing this infrastructure.
