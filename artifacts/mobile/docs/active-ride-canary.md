# Projected Active Ride Canary

Phase 11D introduces the projected Active Ride model as a shadow canary.
It is the highest-risk ride read model because Active Ride drives the live
customer and driver experience.

## Flags

- `ENABLE_PROJECTED_ACTIVE_RIDE_CANARY` defaults to `false` everywhere
- `USE_PROJECTED_RIDE_READ_MODEL` defaults to `false` and must be enabled
  explicitly in dev/test before the canary can run

Both flags must be enabled before the projected Active Ride path can even be
considered.

## Bootstrap

Phase 11E adds a dev/test-only bootstrap that starts Active Ride diagnostics
automatically when both flags are enabled. The bootstrap runs from the app
lifecycle path beside the shadow projection bootstrap, registers a periodic
diagnostics loop, and cleans up its timer during Fast Refresh and tests.

Production never starts this loop.

## Behavior

- live RideProvider state remains authoritative
- projected Active Ride is calculated and compared in shadow mode
- the projected result is discarded unless future rollout flags allow a cutover
- rollback is immediate: any projection, comparison, mapping, readiness, or
  staleness issue falls back to the live ride state

## Staleness Rules

The canary rejects projected Active Ride when:

- the projected sequence falls behind the latest shadow event sequence
- the projection timestamp is stale
- lifecycle state is missing
- driver assignment is missing when expected
- route data is missing
- ETA data is missing when expected

## Rollout Position

Active Ride comes after history, detail, and their health checks because it is
the most operationally sensitive ride read model. It should remain disabled
until the readiness gate and parity reports stay healthy for a sustained period.

Phase 11F adds a separate rollout gate in front of any future UI use. The
canary can now be healthy without being rollout-eligible. Even when parity is
stable, the production guard still blocks projected Active Ride unless the
explicit rollout flag is opened.

## Diagnostics

The canary emits telemetry for:

- active ride comparison
- active ride mismatch
- active ride fallback
- active ride projection stale
- active ride readiness denied
- active ride source selected

These diagnostics do not change the UI.

The diagnostics loop remains shadow-only. The live RideProvider state still
drives the application, and the canary falls back immediately when readiness
fails, projection is unavailable, or semantic comparison does not match.

Phase 11F keeps that same fallback behavior but adds a hard gate that must pass
before projected Active Ride can ever be considered for UI use. The gate stays
blocked by default.

Phase 11G uses the canary result for the first live UI read-only surface. That
surface is intentionally narrow: it only renders the summary strip, while the
map, actions, and lifecycle remain live-only.
