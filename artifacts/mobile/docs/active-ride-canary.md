# Projected Active Ride Canary

Phase 11D introduces the projected Active Ride model as a shadow canary.
It is the highest-risk ride read model because Active Ride drives the live
customer and driver experience.

## Flags

- `ENABLE_PROJECTED_ACTIVE_RIDE_CANARY` defaults to `false` everywhere
- `USE_PROJECTED_RIDE_READ_MODEL` remains `false` everywhere

Both flags must be enabled before the projected Active Ride path can even be
considered.

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

## Diagnostics

The canary emits telemetry for:

- active ride comparison
- active ride mismatch
- active ride fallback
- active ride projection stale
- active ride readiness denied
- active ride source selected

These diagnostics do not change the UI.
