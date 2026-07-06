# Repositories

`domains/payments/repository.ts` manages saved payment methods and billing profile reads/writes.

`domains/package-payments/repository.ts` defines the future package-payment repository contract.

`data/remote/repositories/RemotePackagePaymentRepository.ts` is the current backend prototype for package-payment configuration and manual claim CRUD.
`query/hooks/usePackagePaymentConfigQuery.ts` is the dormant read path for package-payment configuration. It always exposes a safe automatic fallback when configuration is missing, malformed, or unavailable.
`query/hooks/useManualPaymentClaimsQuery.ts` and `query/hooks/useManualPaymentClaimQuery.ts` are backend-ready read hooks for future remote claims.
`query/hooks/useManualPaymentClaimMutations.ts` is the future driver mutation boundary for claim submission and cancellation flows.

`data/remote/repositories/packagePaymentShadowRepository.ts` wraps a local repository and uses remote calls only for diagnostics.
Write shadowing for manual claims is disabled by default to avoid duplicate review records.
`data/repositories/packagePaymentRepositoryFactory.ts` currently returns a local prototype repository by default and supports explicit `local`, `shadow_remote`, and `remote` modes for future backend readiness.

That package-payment repository is intentionally driver-facing only:

- it can read configuration
- it can create, submit, resubmit, cancel, and list driver claims
- it does not expose admin approval or rejection methods
- it does not expose approval, rejection, activation, or credit-grant authority
- it does not auto-upload local prototype claims to a backend

`app/driver-package-payment.tsx` now consumes the configuration read path to choose between automatic checkout, a manual instruction shell, and a disabled shell. Automatic mode still uses the existing simulated purchase behavior.
In MP5, manual mode also exposes claim submission, but the UI still cannot approve, reject, or activate packages.

MP6 adds the admin review and atomic approval boundary as contracts and policies only:

- approval DTOs exist in `data/remote/contracts/api/packagePaymentApi.ts`
- verification evidence and review policies are typed in `domains/package-payments`
- driver repositories still expose no admin mutation methods
- no mobile path can approve, reject, or force-activate a claim
- package activation still belongs to the package entitlement domain and future trusted backend work

MP7 does not add a backend implementation in this workspace because no Go backend source is present. The repository boundary remains a handoff contract only.

Admin operations belong to a separate backend authority boundary.

MP8 adds frontend-readiness only:

- status presentation is centralized
- failure presentation is centralized
- local-to-remote claim migration is documented
- OpenAPI planned contracts are marked as planned, not live
