# Repositories

`domains/payments/repository.ts` manages saved payment methods and billing profile reads/writes.

`domains/package-payments/repository.ts` defines the future package-payment repository contract.

`data/remote/repositories/RemotePackagePaymentRepository.ts` is the current backend prototype for package-payment configuration and manual claim CRUD.
`query/hooks/usePackagePaymentConfigQuery.ts` is the dormant read path for package-payment configuration. It always exposes a safe automatic fallback when configuration is missing, malformed, or unavailable.

`data/remote/repositories/packagePaymentShadowRepository.ts` wraps a local repository and uses remote calls only for diagnostics.
`data/repositories/packagePaymentRepositoryFactory.ts` currently returns a local prototype repository that can persist and submit driver manual claims without exposing admin authority.

That package-payment repository is intentionally driver-facing only:

- it can read configuration
- it can create, submit, resubmit, cancel, and list driver claims
- it does not expose admin approval or rejection methods

`app/driver-package-payment.tsx` now consumes the configuration read path to choose between automatic checkout, a manual instruction shell, and a disabled shell. Automatic mode still uses the existing simulated purchase behavior.
In MP5, manual mode also exposes claim submission, but the UI still cannot approve, reject, or activate packages.

Admin operations belong to a separate backend authority boundary.
