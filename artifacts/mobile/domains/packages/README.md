# Packages Domain

Owns driver package catalog, campaigns, and entitlements.

Owns:
- package catalog
- campaigns
- entitlements
- package offer source

Must not own:
- ride lifecycle
- customer booking draft
- saved locations

Current source files outside this domain:
- `context/PackageSyncContext.tsx`
- `services/packageSyncRepositories.ts`
- `domain/driverRidePackages.ts`

Future migration plan:
- move package rules into `domains/packages`
- keep data access behind `PackageRepository`
- avoid letting package state mutate ride truth directly

Ownership:
- repository: `PackageRepository`
- store: none yet
- query: future package catalog hooks
- events: package-activated, package-purchased
