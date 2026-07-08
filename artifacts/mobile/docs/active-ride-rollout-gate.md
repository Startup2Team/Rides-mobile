# Active Ride Rollout Gate

Phase 11F adds an explicit rollout gate in front of any future UI cutover to
projected Active Ride. The gate is stricter than the shadow canary because it
controls whether the UI may ever consume the projected read model.

## Purpose

- keep `RideProvider` authoritative
- prevent accidental cutover to projected Active Ride
- require a sustained parity window before rollout
- provide a hard rollback path that immediately returns the app to live source

## Defaults

The rollout gate is blocked by default in every environment.

Projected Active Ride is only eligible when all of these are true:

- `ENABLE_PROJECTED_ACTIVE_RIDE_CANARY`
- `USE_PROJECTED_RIDE_READ_MODEL`
- the sustained parity window passes
- the production guard explicitly allows projected Active Ride

The production guard uses `ALLOW_PROJECTED_ACTIVE_RIDE_UI`. It defaults to
`false` everywhere.

## Sustained Parity Window

The gate requires a strict observation window before approving rollout:

- minimum comparison count
- minimum observation window duration
- maximum mismatch rate
- maximum fallback rate
- maximum staleness rate
- zero mapping failures
- zero unresolved projection errors

The defaults stay conservative so the projected source remains diagnostics-only
until a later phase explicitly opens the guard.

## Hard Rollback

Two hard-control helpers are available:

- `disableProjectedActiveRide()`
- `forceActiveRideLiveSource()`

`forceActiveRideLiveSource()` immediately returns the app to live source
selection without clearing the query cache, restarting the app, or mutating
`RideProvider`.

## Telemetry

The gate emits telemetry for:

- rollout gate evaluated
- rollout gate approved
- rollout gate denied
- hard rollback triggered
- production guard blocked
- sustained parity window updated

## Rollout Order

Active Ride remains the last ride read model to be considered for cutover. The
history and detail canaries, their health reports, the shadow projection, and
the dual-read coordinator all stay in place ahead of it.

Phase 11G uses this gate to decide whether the read-only Active Ride summary
surface may use projected data. The gate still blocks any broader cutover.

Phase 11H keeps that surface unchanged and adds a stability gate that must
stay healthy before any additional Active Ride surface can be considered.
