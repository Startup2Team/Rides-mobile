# Projection Coordinator

Phase 10B introduces a single coordination layer for ride read models.
It does not change runtime behavior. `RideProvider` still drives the UI.

## Architecture

The coordinator lives in `domains/ride/projection/` and owns:

- live snapshot selection
- projected snapshot selection
- live vs projected comparison
- fallback to live
- feature flag evaluation
- telemetry emission
- read-source exposure

It sits above the shadow projection and dual-read compatibility layers.

## Selection

The coordinator returns one of four selection states:

- `LIVE`
- `PROJECTED`
- `SHADOW_ONLY`
- `UNAVAILABLE`

Current behavior stays conservative:

- live remains the runtime source
- projected read models are computed for diagnostics only
- projected cutover remains disabled

## Rollback

`rollbackToLive()` immediately forces live RideProvider snapshots back into use.
It does not reset navigation, query cache, or UI state.

## Diagnostics

The coordinator exposes:

- comparison count
- mismatch count
- last mismatch
- last projection
- current source

These diagnostics are available through `useProjectionCoordinator()` and
`useRideProjectionDiagnostics()`.

## Migration Strategy

The coordinator is the last abstraction before any projected ride model can
drive UI. Graduation requires:

- zero unresolved shadow mismatch in core lifecycle paths
- deterministic replay
- no RideProvider mutation
- no query cache mutation
- production cutover flag intentionally enabled only after explicit approval

Until then, the application stays on live RideProvider data.

Phase 10C sits beside this layer and validates ride commands in dry-run or shadow mode only. The command pipeline does not change projection selection or rollout rules; it only prepares the next safe migration step.

Phase 11A introduces a history-only canary. When
`ENABLE_PROJECTED_HISTORY_CANARY` and `USE_PROJECTED_RIDE_READ_MODEL` are both
enabled, ride history can obtain its data through the projection coordinator
and fall back to live history immediately if projection is unavailable or the
history comparison fails. Active ride, driver dashboard, and the rest of the
app remain on live data. The new canary flag is disabled by default in all
environments.

Phase 11B adds a detail-only canary with the same rollback rules. Ride detail
can use the projected history read model only when
`ENABLE_PROJECTED_RIDE_DETAIL_CANARY` and `USE_PROJECTED_RIDE_READ_MODEL` are
both enabled. If projection, comparison, or mapping fails, ride detail falls
back to the live repository result immediately.

Phase 11C adds centralized canary health and parity reporting. The
projection coordinator remains the live/projected selection layer, while the
canary-health module tracks semantic parity and readiness for the history and
detail canaries. It does not change selection behavior and it does not enable
active ride cutover.

Phase 11D introduces the projected Active Ride canary in shadow mode. The
active ride projection is still discarded for UI behavior, and readiness gates
must pass before it is even considered. The coordinator remains a diagnostics
layer only.

Phase 11E boots the Active Ride canary diagnostics from the app lifecycle in
dev/test only. The bootstrap schedules periodic comparison and fallback checks
but never changes UI selection or production behavior. Production still stays
on live RideProvider snapshots only.

Phase 11F adds the active-ride rollout gate in front of any future UI cutover.
The coordinator can now report whether projected Active Ride is eligible, but
the app still stays on live RideProvider source unless the sustained parity
window and production guard both allow the rollout. Hard rollback controls can
force the coordinator back to live source immediately.

Phase 11G uses that gate for a minimal read-only UI cutover. Only the Active
Ride summary surface may read projected data, while map, actions, navigation,
and other operational surfaces remain live-only. The coordinator still falls
back immediately when the projected model is stale, unavailable, or blocked
by any rollout condition.
