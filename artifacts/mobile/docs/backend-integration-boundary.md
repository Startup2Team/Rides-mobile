# Backend Integration Boundary

The package-payment boundary is intentionally split into three layers:

- package catalog and credits in `domain/driverRidePackages.ts`
- payment methods in `domains/payments`
- package payment mode and manual claims in `domains/package-payments`

Manual payment must remain policy-only until the backend is ready to own:

- payment configuration
- claim review
- duplicate detection
- approval
- activation
- notification

The mobile client should only model the claim lifecycle and never self-approve a payment.

MP6 defines the backend/admin review contract without moving authority into the app:

- review eligibility is versioned
- verification evidence is typed and sanitized
- approval is an atomic backend transaction
- approval must bridge purchase, activation, credit grant, audit, and outbox event
- the driver repository remains submission-only

MP2 adds the backend/repository prototype only:

- remote package-payment repository
- mapper layer between DTOs and domain
- shadow repository diagnostics

MP3 adds a read-only configuration query path that can observe backend-controlled payment mode while still falling back to automatic mode locally.

It still does not wire driver UI, admin UI, activation authority, or ride-credit mutation.

MP7 adds a backend handoff only in this workspace:

- no Go backend source exists here
- no production backend authority is available to implement approval
- the mobile app remains submission-only

MP8 finalizes the frontend contract boundary:

- safe claim read-model hooks exist for future backend claims
- claim presentation is centralized by status
- failure presentation is centralized by safe category
- mutation hooks exist only for create/submit/resubmit/cancel
- no approval, rejection, activation, or credit-grant mutation exists in the mobile client
- local prototype claims are explicitly legacy prototype data, not trusted payment records

## Phase MP9 Status

Phase MP9 completes the driver-facing manual package payment checkout, status card, and history views, while strictly maintaining the integration boundaries:
- **No Client-Side Approval**: The frontend remains completely submission-only. Tapping "I have paid" merely creates and submits a claim to the repository. Approved/Rejected claims are read-only presentations.
- **No Entitlement Mutation**: An approved manual claim UI reads status from the local or remote query, but does NOT call `activatePackage`, modify `DriverEntitlementContext`, or grant credits locally. Active status must be driven by backend authority.
- **Strict Privacy**: Payer phone numbers and transaction references are masked before display. No sensitive fields (payer phone, transaction reference) are logged or echoed to telemetry.

