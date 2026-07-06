# Package Payments

This domain owns package-payment initiation policy and manual payment claims.

It is separate from `domains/payments`, which only manages saved payment methods and billing profile data.
It is also separate from the package entitlement domain in `domain/driverRidePackages.ts`, which owns catalog resolution, package offers, purchases, activations, and ride-credit accounting.

The package-payment domain is intentionally dormant in this phase:

- it models payment mode as `automatic`, `manual`, or `disabled`
- it validates manual payment configuration
- it builds and validates manual payment claims
- it defines duplicate-reference, expiry, transition, and activation-eligibility policies
- it does not activate packages
- it does not grant credits
- it does not call payment providers
- it does not expose admin approval authority to the mobile driver client

MP2 adds the repository/backend boundary prototype:

- remote repository implementation
- DTO mapping layer
- shadow repository diagnostics

That prototype is still dormant and does not change checkout runtime behavior.
