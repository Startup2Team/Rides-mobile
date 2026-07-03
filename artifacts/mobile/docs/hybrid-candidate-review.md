# HYBRID Candidate Review

Phase 13G adds an explicit approval gate for the domains that already have
real staging shadow integration:

- `savedLocations`
- `profile`

This is review tooling only. It does not enable `HYBRID` mode, it does not
change repository source selection, and it does not change runtime behavior.

## What The Gate Checks

The gate combines:

- the remote readiness matrix
- the staging shadow health snapshot
- the committed sanitized baseline
- the production guard audit
- the checked-in approval file
- documentation evidence for shadow-write safety, rollback path, and telemetry
  sanitization

All of those must line up before a domain can become
`approved_for_hybrid_candidate`.

## Approval File

The checked-in approval file is:

- `docs/approvals/hybrid-candidates.json`

It defaults both domains to `approved: false`. Approval metadata is sanitized
and keeps the review state offline-friendly.

Suggested fields:

- `approved`
- `approvedBy`
- `approvedAt`
- `reason`
- `expiresAt`

Approval expiration blocks the domain until the record is refreshed.

## Status Model

The review gate returns:

- `not_reviewed`
- `blocked`
- `needs_more_shadow_data`
- `needs_human_review`
- `approved_for_hybrid_candidate`

Default output should stay conservative:

- no staging data yet means `not_reviewed`
- enough staging data but no approval means `needs_human_review`
- hard failures or expired approval mean `blocked`

## Using The CLI

Run the review command from the mobile workspace:

```bash
pnpm.cmd --dir artifacts/mobile run review:hybrid-candidates
```

Useful flags:

- `--json` for machine-readable output
- `--strict` to fail on invalid approval, expired approval, or guard failure
- `--help` for usage

The CLI is safe by default and does not contact the backend.

## HYBRID Candidate Does Not Mean HYBRID Mode

HYBRID candidate status is only a review step. It does not switch any runtime
source to hybrid authority.

The repository resolver should still default to `LOCAL` until a future phase
explicitly changes the runtime rollout policy.
