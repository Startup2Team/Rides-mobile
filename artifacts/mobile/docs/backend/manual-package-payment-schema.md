# Manual Package Payment Schema

## Package Payment Configuration

Backend-authoritative fields:

- mode: automatic | manual | disabled
- version
- updated_at
- manual.claim_expires_after_minutes
- manual.transaction_reference_required
- manual.proof_image_enabled
- manual.providers[]

Provider fields:

- provider
- merchant_code
- ussd_template
- enabled

## Manual Payment Claim

Recommended persistent fields:

- id
- display_claim_id
- driver_id
- vehicle_id
- vehicle_type
- offer_id
- package_id
- package_version
- package_name
- expected_amount_rwf
- provider
- merchant_code_snapshot
- payer_phone_number
- transaction_reference
- normalized_transaction_reference
- proof_image_id nullable
- status
- version
- created_at
- submitted_at nullable
- expires_at
- reviewed_at nullable
- reviewed_by nullable
- rejection_reason_code nullable
- clarification_message nullable
- activation_id nullable
- purchase_transaction_id nullable
- credit_transaction_id nullable
- approval_idempotency_key nullable
- updated_at

Required indexes:

- driver_id
- status
- provider
- submitted_at
- display_claim_id
- package_id
- vehicle_id

Required uniqueness:

- provider + normalized_transaction_reference

## Manual Payment Claim Audit

Append-only audit rows:

- id
- claim_id
- actor_type
- actor_id nullable
- action
- reason_code nullable
- created_at

Do not store raw merchant SMS or credentials.

## Idempotency

Recommended idempotency table fields:

- scope
- idempotency_key
- request_fingerprint
- result_reference
- created_at

Deterministic scopes:

- manual-payment-claim:{claimId}:approval
- manual-payment-claim:{claimId}:purchase
- manual-payment-claim:{claimId}:activation
- manual-payment-claim:{claimId}:credits
- manual-payment-claim:{claimId}:approved-event

## Outbox

Outbox row fields:

- id
- event_type
- aggregate_type
- aggregate_id
- payload
- status
- attempt_count
- available_at
- created_at
- processed_at nullable
