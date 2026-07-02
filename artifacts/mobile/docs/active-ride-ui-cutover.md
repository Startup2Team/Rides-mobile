# Active Ride UI Cutover

Phase 11G allows a minimal Active Ride UI surface to read from the projected
Active Ride model when every gate passes.

Phase 11H adds a stability gate around that first canary. It does not expand
the UI surface. It only decides whether a later surface may be considered.

Phase 11I adds a monitoring report over the same canary. The report is
developer-facing only and does not change the current cutover surface.

## Cutover Surface

Only the read-only summary strip is projected for now:

- ride status display
- ride phase label
- ETA / status summary

The following surfaces remain live-only:

- map driver location
- route navigation
- driver dashboard
- action buttons
- payment and completion flows
- package credit deduction
- negotiation state

## Selection Rules

The UI uses the projected source only when all of these are true:

- `ENABLE_PROJECTED_ACTIVE_RIDE_CANARY`
- `USE_PROJECTED_RIDE_READ_MODEL`
- `ALLOW_PROJECTED_ACTIVE_RIDE_UI`
- the active ride rollout gate passes
- the projected model is fresh and mappable

Otherwise the UI falls back immediately to live RideProvider state.

## Rollback

Rollback is immediate. When the live source is forced:

- the UI switches back to live reads
- no query cache reset is required
- `RideProvider` is not mutated
- no restart is required

## Next Stage

This phase is intentionally narrow. The next rollout stage should expand only
after the summary surface stays stable and the remaining live-only surfaces are
still untouched.

Phase 11H keeps the current surface unchanged and requires the stability gate
to remain healthy before any additional read-only Active Ride surface is
approved.

Phase 11I keeps the UI unchanged and exposes a report that summarizes the
health of the canary for operational review.
