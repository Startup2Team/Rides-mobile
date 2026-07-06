# Packages Domain

Owns driver package catalog, campaigns, offers, entitlements, purchases, activation, balance, and credit rules.

Owns:
- package catalog
- campaigns
- offers
- driver entitlements
- package purchases
- package activation
- package balance and ride credits
- eligibility rules

Must not own:
- payment truth
- ride lifecycle truth
- driver approval truth
- vehicle verification truth
- customer booking truth

Current source files outside this domain:
- `context/PackageSyncContext.tsx`
- `context/DriverEntitlementContext.tsx`
- `services/packageSyncRepositories.ts`
- `domain/driverRidePackages.ts`

Current implementation notes:
- catalog and campaigns are query-backed from the shared package sync cache
- entitlements and purchases are query-backed from secure storage
- package mutations preserve current local prototype behavior
- compatibility contexts remain in place for legacy callers

Future migration plan:
- move remaining package screens to read from the query/domain hooks directly
- replace compatibility contexts once all callers are migrated
- introduce backend truth behind the repository boundary without changing screen code
- keep the remote package prototype in `SHADOW_REMOTE` until the credit and
  payment-linked safeguards are proven

Remote prototype status:
- `RemotePackageRepository` exists as the fifth concrete remote repository
  prototype
- it can exercise catalog, campaigns, offer source, offers, entitlement,
  purchase, activation, and credit-deduction DTOs in `SHADOW_REMOTE`
- local package economics remain authoritative until a later rollout phase
- payment truth is still future work and must stay outside this domain until
  the backend/payment boundary is explicitly ready

Ownership:
- repository: `packageRepository` plus entitlement storage helpers
- store: none
- query: package catalog, campaigns, entitlements, purchases, offers
- events: package-activated, package-purchased, credit-deducted
