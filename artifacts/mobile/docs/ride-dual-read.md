# Ride Dual Read

Phase 10A adds a gated dual-read layer for ride read models. It computes projected read models beside the existing `RideProvider` source of truth, compares them, and emits diagnostics only.

## Source Of Truth

- Live runtime source remains `RideProvider`
- Projected read models are diagnostics-only
- `USE_PROJECTED_RIDE_READ_MODEL` is intentionally `false` everywhere
- `ENABLE_RIDE_DUAL_READ` is `true` in dev/test and `false` in production

## Adapter

`domains/ride/dualRead/` exposes:

- `getLiveActiveRide()`
- `getProjectedActiveRide()`
- `compareActiveRide()`
- `getLiveRideHistory()`
- `getProjectedRideHistory()`
- `compareRideHistory()`
- `getLiveDriverRequests()`
- `getProjectedDriverRequests()`
- `compareDriverRequests()`
- `getReadModelSource()`

The adapter prefers live ride state and falls back to live whenever the projected model is unavailable.

## Hooks

Safe compatibility hooks are available for future use:

- `useRideReadModel()`
- `useActiveRideReadModel()`
- `useRideHistoryReadModel()`
- `useDriverRequestsReadModel()`

They return live RideProvider data for now and only emit dual-read diagnostics when the feature flag is enabled.

## Rollback

`forceLiveRideReadModel()` guarantees live source selection.
`assertProjectedReadDisabledInProduction()` guards the future cutover flag.

## Graduation Criteria

Projected ride models can only drive UI after all of the following are true:

- shadow projection parity is stable
- dual-read mismatch rate is understood and explainable
- readiness gates stay green
- replay stays deterministic
- no query cache or RideProvider mutation is observed
- rollback remains a one-step switch back to live source

