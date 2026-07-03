# Staging Shadow Health

Phase 13C adds a centralized in-memory health report for domains that already
have real staging shadow integration.

This is diagnostics only. It does not change repository source selection, UI,
navigation, auth, or session behavior.

Phase 13D adds a safe snapshot layer and CLI report so developers and CI can
review the same readiness data without contacting the backend.

## What It Measures

The report aggregates per-domain counters for:

- local operations completed
- shadow attempts, successes, failures, and timeouts
- skipped shadow attempts because config was invalid
- skipped shadow attempts because mode was local
- skipped write shadow because the write flag was disabled
- semantic mismatches
- shape mismatches
- average latency
- last success and failure timestamps
- last mismatch category
- last error category

The report is memory only. It does not persist to storage.

The snapshot wraps the in-memory report with:

- `generatedAt`
- `domainsIncluded`
- per-domain status, recommendation, and score
- blockers and warnings
- metrics summary
- overall status and overall recommendation

## CLI Snapshot

Run the snapshot from the mobile workspace:

```bash
pnpm.cmd --dir artifacts/mobile run report:staging-health
```

Useful flags:

- `--json` prints JSON to stdout
- `--output <path>` writes the JSON snapshot to disk
- `--strict` exits non-zero when the snapshot is failing or blocked
- `--help` prints usage

Default behavior is CI-safe. If there is no shadow data yet, the snapshot is
`idle` with `collect_data` and the command exits `0`.

The command never contacts the backend. It only reads the in-memory health
module.

## Included Domains

The initial domains are:

- `savedLocations`
- `profile`

The module accepts any domain string so future domains can be added without
changing the report core.

## Status

Each domain is reported as one of:

- `idle` - no shadow attempts yet
- `healthy` - enough attempts, low failure rate, no mismatches
- `degraded` - some failures, timeouts, or insufficient sample size
- `failing` - failure or mismatch rate is above the blocking threshold
- `blocked` - staging is blocked by invalid config or a production guard

## Recommendation

Each domain also returns a recommendation:

- `collect_data` - no shadow attempts yet
- `continue_shadow` - data exists, but not enough to promote
- `investigate` - failure or mismatch rate is too high
- `blocked` - staging is not allowed for this domain
- `ready_for_hybrid_candidate` - enough healthy shadow data exists to review
  the domain for a future HYBRID candidate

Thresholds are centralized in `stagingShadowHealthPolicies.ts`.

## How It Is Updated

Saved Locations and Profile staging shadow paths record:

- local operation completion
- shadow attempted
- shadow success
- shadow failure
- timeout
- mismatch
- invalid config skip
- local mode skip
- write-shadow-disabled skip

Telemetry continues separately. The health module only aggregates readiness
data.

## Production Guard Behavior

Production remains fail-closed to `LOCAL`.

If staging is blocked because of production, invalid backend configuration, or
missing staging opt-in, the health report records a blocked/skip event and the
domain remains diagnostics-only.

Shadow writes default off. When the write flag is disabled, write shadow is
recorded as skipped and local behavior still runs normally.

## Rollout Rule

A domain should move from `SHADOW_REMOTE` diagnostics to HYBRID candidacy only
after it has enough healthy staging shadow data, low mismatch rate, and no
blocked configuration issues.

## Adding Future Domains

Future domains can start emitting health events with a new domain string.
Nothing in the core report needs to change as long as the domain records the
same event categories.

## CI Use

Use the snapshot command in CI or local developer workflows to review whether a
domain is approaching HYBRID candidacy. Use `--strict` only when you want the
job to fail on `failing` or `blocked` health.

## CI Archiving

The mobile CI workflow uploads the snapshot JSON as a GitHub Actions artifact
named `staging-shadow-health-report`.

The artifact contains the file:

- `artifacts/mobile/staging-health-report.json`

Download it from the run summary in GitHub Actions. The JSON is safe to compare
across runs because it contains only the snapshot fields and sanitized health
metrics.

Use the JSON to compare:

- overall status and recommendation
- per-domain status and recommendation
- score trends
- blockers and warnings
- summary counts and latency

`idle` / `collect_data` is not a failure. It means the domain has not collected
shadow data yet, which is the expected default for a clean CI run.

## Baseline Comparison

The committed sanitized baseline lives at:

- `docs/baselines/staging-health-baseline.json`

Compare the current artifact against that file to catch regressions before
HYBRID review.

Example:

```bash
pnpm.cmd --dir artifacts/mobile run compare:staging-health -- --current artifacts/mobile/staging-health-report.json --baseline artifacts/mobile/docs/baselines/staging-health-baseline.json
```

Non-strict comparison warns on differences and exits `0`. Strict comparison
turns regressions into a non-zero exit code.

Score-drop sensitivity is controlled by the comparison tool's configured
threshold. The default is 10 points, and CI can override it with the
`STAGING_HEALTH_SCORE_DROP_THRESHOLD` environment variable when a branch needs
different sensitivity.

Treat these as regressions in strict mode:

- `healthy` -> `degraded`, `failing`, or `blocked`
- `degraded` -> `failing` or `blocked`
- `idle` / `collect_data` -> `failing` or `blocked`
- `ready_for_hybrid_candidate` -> `continue_shadow`, `investigate`, or
  `blocked`
- new blockers
- score drops beyond the configured threshold

To update the baseline, first review the archived CI JSON and the code or
policy change that caused the difference. Only replace the committed baseline
when the new default state is intentionally accepted.
