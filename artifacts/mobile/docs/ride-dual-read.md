# Ride Dual Read

Phase 10A adds a gated dual-read layer for ride read models. It computes projected read models beside the existing `RideProvider` source of truth, compares them, and emits diagnostics only.

## Source Of Truth

- Live runtime source remains `RideProvider`
- Projected read models are diagnostics-only
- `USE_PROJECTED_RIDE_READ_MODEL` defaults to `false` and only becomes active
  when explicitly enabled in dev/test diagnostics
- `ENABLE_PROJECTED_HISTORY_CANARY` is intentionally `false` everywhere
- `ENABLE_PROJECTED_RIDE_DETAIL_CANARY` is intentionally `false` everywhere
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

Phase 11A starts the rollout with ride history only. The history canary stays
disabled by default and falls back to the live repository result immediately if
the projected model is unavailable or the comparison fails. Active ride and
driver-facing read models remain live-only.

Phase 11B adds ride detail as the second canary. It follows the same live-first
rule, compares projected detail against the live repository result, and falls
back immediately if the projected model cannot be selected, compared, or
mapped safely.

Phase 11D adds projected Active Ride as a shadow canary only. It is the
highest-risk read model and remains live-only for UI behavior. The projected
result is compared and monitored, then discarded unless a future cutover flag
is explicitly approved.

Phase 11E boots the Active Ride diagnostics loop automatically in dev/test
when both the active-ride canary flag and the projected read-model flag are
enabled. Production remains off and RideProvider continues to drive UI state.
