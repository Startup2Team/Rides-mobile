# Package Payment Domain

Package payments are a separate responsibility from saved payment methods.

- `domains/payments` stores saved payment methods and billing profile preferences.
- `domain/driverRidePackages.ts` owns package catalog, offers, purchase history, activation, and credit accounting.
- `domains/package-payments` owns payment mode, manual payment configuration, manual payment claims, transition rules, duplicate-reference policy, expiry policy, and future activation eligibility.

MP2 adds the backend boundary prototype for package-payment configuration and manual claims, but the mobile checkout flow stays dormant and unchanged.
MP3 adds a safe read path for payment configuration only. The query layer can observe automatic, manual, or disabled mode, but checkout behavior still falls back to automatic until a later phase deliberately branches UI.
MP4 adds a mode-aware checkout UI shell only:

- automatic mode keeps the existing simulated purchase flow
- manual mode shows instructions only and does not submit claims
- disabled mode blocks package payment and returns the driver to packages

MP5 adds driver manual claim submission only:

- the mobile app can submit a manual payment claim in manual mode
- submitted claims remain pending review
- mobile submission does not activate packages
- mobile submission does not grant credits
- approval and activation stay backend/admin authority

## Payment Mode

The authoritative mode is a single value:

- `automatic`
- `manual`
- `disabled`

Unknown or malformed values fail closed to `disabled`.

## Manual Payment Flow

Manual payment is a claim workflow, not an activation workflow.
The mobile checkout shell in MP4 showed the payment instruction surface. MP5 adds claim submission, but not approval or activation.

The claim records:

- locked package offer identity
- expected package amount
- provider
- merchant code snapshot
- payer phone number
- provider transaction reference when available
- optional proof reference when enabled
- review and audit history

## Claim Identity

The internal claim ID is a Rides identifier.

The provider transaction reference is separate and is treated as provider evidence, not as the primary claim identity.

## Duplicate Detection

Transaction reference uniqueness is enforced on the tuple:

- provider
- normalized transaction reference

Normalization is conservative. The backend must later enforce a real uniqueness guarantee.

## Expiry

Claims expire from configuration:

`createdAt + claimExpiresAfterMinutes`

Approved, rejected, and cancelled claims stay terminal.

## Activation Boundary

A manual claim never activates a package on the mobile client.

Only a trusted backend/admin path can bridge an approved claim into package activation atomically and idempotently.

Support contact is optional and secondary. The default flow is to submit the claim in-app and wait for review.

## Repository Boundary

`data/remote/repositories/RemotePackagePaymentRepository.ts` is the backend prototype for package-payment configuration and manual claim CRUD.

`data/remote/repositories/packagePaymentShadowRepository.ts` keeps local behavior authoritative and uses remote calls only for diagnostics.

## Privacy

Do not log:

- full payer phone number
- transaction reference
- proof URL or proof storage ID
- support notes
- clarification text

Safe telemetry should stay at the status, provider, latency, and outcome level.
