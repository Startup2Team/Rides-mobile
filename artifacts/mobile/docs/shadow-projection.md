# Shadow Ride Projection

Phase 9D registers ride read-model projectors in shadow mode only. The existing `RideProvider` remains the production source of truth.

## Purpose

Shadow projection lets the app build event-driven ride read models in parallel with the current lifecycle. This gives the team a way to measure divergence before changing runtime behavior.

Shadow mode does not:

- update UI
- navigate
- call backend services
- consume realtime messages
- mutate repositories
- mutate TanStack Query cache
- replace RideProvider state

## Architecture

The shadow system lives in `domains/ride/shadow/`:

- `shadowProjectionManager.ts` owns lifecycle, projector registration, replay, and comparison.
- `shadowComparator.ts` compares production snapshots with shadow read models.
- `shadowMetrics.ts` emits structured diagnostics through observability.
- `shadowTypes.ts` defines snapshots, telemetry, mismatch, and feature-flag contracts.
- `RideShadowInspector.tsx` is a hidden debug surface.

The manager maintains memory-only models:

- `shadowActiveRide`
- `shadowRideHistory`
- `shadowDriverRequests`

No persistence is used.

## Feature Flag

`ENABLE_SHADOW_RIDE_PROJECTION` defaults to:

- enabled outside production
- disabled in production

When disabled, the manager does not register projectors and ignores events.

## Comparison Rules

The comparator checks semantic fields only:

- ride id
- lifecycle status
- route summary
- driver id
- history count and settlement summary
- driver request presence

It ignores fields that are expected to differ while shadow mode is not the source of truth:

- locally generated timestamps
- temporary ids
- UI-only fields
- derived display state

## Divergence Reporting

Mismatches do not throw and do not alter app state. They emit structured telemetry:

- `aggregateId`
- `eventId`
- `eventType`
- `correlationId`
- `fieldDiff`
- `sequenceNumber`

The event name is `RideProjectionMismatch`.

## Replay

The manager can replay ride events from the in-memory event store through the shadow projectors. Replay rebuilds shadow models, then can optionally compare them with a supplied production snapshot.

## Graduation Criteria

Before replacing any runtime behavior, shadow projection should run long enough to prove:

- no unexplained active ride divergence
- no unexplained history divergence
- no driver request divergence
- replay matches live projection
- telemetry volume is understood
- app resume reconciliation is specified
- backend event ordering and idempotency are proven

The next phase should run this manager in a controlled app lifecycle hook while still keeping RideProvider as the production source of truth.
