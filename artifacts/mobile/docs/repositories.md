# Repositories

`domains/payments/repository.ts` manages saved payment methods and billing profile reads/writes.

`domains/package-payments/repository.ts` defines the future package-payment repository contract.

That package-payment repository is intentionally driver-facing only:

- it can read configuration
- it can create, submit, resubmit, cancel, and list driver claims
- it does not expose admin approval or rejection methods

Admin operations belong to a separate backend authority boundary.
