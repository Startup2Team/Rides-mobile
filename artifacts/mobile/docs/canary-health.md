# Ride Canary Health

Phase 11C adds a centralized health and parity layer for the projected ride
history and ride detail canaries.

## What It Tracks

The health store keeps in-memory counters for both canaries:

- comparisons
- matches
- mismatches
- live fallbacks
- projection unavailable
- mapping failures

It does not persist data and it does not change UI behavior.

## Parity Rules

Parity analysis compares business semantics only.

Ignored fields include:

- local timestamps
- temporary IDs
- debug metadata
- telemetry-only values

The analyzer is used to summarize whether the projected history or projected
detail output still matches the live repository-backed view.

## Health Report

`getCanaryHealthReport()` returns a structured summary for history and detail:

- canary name
- current status
- comparison count
- success rate
- mismatch rate
- fallback count
- mapping failures
- last mismatch
- last fallback
- last comparison timestamp

The developer inspector overlays an additional presentation state on top of
the raw health report: no observations are displayed as `idle` /
`not_observed`, not `critical`. Zero projected reads and zero live reads only
mean the canary still needs data.

## Readiness

`isReadyForActiveRideCanary()` evaluates both canaries against configurable
thresholds:

- mismatch rate below the threshold
- fallback rate below the threshold
- projected availability above the threshold
- mapping failures equal to zero
- no unresolved projection errors

The helper is intentionally conservative. Active ride remains disabled until
the projected read models stay stable under these checks. Phase 11D uses this
gate before the projected Active Ride canary is even considered.

## Observability

The health layer emits telemetry for:

- history parity success
- history parity mismatch
- detail parity success
- detail parity mismatch
- canary fallback
- canary readiness updated

Phase 11D adds Active Ride shadow diagnostics on top of this health report.
The readiness signal still comes from the history/detail canaries.

Phase 11E starts the Active Ride diagnostics loop in dev/test only, but it
still depends on this readiness signal. When readiness is not met, the canary
remains on live RideProvider state and records fallback telemetry instead of
changing runtime behavior.

These diagnostics are informational only.

Resetting canary metrics returns history, detail, and active-ride diagnostics
to the unobserved state by clearing counters, observation timestamps, last
mismatch, last fallback, and rollback counts.

Phase 11F adds a separate active-ride rollout gate on top of this health
report. Even when canary health is green, projected Active Ride stays blocked
until the sustained parity window and the explicit production guard both pass.
The health report is necessary but not sufficient for any future UI cutover.
