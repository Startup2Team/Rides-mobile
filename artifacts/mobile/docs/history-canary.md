# Projected Ride History Canary

Phase 11A makes ride history the first read model that can opt into the
projected path behind a feature flag.

## Flags

- `ENABLE_PROJECTED_HISTORY_CANARY` defaults to `false` everywhere
- `USE_PROJECTED_RIDE_READ_MODEL` remains `false` everywhere

Both flags must be enabled before history can use the projected path.
Otherwise history continues to read the live repository-backed data exactly as
before.

## Behavior

- live history remains the runtime default
- the projection coordinator is used only when the canary is enabled
- projected history is merged back into the existing `Ride[]` view model so the
  current screens do not need to change
- rollback is immediate: if projection is unavailable, comparison fails, or the
  canary is disabled, history falls back to the live repository result
- ride detail canary comes later and still remains live-fallback safe

## Rollout Order

History is intentionally the first projected read model.

Suggested rollout order:

1. Ride History canary
2. Ride Detail canary
3. other ride read-model surfaces with no active lifecycle responsibility
4. active ride and driver-facing read models only after parity remains stable

## Diagnostics

History canary runs emit:

- canary enabled
- source selected
- fallback
- comparison
- mismatch

These diagnostics are informational only and do not affect UI behavior.
