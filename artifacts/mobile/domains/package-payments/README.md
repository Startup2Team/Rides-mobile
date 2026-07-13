# Package Payments

This domain owns package-payment initiation policy and manual payment claims.

It is separate from `domains/payments`, which only manages saved payment methods and billing profile data.
It is also separate from the package entitlement domain in `domain/driverRidePackages.ts`, which owns catalog resolution, package offers, purchases, activations, and ride-credit accounting.

The package-payment domain is intentionally dormant in this phase:

- it models payment mode as `automatic`, `manual`, or `disabled`
- it validates manual payment configuration
- it builds and validates manual payment claims
- it defines duplicate-reference, expiry, transition, and activation-eligibility policies
- it does not activate packages
- it does not grant credits
- it does not call payment providers
- it does not expose admin approval authority to the mobile driver client

MP2 adds the repository/backend boundary prototype:

- remote repository implementation
- DTO mapping layer
- shadow repository diagnostics

MP3 adds a read-only configuration query path:

- the app can observe automatic, manual, or disabled mode
- malformed, missing, or unavailable configuration falls back to automatic
- checkout behavior does not branch yet

MP4 adds a mode-aware checkout shell:

- automatic mode keeps the current simulated payment flow
- manual mode shows USSD instructions only
- disabled mode blocks package payment

MP5 adds driver claim submission:

- manual mode can submit a claim after the driver pays
- the claim stays pending review
- the mobile client still cannot approve, reject, or activate packages
- credits still come only from the package entitlement path

MP6 adds the admin review and atomic approval boundary:

- review policies model pending-review eligibility, version conflicts, and claim terminal states
- verification evidence is typed and does not carry raw SMS text, credentials, or screenshots
- approval is a backend/admin contract only
- approval must bridge purchase, activation, credit grant, audit, and outbox event in one trusted transaction
- the mobile driver repository still cannot approve, reject, or activate anything

MP7 in this workspace is a backend handoff only. No Go backend source is present here, so no production approval implementation is possible in the mobile repository.

MP8 finalizes the frontend/backend integration contract:

- planned driver claim endpoints are documented in the OpenAPI spec as planned only
- query hooks exist for future backend-backed claim reads
- mutation hooks exist for create/submit/resubmit/cancel only
- local prototype claims remain local prototype claims
- local prototype claims do not auto-sync to the backend
- remote claims are backend-authoritative when the backend team ships them

That prototype is still dormant and does not change checkout runtime behavior. Driver submission remains submission-only until the trusted backend implements the approval transaction.

## Phase MP9

Phase MP9 completes the actual driver-facing manual package payment user experience:
- **Staged Checkout Flow**: Completed a structured staged interface (`PAYMENT_INSTRUCTIONS` -> `CLAIM_FORM` -> `CLAIM_STATUS`) in `driver-package-payment.tsx`.
- **Instruction Stage**: Renders MTN and Airtel instructions with copyable USSD strings generated from templates. Includes a prominent "I have paid" transition action.
- **Form Stage**: Collects provider, payer phone number, and transaction reference. Handles validation, formatting, and prevents duplicate submissions.
- **Status Stage**: Integrates `ManualPaymentClaimStatusCard` to render claims dynamically. Consumes the centralized MP8 presentation policy to show statuses (`submitted`, `pending_review`, `needs_clarification`, `approved`, `rejected`, `expired`, `cancelled`) with themed colors and clear visual feedback.
- **Clarification & Resubmission**: Allows updating provider, phone, and reference when in `needs_clarification` state. Safely mutates with `expectedClaimVersion` and refetches upon version conflicts.
- **Cancellation**: Supports cancelling non-terminal claims with a warning dialog making it clear that cancellation does not refund Mobile Money payments.
- **History Route**: Created `driver-package-payment-status.tsx` as a dedicated claim history route. Shows a list of recent confirmations and navigates to the checkout screen to view details.
- **Privacy & Authority Boundary**: No raw reference or phone data is logged or printed. Local approved status remains a read-model presentation; actual activation/credits require trusted backend authority.
