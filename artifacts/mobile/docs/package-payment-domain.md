# Package Payment Domain

Package payments are a separate responsibility from saved payment methods.

- `domains/payments` stores saved payment methods and billing profile preferences.
- `domain/driverRidePackages.ts` owns package catalog, offers, purchase history, activation, and credit accounting.
- `domains/package-payments` owns payment mode, manual payment configuration, manual payment claims, transition rules, duplicate-reference policy, expiry policy, and future activation eligibility.

## Payment Mode

The authoritative mode is a single value:

- `automatic`
- `manual`
- `disabled`

Unknown or malformed values fail closed to `disabled`.

## Manual Payment Flow

Manual payment is a claim workflow, not an activation workflow.

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

## Privacy

Do not log:

- full payer phone number
- transaction reference
- proof URL or proof storage ID
- support notes
- clarification text

Safe telemetry should stay at the status, provider, latency, and outcome level.
