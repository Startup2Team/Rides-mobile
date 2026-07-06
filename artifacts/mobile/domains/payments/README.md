# Payments Domain

Owns payment methods and billing preferences.

Owns:
- payment methods
- default payment method
- billing profile
- mobile money configuration
- card metadata
- payment preferences

Must not own:
- driver verification truth
- ride lifecycle
- saved locations
- payment transactions
- receipts
- refunds
- settlement
- wallet balance
- earnings
- withdrawals

Current source files outside this domain:
- `persistence/paymentPersistence.ts`
- `app/payment-methods.tsx`

Current query-backed read models:
- `usePaymentMethodsQuery()` reads payment methods through `PaymentRepository`
- `useDefaultPaymentMethodQuery()` reads the default method projection through `PaymentRepository`
- `useBillingProfileQuery()` derives billing preferences from repository-backed payment methods

Prototype remote repository:
- `RemotePaymentRepository` is the sixth remote repository prototype
- it can exercise payment-method list/default/billing-profile and payment-method CRUD/default-selection DTOs in `SHADOW_REMOTE`
- local payment methods remain authoritative
- payment execution, capture, refunds, settlement, wallet balance, and transaction truth stay out of scope
- the rollout path remains conservative because these flows are financially sensitive

Future migration plan:
- move payment rules into `domains/payments`
- keep writes behind `PaymentRepository`
- transaction truth remains future backend work

Ownership:
- repository: `PaymentRepository`
- store: none yet
- query: payment method and billing profile hooks
- events: payment-method-added, payment-method-removed
