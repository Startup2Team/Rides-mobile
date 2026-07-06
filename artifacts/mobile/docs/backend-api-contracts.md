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

The mobile driver client must not expose admin approval authority.

Manual payment approval is expected to return, atomically:

- approved claim
- purchase transaction identity
- activation identity
- entitlement version or summary
- notification or event metadata
