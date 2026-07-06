# Backend Integration Boundary

The package-payment boundary is intentionally split into three layers:

- package catalog and credits in `domain/driverRidePackages.ts`
- payment methods in `domains/payments`
- package payment mode and manual claims in `domains/package-payments`

Manual payment must remain policy-only until the backend is ready to own:

- payment configuration
- claim review
- duplicate detection
- approval
- activation
- notification

The mobile client should only model the claim lifecycle and never self-approve a payment.

MP2 adds the backend/repository prototype only:

- remote package-payment repository
- mapper layer between DTOs and domain
- shadow repository diagnostics

MP3 adds a read-only configuration query path that can observe backend-controlled payment mode while still falling back to automatic mode locally.

It still does not wire driver UI, admin UI, activation authority, or ride-credit mutation.
