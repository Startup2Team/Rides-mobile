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

MP3 adds a read-only configuration query path:

- the app can observe automatic, manual, or disabled mode
- malformed, missing, or unavailable configuration falls back to automatic
- checkout behavior does not branch yet

MP4 adds a mode-aware checkout shell:

- automatic mode keeps the current simulated payment flow
- manual mode shows USSD instructions only
- disabled mode blocks package payment

MP5 adds driver claim submission:

- manual mode can submit a claim after the driver pays
- the claim stays pending review
- the mobile client still cannot approve, reject, or activate packages
- credits still come only from the package entitlement path

That prototype is still dormant and does not change checkout runtime behavior.
