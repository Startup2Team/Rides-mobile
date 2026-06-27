# Payments Domain

Owns payment methods, wallet metadata, and transaction history.

Owns:
- payment methods
- wallet metadata
- transaction history

Must not own:
- driver verification truth
- ride lifecycle
- saved locations

Current source files outside this domain:
- `persistence/paymentPersistence.ts`
- `app/payment-methods.tsx`

Future migration plan:
- move payment rules into `domains/payments`
- keep writes behind `PaymentRepository`

Ownership:
- repository: `PaymentRepository`
- store: none yet
- query: future payment methods/wallet hooks
- events: payment-method-added, payment-method-removed
