# Ride Canary Inspector

The Ride Canary Inspector is a hidden developer-only surface for ride canary
diagnostics.

## Visibility

It is hidden by default in production, development, and test. It is visible
only when one of the explicit internal/debug flags is enabled:

- `EXPO_PUBLIC_ENABLE_RIDE_CANARY_INSPECTOR=true`
- `ENABLE_RIDE_CANARY_INSPECTOR=true`

`__DEV__` and `NODE_ENV=test` do not show the inspector by themselves. Normal
customer and driver builds must not show the floating `CANARY` entry point.

## What It Shows

The inspector is out-of-layout developer tooling. Normal customer and driver
screens render without the full report in their layout. When the visibility
gate allows tooling, the app shows only a small floating `CANARY` entry button
above normal controls. Tapping it opens the full inspector in a dedicated
scrollable modal/debug overlay with an opaque background and a Close action.

The modal visualizes:

- Ride History canary health
- Ride Detail canary health
- Active Ride canary health, rollout, stability, and monitoring report

It also exposes developer-only actions:

- Refresh Report
- Reset Metrics
- Force Live
- Simulate Rollback
- Export Report (JSON)

## Health States

Zero traffic is not a failure. A canary with no projected reads, live reads,
fallbacks, mismatches, stale incidents, mapping failures, or rollback events is
shown as `idle` / `not_observed` with `collect_data`.

Some successful reads that do not meet rollout thresholds remain a hold state.
Mismatches, stale projections, or mapping failures require investigation.
Rollback events or severe mismatch patterns require rollback.

## Action Semantics

`Simulate Rollback` records exactly one rollback event per explicit button tap.
Opening or closing the inspector and `Refresh Report` do not increment rollback
counts.

`Reset Metrics` clears projected/live read counts, fallback counts, mismatch
counts, stale and mapping-failure counts, rollback counts, observation
timestamps, last mismatch, and last fallback. After reset, the inspector returns
to `idle` / `not_observed` until a new diagnostic observation occurs.

## Production Safety

The inspector does not change RideProvider state, navigation, query cache
state, or customer/driver UI flow. The floating entry point and modal share the
same developer-only visibility gate and remain hidden in production by default.
