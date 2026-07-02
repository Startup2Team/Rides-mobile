# Active Ride Canary Stability

Phase 11H adds a stability gate around the first Active Ride UI canary. It does
not expand the UI surface. The read-only summary strip introduced in Phase 11G
remains the only projected Active Ride surface.

## Why It Exists

The first projected Active Ride surface is useful for validation, but it is not
enough on its own to justify expanding the cutover. The stability gate measures
whether projected reads stay healthy for long enough, with enough successful
reads, before any future surface is considered.

## Tracked Signals

- projected source selections
- live fallbacks
- gate denials
- mapping failures
- stale projection incidents
- comparison mismatches
- rollback events
- time since last mismatch
- time since last fallback

## Readiness Criteria

The next Active Ride surface remains blocked unless all of these are true:

- minimum successful projected reads reached
- minimum observation duration reached
- zero mapping failures
- zero stale projection incidents
- zero unresolved mismatches
- fallback rate stays under the configured threshold
- rollback count remains zero

The default thresholds are intentionally strict.

## Rollback-First Policy

Rollback remains immediate:

- live source is restored without app restart
- no query cache is cleared
- `RideProvider` is not mutated
- the current read-only summary canary stays live-fallback safe

## Next Eligible Surfaces

The next rollout stage should still start conservatively. The map, route,
action buttons, payment, completion, package, and driver dashboard surfaces
remain live-only until the stability gate has stayed clean over a sustained
window.
