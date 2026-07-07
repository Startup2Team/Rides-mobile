# Manual Package Payment Approval Transaction

## Transaction Sequence

BEGIN

1. Lock claim row.
2. Verify claim exists.
3. Verify expected version.
4. Resolve idempotency state.
5. Verify pending_review status.
6. Verify not expired.
7. Validate claim snapshot.
8. Validate verification evidence.
9. Verify provider match.
10. Verify amount match.
11. Verify provider reference match when required.
12. Enforce provider + normalized reference uniqueness.
13. Check existing approval result.
14. Resolve package purchase values from persisted claim snapshot.
15. Create one successful purchase.
16. Activate one package entitlement.
17. Grant credits exactly once.
18. Mark claim approved.
19. Persist purchase, activation, credit, reviewer, reviewed timestamp, and new version.
20. Append audit record.
21. Write approved outbox event.

COMMIT

Any failure before commit must roll back the whole operation.

## Non-Negotiable Rules

- no approved claim without activation
- no activation without purchase
- no credits without activation
- no duplicate credits
- no partial approval state

## Concurrency

Use row lock plus version check, or a single compare-and-swap update under transaction.

If the claim version is stale, return claim_version_conflict.
