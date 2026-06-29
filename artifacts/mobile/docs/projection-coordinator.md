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
