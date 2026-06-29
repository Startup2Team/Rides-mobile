# Production Readiness

Phase 9F adds readiness gates that stress-test the ride infrastructure before any migration away from `RideProvider`.

## What The Gates Protect

- Offline queue: throughput, retry/backoff, restore, expiry, pause/resume, collapse
- Realtime gateway: reconnect storm handling, heartbeat timeout, subscription restore, offline/online transitions, duplicate reconnect protection
- Domain event platform: dedupe, stale sequence rejection, dead-lettering, replay correctness, ordering
- Shadow ride projection: parity checks, replay, mismatch telemetry, no query cache mutation, no UI mutation
- Observability: logs, metrics, traces, correlation, health checks

## CI-Safe And Heavy Modes

The readiness module exposes two deterministic stress profiles:

- `CI_SAFE_READINESS_STRESS_PROFILE`
- `FULL_READINESS_STRESS_PROFILE`

CI runs should use the safe profile. Heavy counts are documented for manual verification and future load testing.

## How To Run

The readiness tests live in `readiness/tests/readiness.test.ts` and are included in the normal mobile test suite:

```bash
pnpm.cmd --dir artifacts/mobile run test --forceExit
pnpm.cmd --dir artifacts/mobile run typecheck
git diff --check
```

## Graduation Criteria

Before projected ride models can drive UI:

- zero failing readiness gates
- no unresolved shadow mismatch in the core lifecycle
- event replay stays deterministic
- offline queue persistence is verified
- reconnect and subscription restore are verified
- dead-letter behavior is verified
- observability metrics are emitted
- performance stays within the agreed CI threshold

Phase 10 should only start after these gates are green and the migration plan is explicitly approved.

