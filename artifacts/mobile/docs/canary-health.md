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

## Readiness

`isReadyForActiveRideCanary()` evaluates both canaries against configurable
thresholds:

- mismatch rate below the threshold
- fallback rate below the threshold
- projected availability above the threshold
- mapping failures equal to zero
- no unresolved projection errors

The helper is intentionally conservative. Active ride remains disabled until
the projected read models stay stable under these checks.

## Observability

The health layer emits telemetry for:

- history parity success
- history parity mismatch
- detail parity success
- detail parity mismatch
- canary fallback
- canary readiness updated

These diagnostics are informational only.
