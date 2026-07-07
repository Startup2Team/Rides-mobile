# Package Payment Domain

Package payments are separate from saved payment methods.

- `domains/payments` stores saved payment methods and billing profile preferences.
- `domain/driverRidePackages.ts` owns package catalog, offers, purchase history, activation, and credit accounting.
- `domains/package-payments` owns payment mode, manual payment configuration, manual payment claims, review eligibility, duplicate-reference policy, expiry policy, and approval/activation boundary contracts.

## Phase Summary

- MP2 added the backend boundary prototype for configuration and driver claims.
- MP3 added a safe read path for payment configuration.
- MP4 added a mode-aware checkout shell.
- MP5 added driver manual claim submission.
- MP6 adds the trusted admin review and atomic approval boundary as domain and contract only.

## Payment Mode

The authoritative mode is one value:

- `automatic`
- `manual`
- `disabled`

Unknown or malformed values fail closed.

## Manual Payment Flow

Manual payment is a claim workflow, not an activation workflow.

The claim records:

- locked package offer identity
- expected package amount
- provider
- merchant code snapshot
- payer phone number
- provider transaction reference when available
- optional proof reference when enabled
- review version and audit history

Driver submission stops at `pending_review`. It does not activate packages and does not grant credits.

## Review and Approval

MP6 models the trusted backend review boundary:

- pending review claims can be structurally reviewed
- stale versions fail closed
- verification evidence is typed and sanitized
- approval is backend/admin authority only
- approval must atomically create or resolve the purchase, activate the package, grant credits once, append audit records, and write an outbox event

The mobile client never becomes approval authority.

## Claim Identity

The internal claim ID is a Rides identifier.

The provider transaction reference is separate and is treated as provider evidence, not as the primary claim identity.

## Duplicate Detection

Transaction reference uniqueness is enforced on:

- provider
- normalized transaction reference

Normalization is conservative. The backend must later enforce a transactional uniqueness guarantee.

## Expiry

Claims expire from configuration:

`createdAt + claimExpiresAfterMinutes`

Approved, rejected, and cancelled claims stay terminal.

## Activation Boundary

A manual claim never activates a package on the mobile client.

Only a trusted backend/admin path can bridge an approved claim into package activation atomically and idempotently.

Support contact is secondary. The default flow is to submit the claim in-app and wait for review.

## Repository Boundary

`data/remote/repositories/RemotePackagePaymentRepository.ts` is the backend prototype for package-payment configuration and driver claim CRUD.

`data/remote/repositories/packagePaymentShadowRepository.ts` keeps local behavior authoritative and uses remote calls only for diagnostics.
Write shadowing for manual claims is disabled by default because duplicate payment-review records are dangerous.

`data/repositories/packagePaymentRepositoryFactory.ts` supports explicit repository modes:

- `local`
- `shadow_remote`
- `remote`

The default remains `local`.

`query/hooks/useManualPaymentClaimsQuery.ts` and `query/hooks/useManualPaymentClaimQuery.ts` are backend-ready read paths.
They expose safe read models and conservative refresh policies, but they do not change checkout authority.

`query/hooks/useManualPaymentClaimMutations.ts` is the future mutation boundary for driver claim submission, resubmission, and cancellation.
It does not expose approval or activation authority.

`domains/package-payments/manualPaymentClaimPresentation.ts` centralizes lifecycle-to-UI mapping.
`domains/package-payments/packagePaymentFailurePresentation.ts` centralizes safe failure-to-UX mapping.

## Privacy

Do not log:

- full payer phone number
- transaction reference
- proof URL or proof storage ID
- support notes
- clarification text
- verification raw evidence
- reviewer identity from client input

Safe telemetry should stay at the status, provider, latency, and outcome level.

## MP7 Status

No Go backend source exists in this workspace. MP7 cannot hand off to an implementation-ready backend here because there is no backend module, router, database layer, transaction helper, outbox worker, or admin auth system to extend.

MP7 therefore ends as a backend handoff package, not as production backend implementation.

## MP8 Status

MP8 finalizes the frontend/backend integration contract only.

- no Go backend is implemented here
- no PostgreSQL schema is created here
- no admin approval authority is added here
- no package activation authority is moved into the mobile app
- local prototype claims remain local prototype claims
- remote claims are backend-authoritative when the backend team ships them

Existing local claims must not automatically sync to the backend when remote authority is introduced.

## MP9 Status

MP9 completed the polished driver-facing manual package payment UI and status experience.

- **Staged Checkout Flow**: Completed a structured staged interface (`PAYMENT_INSTRUCTIONS` -> `CLAIM_FORM` -> `CLAIM_STATUS`) in `driver-package-payment.tsx`.
- **Instruction Stage**: Displays selected package, locked price, and active vehicle context. Renders MTN and Airtel instructions with copyable USSD strings generated from templates. Includes a prominent "I have paid" transition action.
- **Form Stage**: Collects provider, payer phone number, and transaction reference. Handles validation, formatting, and prevents duplicate submissions.
- **Status Stage**: Integrates `ManualPaymentClaimStatusCard` to render claims dynamically. Consumes the centralized MP8 presentation policy to show statuses (`submitted`, `pending_review`, `needs_clarification`, `approved`, `rejected`, `expired`, `cancelled`) with themed colors and clear visual feedback.
- **Clarification & Resubmission**: Allows updating provider, phone, and reference when in `needs_clarification` state. Safely mutates with `expectedClaimVersion` and refetches upon version conflicts.
- **Cancellation**: Supports cancelling non-terminal claims with a warning dialog making it clear that cancellation does not refund Mobile Money payments.
- **History Route**: Created `driver-package-payment-status.tsx` as a dedicated claim history route. Shows a list of recent confirmations and navigates to the checkout screen to view details.
- **Privacy & Authority Boundary**: No raw reference or phone data is logged or printed. Local approved status remains a read-model presentation; actual activation/credits require trusted backend authority.
