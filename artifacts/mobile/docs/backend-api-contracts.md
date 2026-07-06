# Backend API Contracts

Package payments introduce a new API boundary that is distinct from payment methods and package purchases.

Current blueprint:

- `data/remote/contracts/api/packagePaymentApi.ts`

It models:

- package payment configuration lookup
- manual payment claim creation
- driver claim lookup and listing
- claim submission, resubmission, and cancellation
- admin review queue, detail, clarification, reject, and approve operations
- approval evidence, expected version, idempotency, and approval result blueprints
- backend-safe read-model fields for driver-visible claims
- cursor pagination for driver claim listings
- planned OpenAPI contracts for the future Go backend

The configuration lookup is read-only and safe-falls back to automatic mode on the mobile client until a later phase chooses to branch checkout UI.

The mobile driver client must not expose admin approval authority.

The backend approval response is expected to be atomic with package activation in future backend work. The mobile client does not perform that activation and does not expose admin mutations through its driver repository.

Manual payment approval is expected to return, atomically:

- approved claim
- purchase transaction identity
- activation identity
- credit transaction identity
- entitlement version or summary
- notification or event metadata

The request contract requires:

- expected claim version
- verification evidence
- idempotency key

The backend must reject client-supplied entitlement overrides, package overrides, activation IDs, or direct approval statuses.

Driver-facing claim responses should expose only safe fields such as:

- display claim ID
- status and version
- package snapshot
- vehicle snapshot
- expected amount
- provider
- masked payer phone or transaction-reference presence
- created/submitted/expires/updated timestamps
- safe clarification, rejection, and approval markers

They should not expose reviewer identity, internal notes, raw verification content, or secrets.

Driver claim listing is cursor-based in the finalized frontend contract. Admin queue listing stays page-based.

Relevant contracts:

- `data/remote/contracts/api/packagePaymentApi.ts`
- `data/remote/backendClient.ts`
- `data/remote/mappers/packagePaymentMapper.ts`

MP7 note:

- no Go backend is present in this workspace
- these are mobile-side contracts and backend blueprints only
- implementation must be handed off to the future Go service

MP8 note:

- the frontend contract is finalized for backend implementation
- the mobile client remains backend-ready but backend-independent
- the OpenAPI spec marks these endpoints as planned, not live
