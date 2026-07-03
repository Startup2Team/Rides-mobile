# Staging Shadow Health

Phase 13C adds a centralized in-memory health report for domains that already
have real staging shadow integration.

This is diagnostics only. It does not change repository source selection, UI,
navigation, auth, or session behavior.

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
