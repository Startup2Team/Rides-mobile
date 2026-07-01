# Projected Ride Detail Canary

Phase 11B makes ride detail the second read model that can opt into the
projected path behind a feature flag.

## Flags

- `ENABLE_PROJECTED_RIDE_DETAIL_CANARY` defaults to `false` everywhere
- `USE_PROJECTED_RIDE_READ_MODEL` remains `false` everywhere

Both flags must be enabled before ride detail can use the projected path.
Otherwise ride detail continues to read live repository-backed data exactly as
before.

## Behavior

- live detail remains the runtime default
- the projection coordinator is used only when the canary is enabled
- projected detail is mapped back into the existing `Ride` UI shape
- rollback is immediate: if projection is unavailable, comparison fails,
  mapping fails, or the canary is disabled, ride detail falls back to the live
  repository result
- active ride remains live-only
- driver dashboard remains live-only

## Rollout Order

Ride History remains the first canary. Ride Detail is second.
Suggested rollout order:

1. Ride History canary
2. Ride Detail canary
3. other ride read-model surfaces with no active lifecycle responsibility
4. active ride and driver-facing read models only after parity remains stable

## Diagnostics

Ride detail canary runs emit:

- canary enabled
- source selected
- fallback
- comparison
- mismatch
- mapping failure

Phase 11C adds centralized health tracking for detail parity. The canary now
updates the shared canary-health store with comparison, fallback, availability,
and mapping-failure counts, and it contributes to
`getCanaryHealthReport()` and `isReadyForActiveRideCanary()`.

These diagnostics are informational only and do not affect UI behavior.
