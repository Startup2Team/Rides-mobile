# Manual Payment Admin Review

Manual payment review belongs to trusted backend support/admin authority, not the driver mobile client.

## Responsibility

- driver mobile creates and submits claims
- backend/admin reviews claims
- backend/admin verifies payment evidence
- backend/admin atomically approves the claim and bridges it into package activation

The mobile client must not approve, reject, or force-activate a claim.

## Claim Versioning

Manual payment claims are versioned.

- creation starts at version `1`
- every persisted transition increments version
- admin review commands must include the expected version
- stale version requests fail closed

That prevents two reviewers from approving the same claim concurrently.

## Verification Evidence

Approval requires typed verification evidence, not raw screenshots or raw SMS text.

Supported evidence methods are modeled as internal verification methods such as:

- merchant message
- merchant statement
- provider portal
- provider API
- other internal

The core evidence shape records:

- method
- verified timestamp
- verified-by identity
- provider
- amount matched
- provider reference matched when required

The domain does not store raw SMS bodies, portal credentials, access tokens, or screenshot bytes.

## Approval Contract

The trusted approval boundary is transactional and idempotent.

Required steps:

1. lock the claim
2. validate version and idempotency key
3. validate review eligibility
4. validate verification evidence
5. enforce duplicate reference policy
6. create or resolve the successful purchase
7. activate the package
8. grant credits exactly once
9. mark the claim approved
10. append immutable audit records
11. write an outbox event for notification and entitlement refresh

If any step fails before commit, no partial approval state should remain.

## Idempotency

Approval uses deterministic scopes:

- `manual-payment-claim:{claimId}:approval`
- `manual-payment-claim:{claimId}:purchase`
- `manual-payment-claim:{claimId}:activation`
- `manual-payment-claim:{claimId}:credits`
- `manual-payment-claim:{claimId}:approved-event`

Repeated approval with the same idempotency identity must resolve to the same committed result.

## Outbox

Approval writes an outbox record in the same transaction as the approval.

Notification delivery runs after commit and must be idempotent.

Notification failure must not roll back an already committed activation.

## Driver-visible vs Internal Data

Driver-visible states are:

- submitted
- pending_review
- needs_clarification
- approved
- rejected
- expired
- cancelled

Driver views must not expose:

- raw verification evidence
- admin identity
- internal fraud notes
- merchant SMS content
- backend credentials

## Backend Requirements

The future Go backend must implement the approval transaction with transactional persistence and a uniqueness guarantee for provider transaction references.

The mobile workspace only defines the contract and policy surface. It does not fake approval.

## MP8 Readiness

The frontend now exposes:

- claim read hooks
- claim mutation hooks for submit/resubmit/cancel only
- claim status presentation policy
- safe failure presentation policy
- planned OpenAPI contracts for the backend team

The frontend still does not:

- approve claims
- reject claims
- mark claims verified
- activate packages from manual claims
- grant credits from manual claims
