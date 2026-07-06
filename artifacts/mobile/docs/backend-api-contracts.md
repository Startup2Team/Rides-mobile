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

The configuration lookup is read-only and safe-falls back to automatic mode on the mobile client until a later phase chooses to branch checkout UI.

The mobile driver client must not expose admin approval authority.

The backend approval response is expected to be atomic with package activation in future backend work. The mobile client does not perform that activation.

Manual payment approval is expected to return, atomically:

- approved claim
- purchase transaction identity
- activation identity
- entitlement version or summary
- notification or event metadata

Relevant contracts:

- `data/remote/contracts/api/packagePaymentApi.ts`
- `data/remote/backendClient.ts`
- `data/remote/mappers/packagePaymentMapper.ts`
