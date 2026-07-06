# Manual Package Payment Endpoints

## Driver Endpoints

GET `/v1/package-payments/configuration`

POST `/v1/package-payments/manual-claims`

GET `/v1/package-payments/manual-claims`

GET `/v1/package-payments/manual-claims/{claimId}`

POST `/v1/package-payments/manual-claims/{claimId}/submit`

POST `/v1/package-payments/manual-claims/{claimId}/resubmit`

POST `/v1/package-payments/manual-claims/{claimId}/cancel`

Driver authority rules:

- only the authenticated driver can access their own claims
- do not trust request-body driverId as authority
- do not allow driver routes to approve, reject, or force-activate

## Admin Endpoints

GET `/v1/admin/package-payments/manual-claims`

GET `/v1/admin/package-payments/manual-claims/{claimId}`

POST `/v1/admin/package-payments/manual-claims/{claimId}/request-clarification`

POST `/v1/admin/package-payments/manual-claims/{claimId}/reject`

POST `/v1/admin/package-payments/manual-claims/{claimId}/approve`

Admin approval request:

- expectedClaimVersion
- verificationEvidence
- idempotencyKey

Do not accept client-supplied entitlement values, activation IDs, package overrides, or credit overrides.

## Response Expectations

Approval success should return:

- approved claim
- purchase transaction identity
- activation identity
- credit transaction identity
- entitlement summary/version
- event metadata

## Error Contract

Use typed failures:

- claim_version_conflict
- claim_not_reviewable
- claim_not_approvable
- invalid_verification_evidence
- verification_provider_mismatch
- payment_amount_not_matched
- provider_reference_not_matched
- duplicate_transaction_reference
- idempotency_conflict
- approval_already_completed
- activation_transaction_failed
- package_purchase_transaction_failed
- credit_transaction_failed
- approval_transaction_failed

