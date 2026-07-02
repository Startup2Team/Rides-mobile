# Ride Canary Inspector

The Ride Canary Inspector is a hidden developer-only surface for ride canary
diagnostics.

## Visibility

It is visible only when one of the following is true:

- `__DEV__`
- `NODE_ENV=test`
- `ENABLE_RIDE_CANARY_INSPECTOR=true`

Production always keeps it disabled.

## What It Shows

The inspector visualizes:

- Ride History canary health
- Ride Detail canary health
- Active Ride canary health, rollout, stability, and monitoring report

It also exposes developer-only actions:

- Refresh Report
- Reset Metrics
- Force Live
- Simulate Rollback
- Export Report (JSON)

## Production Safety

The inspector does not change RideProvider state, navigation, query cache
state, or customer/driver UI flow. It is a diagnostics-only surface for QA
and development.
