# HYBRID Rollout Plan

Phase 13H is planning and scaffolding only. It does not enable `HYBRID` mode,
it does not change repository source selection, and it does not change runtime
behavior.

This document defines the future rollout path for the domains that already have
real staging shadow integrations:

- `savedLocations`
- `profile`

## What HYBRID Means

HYBRID means the repository will eventually prefer a remote read path while
keeping a local fallback available for recovery, continuity, and rollback.

The local source remains authoritative until a future implementation PR
explicitly changes runtime behavior.

## Local Fallback Rules

- local data must remain readable when the remote path fails
- local cache hydration remains the recovery path for offline or degraded
  remote conditions
- remote diagnostics must never block the UI or mutate local authority in this
  phase
- if any guardrail fails, the rollout reverts to `LOCAL`

## Remote Primary Read Rules

- remote reads may only become primary after approved evidence exists
- remote results must be compared against local results during the dry-run
- semantic parity matters more than raw transport parity for these domains
- no promotion to a primary remote read path should happen without an explicit
  future rollout PR

## Conflict Detection

Before any future HYBRID implementation:

- compare semantic fields rather than raw transport payloads
- treat missing approvals, baseline regressions, and production guard failures
  as blockers
- treat unexpected ID differences as non-critical unless the contract requires
  a shared identifier
- preserve the local result as the final UI-facing value until the rollout is
  explicitly approved

## Write Behavior

- shadow writes default off
- local writes remain authoritative in the current phase
- remote writes, if ever enabled later, must never replace the local result in
  diagnostics mode
- idempotency and retry safety must be explicit before any write path is
  considered for rollout

## Approval Gates

The current review chain is:

1. staging shadow health
2. sanitized baseline comparison
3. HYBRID candidate review
4. HYBRID rollout dry-run plan
5. human approval

Passing diagnostics do not auto-enable the source. A future rollout PR must
still make the runtime switch.

## Production Guards

- production must fail closed to `LOCAL`
- `HYBRID` and `REMOTE` remain disabled until a future approval and runtime
  change land together
- staging configuration must be explicit and must not be inferred from
  development defaults
- backend URLs must remain sanitized and HTTPS-only for non-localhost remote
  targets

## Staged Rollout Steps

1. keep savedLocations and profile in `SHADOW_REMOTE`
2. collect enough healthy staging shadow data
3. review the HYBRID candidate gate
4. generate the HYBRID rollout dry-run plan
5. secure explicit human approval
6. land a separate runtime PR that enables a controlled HYBRID canary
7. expand to HYBRID enabled only after the canary is stable
8. consider remote-candidate exploration only after HYBRID is stable and
   rollback is boring

## Rollback To LOCAL

Rollback is always the first safe exit.

To roll back:

- switch the selected repository source back to `LOCAL`
- leave shadow diagnostics disabled
- preserve the local cache and local-authoritative state
- keep approvals and rollout flags out of the runtime path

The future runtime implementation must be able to reverse the rollout without
changing the UI or session model.

## Separate PR Requirement

The HYBRID runtime switch must be a separate pull request from this planning
scaffold.

This phase is intentionally limited to documentation, policy types, dry-run
evaluation, CLI reporting, and CI-safe review tooling.
