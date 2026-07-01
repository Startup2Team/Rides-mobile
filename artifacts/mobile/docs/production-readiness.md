# Production Readiness

Phase 9F adds readiness gates that stress-test the ride infrastructure before any migration away from `RideProvider`.

Phase 10A keeps the UI on live `RideProvider` state while dual-read diagnostics compare projected ride models in the background.

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
- dual-read parity stays stable with no unresolved mismatch in the core lifecycle
- live source rollback remains available and verified

Phase 10 should only start after these gates are green and the migration plan is explicitly approved.
Phase 10A is the gated dual-read step; Phase 10B should only begin after the dual-read diagnostics remain clean under normal and replayed lifecycle traffic.

Phase 10C adds command-pipeline validation and offline-mutation previews in dry-run or shadow mode only. Production remains disabled until the command pipeline proves stable beside the live RideProvider path.

Phase 10D shadow-wires selected live ride actions into the pipeline for
diagnostics only. The live RideProvider path still executes first, and the
shadow path must fail closed without affecting runtime behavior. The cutover
flag stays disabled until the projected path is proven safe under readiness
and parity checks.

Phase 10E extends the same diagnostics-only pattern to driver accept and
decline. These actions remain live-first, with shadow commands recorded only
when the command pipeline is enabled in non-production modes.

Phase 10H adds shadow validation for `Complete Ride` through the transaction
boundary. The live completion flow remains authoritative, and the new
financial preview stays metadata-only until the later settlement migration
phase is approved and gated.

Phase 10I adds end-to-end verification across every ride lifecycle action:
request, cancel, accept, decline, start, complete, and submit rating. The
tests confirm that the live flow still runs, the shadow command pipeline and
transaction boundary stay diagnostics-only, and no enqueue or repository
behavior is introduced ahead of any read-model cutover.

Phase 11A makes ride history the first projected read model behind a disabled
canary. The projected path stays diagnostics-only until parity remains stable
and rollback behavior is proven across history-specific comparison failures and
projection unavailability.

`ENABLE_PROJECTED_HISTORY_CANARY` stays disabled by default in every
environment until history parity and rollback criteria are explicitly approved.

Phase 11B makes ride detail the second canary behind another disabled flag.
Ride detail remains live-first and immediately falls back if comparison or
mapping fails. Active ride stays live-only.
