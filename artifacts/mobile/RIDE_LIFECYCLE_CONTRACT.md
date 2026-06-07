# Ride Command And Event Contract

Status: design contract for future backend integration. It is not wired into `RideProvider` and does
not change current mobile behavior.

The TypeScript protocol definitions and canonical transition table live in
`context/ride/rideContract.ts`.

## Authority Model

The server is authoritative for ride lifecycle state, accepted fare, assigned driver, event order,
and ride version. Mobile clients may optimistically display pending commands, but a command does not
become durable state until the server accepts it and emits events.

Each ride is an aggregate identified by `rideId`. The aggregate has:

- A lifecycle `status`.
- A monotonically increasing `rideVersion`, incremented for each accepted state mutation.
- A monotonically increasing event `sequence`, scoped to the ride.
- A server snapshot that can rebuild or reconcile mobile state.

`idle` remains a client-only state meaning no current ride. The server lifecycle starts at
`searching`.

## Commands

Commands express intent and may be rejected. Every command includes `commandId`, `idempotencyKey`,
`rideId`, actor, source, issue time, and `expectedVersion`.

| Command | Expected actor | Purpose |
| --- | --- | --- |
| `ride.request` | customer | Create a ride and begin matching. |
| `ride.cancel` | customer, driver, support | Cancel a non-terminal ride subject to policy. |
| `ride.request.accept` | driver | Accept an assigned/requested ride and open negotiation. |
| `ride.request.decline` | driver | Decline a request without mutating another driver's ride state. |
| `ride.offer.submit` | customer or driver | Submit a fare offer during negotiation. |
| `ride.offer.accept` | customer or driver | Accept the other party's current offer. |
| `ride.driver.arriving` | driver or server | Mark the driver as travelling to pickup. |
| `ride.driver.arrived` | driver | Mark arrival at pickup. |
| `ride.start` | driver | Start the passenger journey. |
| `ride.complete` | driver | Complete the journey. |
| `ride.driver.location.update` | driver | Submit ephemeral location telemetry. |

Commands must be authorized against the authenticated actor. Client-provided actor IDs, fares, and
locations are never trusted without server validation.

## Events

Events are immutable facts emitted only after an accepted command or server-owned process.

| Event | Lifecycle result |
| --- | --- |
| `ride.requested` | `searching` |
| `ride.driver.assigned` | `driver_assigned` |
| `ride.negotiation.opened` | `negotiating` |
| `ride.offer.submitted` | No status change |
| `ride.offer.accepted` | `confirmed` |
| `ride.driver.arriving` | `arriving` |
| `ride.driver.arrived` | `arrived` |
| `ride.started` | `in_progress` |
| `ride.completed` | `completed` |
| `ride.cancelled` | `cancelled` |
| `ride.driver.location.updated` | No status change; telemetry may use a separate retention policy |

Every event includes `eventId`, `rideId`, `sequence`, `rideVersion`, `occurredAt`, `causationId`,
and `correlationId`.

## Allowed State Transitions

Canonical happy path:

```text
searching
  -> driver_assigned
  -> negotiating
  -> confirmed
  -> arriving
  -> arrived
  -> in_progress
  -> completed
```

Cancellation is allowed from every non-terminal state. `completed` and `cancelled` are terminal.
The authoritative table is `RIDE_ALLOWED_TRANSITIONS`.

The current mock provider moves directly from `searching` to `negotiating`. During migration, the
server may emit `ride.driver.assigned` and `ride.negotiation.opened` in one ordered batch, allowing
the existing UI to render the final `negotiating` state without adding an intermediate screen.

## Invalid Transitions

Invalid commands do not mutate the ride, increment `rideVersion`, or emit lifecycle events. The
server returns a typed rejection:

- `INVALID_TRANSITION`: source and requested state do not form an allowed transition.
- `STALE_EXPECTED_VERSION`: the client acted on an old snapshot.
- `ACTOR_NOT_AUTHORIZED`: actor cannot perform the command.
- `RIDE_NOT_FOUND`: ride does not exist or is not visible to the actor.
- `VALIDATION_FAILED`: payload failed domain validation.
- `TERMINAL_RIDE`: command attempted to mutate a completed or cancelled ride.

Rejections include the current version/status when disclosure is authorized. Clients reconcile
instead of forcing their intended state.

## Idempotency

- Every mutating command requires a stable `idempotencyKey`.
- Retrying the same logical action reuses the same key and identical payload.
- The server stores the command result by `(actor, idempotencyKey)` for at least the maximum mobile
  retry window.
- A duplicate returns the original accepted or rejected result with `replayed: true`; it does not
  emit duplicate events.
- Reusing a key with a different payload is rejected as `VALIDATION_FAILED`.
- `commandId` identifies one submission attempt; `idempotencyKey` identifies the logical action.
- Location telemetry may be deduplicated by driver, ride, and `recordedAt` and may use shorter
  retention than lifecycle commands.

## Event Ordering

- Event `sequence` is strictly increasing and contiguous per ride.
- `rideVersion` never decreases. Multiple events from one atomic command may share the resulting
  `rideVersion`, but retain distinct ordered sequences.
- Consumers apply an event only when `sequence === lastSequence + 1`.
- Events with `sequence <= lastSequence` are duplicates and are ignored.
- A gap triggers reconciliation; later events are buffered or discarded until the gap is filled.
- Cross-ride ordering is not guaranteed.
- Server timestamps are informational; sequence, not timestamp, determines application order.

## Server Reconciliation

On login, reconnect, app foreground, stale-version rejection, or event gap:

1. Fetch the authoritative ride snapshot and its `lastSequence`.
2. If the local version/sequence matches, continue consuming events.
3. If the server can provide all missing events, apply them in sequence.
4. Otherwise replace the local aggregate with the server snapshot.
5. Reapply only still-pending commands whose preconditions remain valid.
6. Never overwrite newer server state with an optimistic local state.

Completed/cancelled snapshots clear the active ride and may be copied into history. History remains
a server-derived projection once backend integration is active.

## Offline And Retry Rules

- Queue commands only when the action is meaningful offline and can be safely retried.
- Persist the command envelope, idempotency key, creation time, and last attempt; do not persist
  authentication secrets in the queue.
- Retry transient transport failures with bounded exponential backoff and jitter.
- Do not retry authorization, validation, invalid-transition, or terminal-ride rejections.
- A timeout means outcome unknown, so retry with the same idempotency key.
- Commands with stale `expectedVersion` reconcile before retrying.
- Expire unsafe time-sensitive commands such as accept/start/complete according to server policy.
- Location updates are best effort: coalesce old samples and send only the latest useful location.
- UI may show pending/offline state later, but must not present an optimistic terminal transition as
  confirmed before server acknowledgement.

## WebSocket Expectations

- Authenticate the socket and authorize every ride subscription.
- Subscribe by ride/user scope; never trust a client-provided ride ID alone.
- Deliver typed `RideEvent` envelopes, not partial ad hoc ride objects.
- The client deduplicates by `eventId` and orders by per-ride `sequence`.
- Duplicate delivery is expected and safe.
- A sequence gap, reconnect, app foreground, or unknown contract version triggers reconciliation.
- Heartbeats and reconnects use bounded backoff with jitter.
- The server may send a snapshot or event batch after reconnect.
- Unsupported `contractVersion` events are not applied; the client reports a sanitized compatibility
  failure and fetches a supported snapshot.
- Notifications may prompt a refresh but are not authoritative lifecycle events.

## Migration Boundary

`RideProvider` remains unchanged for now. Future integration should introduce an adapter that maps
accepted server events into the existing `Ride` view model and preserves the public `RideContext`
API while screens migrate. The adapter should be the only layer allowed to reconcile optimistic
commands, snapshots, and WebSocket events.
