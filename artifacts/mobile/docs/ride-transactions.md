# Ride Transactions

Phase 10F introduces a transaction boundary for ride lifecycle commands that
need stronger readiness checks before runtime migration.

## Why It Exists

`Start Ride` and `Complete Ride` are the next commands targeted for future
migration. They touch ride state at the point where payment, package credits,
and compensation may eventually need to coordinate with the lifecycle. The
transaction boundary creates a place to validate those transitions without
changing runtime behavior yet.

## What It Does

The boundary currently:

- validates duplicate commands
- validates idempotency keys
- validates driver capability
- validates ride phase
- validates transaction ordering
- builds a preview for `Start Ride` and `Complete Ride`
- exposes rollback-plan metadata for future compensation hooks
- emits diagnostics and telemetry only

Phase 10G shadow-wires `Start Ride` through this boundary in the live driver
flow. The boundary validates the command, produces the preview, and only then
allows the diagnostics-only command bridge to observe it. `Complete Ride`
remains intentionally separate because it introduces financial effects.

Phase 10H extends the same pattern to `Complete Ride`. The live completion flow
still runs first, then the transaction boundary validates the shadow command,
builds a preview, and emits a financial-effects summary that stays preview-only.
The preview lists settlement, authorization, package credit deduction, earnings,
receipt, promotion, loyalty, referral, analytics, and notification surfaces
without executing any of them.

The current mock ride flow can still be treated as `system`-initiated when no
approved driver context is available. That compatibility mapping keeps the live
behavior unchanged while the transaction layer is introduced.

It does not:

- execute ride commands
- enqueue offline mutations
- call repositories
- change UI state
- commit backend writes

## Transaction States

The boundary models the following states:

- `Pending`
- `Accepted`
- `Rejected`
- `Committed`
- `RolledBack`
- `Expired`

Only `Pending`, `Accepted`, and `Rejected` are used by the current readiness
layer. `Committed`, `RolledBack`, and `Expired` are reserved for later phases.

## Future Integration

This boundary is the handoff point for future coordination with:

- payment authorization and capture
- package credit deduction
- compensation and rollback hooks
- backend idempotent command handling

The live RideProvider flow remains authoritative until a later migration phase
explicitly cuts over.
