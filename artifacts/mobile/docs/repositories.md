# Repositories

This document defines the repository boundary for the Rides mobile app.

Rides is one app with shared identity, shared session, and role projections for customer and driver. Repositories are the data boundary that sits between app state and data sources.

## Repository Tree

```
data/
  repositories/
    interfaces.ts
    index.ts
  adapters/
    localRepositories.ts
  sources/
    localDataSources.ts
    localRideDataSource.ts
```

## Ownership Rules

Each domain has a single repository contract.

- `AuthRepository`
  - current user
  - driver profile
  - session boundary
  - OTP/session remote prototype in diagnostics mode
  - local session remains authoritative

- `ProfileRepository`
  - shared user identity
  - profile image and profile media helpers
  - profile preferences and settings

- `BookingRepository`
  - booking draft ownership
  - transient booking flow state

- `RideRepository`
  - ride history
  - ride append/replay boundaries
  - read-only active/history/detail remote prototype in diagnostics mode
  - lifecycle mutations remain local/live-provider controlled

- `SavedLocationsRepository`
  - saved place CRUD
  - ordering
  - validation

- `DriverRepository`
  - driver profile
  - availability
  - driver-side identity projection
  - driver onboarding/application remote prototype in diagnostics mode
  - mobile does not own approval authority

- `VehicleRepository`
  - vehicle list
  - active vehicle selection
  - single vehicle lookup
  - vehicle create/update/delete operations

- `PackageRepository`
  - package catalog
  - campaigns
  - offer source cache
  - entitlement and purchase history access through the package domain facade
  - package balance and credit rules remain local-authoritative for now

- `NotificationRepository`
  - notification read state

- `PaymentRepository`
  - payment methods
  - default payment method updates
  - payment method metadata updates
  - billing profile projection
  - local-authoritative method storage until backend payment truth exists

- `SearchRepository`
  - search history
  - search suggestions
  - place search/autocomplete/detail diagnostics prototype

- `MapRepository`
  - reverse geocoding and map lookup helpers
  - route/distance/duration/fare-preview diagnostics prototype

## Dependency Rules

Allowed direction:

`Screen -> Store/Context -> Repository -> Data Source`

Forbidden direction:

- screens importing persistence modules
- screens importing raw data sources
- screens importing backend clients directly
- data sources importing screens or components
- repositories depending on UI state

## Current Local Strategy

The current app still behaves the same because the local repository adapters wrap the existing persistence and service modules.

That gives us:

- a stable API for screens and contexts
- one place to swap local, remote, or hybrid sources later
- a single point for cache, retry, and offline policy

## Future Backend Strategy

Repository implementations will be able to move to hybrid or remote sources without screen changes.

The expected progression is:

1. Local repository adapter
2. Hybrid local plus remote repository
3. Remote-first repository with cache fallback

## Future Offline Strategy

Repositories are the correct place to add:

- cache hydration
- stale-while-revalidate
- mutation queueing
- retry and backoff
- conflict resolution
- idempotency

## Current Low-Risk Consumers

The first extracted domain consumer is the saved-locations flow.

- `SavedLocationsContext` now depends on `savedLocationsRepository`
- behavior stays the same
- storage format stays the same
- UI and navigation stay unchanged

Phase 7F adds the first domain boundary under `domains/saved-locations/`.

- `domains/saved-locations/types.ts` re-exports the saved-location type
- `domains/saved-locations/repository.ts` re-exports the repository contract and instance
- `domains/saved-locations/hooks.ts` wraps the existing context for compatibility
- `hooks/useSavedLocations.ts` now forwards through the domain entry point
- the context remains the compatibility layer until a later TanStack Query migration

Phase 12C adds the first real remote repository prototype for saved locations.

- `RemoteSavedLocationsRepository` maps saved-location DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local remains authoritative for current UI behavior
- the rollout path remains `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`

Phase 12D adds the same remote prototype path for shared profile identity.

- `RemoteProfileRepository` maps profile, photo, and phone DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local profile persistence remains authoritative for current UI behavior
- the rollout path remains `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`

Phase 12E adds the same remote prototype path for notifications.

- `RemoteNotificationRepository` maps notification feed and read-state DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local notification persistence remains authoritative for current UI behavior
- the rollout path remains `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`

Phase 12F adds the same remote prototype path for driver vehicles.

- `RemoteVehicleRepository` maps vehicle list, detail, create/update/delete, and primary-selection DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local driver-profile-backed vehicle truth remains authoritative for current UI behavior
- the rollout path remains `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`

Phase 12G adds the same remote prototype path for packages and entitlements.

- `RemotePackageRepository` maps catalog, campaign, offer-source, available-offer, entitlement, purchase, activation, and credit-deduction DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local package economics, purchase history, balance, and credit deduction remain authoritative for current UI behavior
- because this domain touches driver credits and payment-linked flows, the rollout path remains conservative and should only advance after extra financial safeguards are in place

Phase 12H adds the same remote prototype path for payment methods and billing preferences.

- `RemotePaymentRepository` maps payment-method list, default, billing-profile, create, update, delete, and default-selection DTOs through the backend boundary
- `SHADOW_REMOTE` runs the remote path only for diagnostics
- local payment methods remain authoritative for current UI behavior
- payment execution, settlement, refunds, wallet balance, and transaction truth remain future work and must stay out of this prototype

Phase 12I adds the first read-only remote prototype path for rides.

- `RemoteRideRepository` maps active ride, ride history, and ride detail DTOs through the backend boundary
- active ride responses stay in the active ride read-model shape, while history and detail responses map back into the existing `Ride` domain/UI shape
- `createRideReadOnlyShadowRepository` runs remote reads only after local reads and ignores remote results for UI/state
- local/live-provider ride lifecycle behavior remains authoritative
- request, cancel, accept, decline, start, complete, matching, negotiation, payment, package credit deduction, and realtime ride events remain future work and must stay out of this prototype

Phase 12J adds the remote prototype path for driver onboarding and driver applications.

- `RemoteDriverRepository` maps driver application/profile, application status, submit/update, document metadata/reference, and clarification DTOs through the backend boundary
- `createDriverShadowRepository` runs local first and remote second, then ignores remote results for UI/state
- local driver onboarding and current driver approval runtime behavior remain authoritative
- the one canonical account identity remains intact; approved driver capability is a future backend-granted capability on the same account, not a second user
- mobile cannot approve, reject, force verification, or manufacture verified status
- driver document contracts are metadata/reference-only and must not carry raw bytes or base64 document data
- telemetry is sanitized to safe semantic categories and must not emit national ID, DOB, license number, MoMo pay code, phone number, document contents, document URLs, or signed URLs

Phase 12K adds the remote prototype path for auth.

- `RemoteAuthRepository` maps OTP dry-run request, OTP verify, session refresh, logout, and current-session DTOs through the backend boundary
- `createAuthShadowRepository` runs local first and remote diagnostics second only when explicitly configured
- local auth/session state, `AuthContext`, navigation, and phone verification behavior remain authoritative
- shadow `requestOtp` must use a backend dry-run/non-delivery diagnostics endpoint and must never call the real SMS-producing OTP request endpoint
- remote tokens and session responses are ignored and must not mutate token persistence or the current app session
- telemetry is sanitized and must not emit OTP codes, raw access tokens, raw refresh tokens, full phone numbers, session secrets, or device secrets
- the rollout path remains `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`, with HYBRID/REMOTE reserved until backend auth authority and token persistence are explicitly designed

Phase 12L adds remote prototype paths for search and map.

- `RemoteSearchRepository` maps place search, autocomplete, place detail, and reverse-geocode DTOs into existing `GeocodeSuggestion` / location shapes
- `RemoteMapRepository` maps reverse geocode, route estimate/preview, distance, duration, and fare-preview DTOs into existing route/location preview shapes
- `createSearchShadowRepository` and `createMapShadowRepository` run local first and remote diagnostics second only when explicitly configured
- current local/Mapbox search, route rendering, booking, matching, navigation, and pricing behavior remain authoritative
- search comparisons use semantic overlap and tolerate ranking differences
- map comparisons use explicit coordinate, distance, duration, and fare-preview tolerances
- fare estimates are preview-only and must not become final fare truth
- telemetry must not include raw address queries, exact saved/home addresses, full route geometry, precise movement history, Mapbox tokens, access tokens, or backend secrets

Phase 12M adds the remote prototype readiness matrix.

- `data/remote/readiness/` centralizes contract, shadow, and safety scoring
  for every remote prototype domain
- the matrix is read-only diagnostics and does not change repository source
  selection, persistence, or UI behavior
- local repositories remain authoritative while the matrix identifies safe
  future staging candidates
- financial, lifecycle, and identity/security domains keep extra rollout gates
  before remote authority can be considered
- the current safe staging path starts with saved locations and shared profile
  data, then expands to other shadow-ready domains as backend confidence grows

Phase 13A adds the first real staging shadow integration for saved locations.

- `data/repositories/savedLocationsRepositoryFactory.ts` is the controlled
  source-selection point for saved locations
- default repository mode remains `LOCAL`
- `EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE=SHADOW_REMOTE` can enable
  saved-location read shadow only when backend environment is explicitly
  `STAGING` with a valid HTTPS base URL
- `REMOTE` and `HYBRID` remain blocked through environment configuration
- local saved locations remain authoritative for queries, context, screens,
  navigation, and UI behavior
- write shadowing is independently controlled by
  `EXPO_PUBLIC_SAVED_LOCATIONS_SHADOW_WRITES_ENABLED` and defaults to false
- screens, hooks, providers, `RideProvider`, auth, payments, matching, and
  realtime behavior are unchanged

Phase 13B adds the profile staging shadow integration.

- `data/repositories/profileRepositoryFactory.ts` is the controlled source
  selection point for profile
- default repository mode remains `LOCAL`
- `EXPO_PUBLIC_PROFILE_REPOSITORY_MODE=SHADOW_REMOTE` can enable profile read
  shadow only when backend environment is explicitly `STAGING` with a valid
  HTTPS base URL
- `REMOTE` and `HYBRID` remain blocked through environment configuration
- local profile behavior remains authoritative for identity, photo, and
  compatibility reads
- write shadowing is independently controlled by
  `EXPO_PUBLIC_PROFILE_SHADOW_WRITES_ENABLED` and defaults to false
- `AuthContext`, session persistence, and profile screens are unchanged
- the one-account customer/driver model stays intact

Phase 7G makes `profile` the next extracted domain module without changing runtime behavior.

- `domains/profile/types.ts` owns the shared identity projection
- `domains/profile/repository.ts` exposes the shared profile repository
- `domains/profile/hooks.ts` keeps the compatibility hooks available for current screens and components
- `AuthContext` remains the session and mode compatibility layer

Phase 8A adds the query foundation and capability layer.

- [`docs/server-state.md`](./server-state.md) defines the TanStack Query client, policies, and hook wrappers
- [`docs/capabilities.md`](./capabilities.md) defines the derived permission model for customer and driver projections
- repositories remain the data boundary underneath the query layer
- screens still must not import persistence or sources directly

Phase 8B.1 moves saved locations onto the query layer without changing the repository contract.

- `useSavedLocationsQuery(userId)` is the canonical read surface
- add/edit/delete mutations update the repository and invalidate the saved-locations cache
- `SavedLocationsContext` stays in place as a compatibility facade for existing screens
- saved locations are now query-backed, but storage format and repository behavior stay the same

Phase 8B.2 moves the shared profile onto the query layer.

- `useProfileQuery()` and profile mutations read and write the shared identity through the repository boundary
- `AuthContext` remains the session and mode compatibility layer

Phase 8B.3 moves notifications onto the query layer.

- `useNotificationsQuery()` reads the notification feed through the repository boundary
- notification read state remains repository-owned and still uses the existing local payload
- notifications are now query-backed while the current local feed and persistence format stay compatible

Phase 8B.4 moves driver vehicles onto the query layer.

- `useDriverVehiclesQuery()` reads the driver vehicle list through the repository boundary
- `useDriverVehicleQuery(vehicleId)` reads a single vehicle projection through the same repository boundary
- add/update/delete/primary-selection mutations still use the existing local repository implementation
- `vehicleRepository` remains the source boundary while the current auth-session compatibility path stays intact

Phase 8B.5 moves driver packages and entitlements onto the query layer.

- `usePackageCatalogQuery()` and `usePackageCampaignsQuery()` read the shared package generation through TanStack Query
- `useDriverEntitlementsQuery(driverId)` and `useDriverPackagePurchasesQuery(driverId)` read the entitlement snapshot and purchase history through TanStack Query
- `useAvailablePackageOffersQuery(driverId, vehicleType)` derives active offers from catalog, campaigns, and entitlement state
- `PackageSyncContext` and `DriverEntitlementContext` remain compatibility facades while package callers migrate
- local package economics, credit rules, and payment simulation behavior stay unchanged

Phase 8B.7 moves payment methods onto the query layer.

- `usePaymentMethodsQuery()` reads saved payment methods through `PaymentRepository`
- `useDefaultPaymentMethodQuery()` and `useBillingProfileQuery()` expose repository-backed read models for billing preferences
- add/update/delete/default mutations write through the repository and invalidate payment method caches
- payment processing, transaction truth, receipts, refunds, wallet balances, earnings, withdrawals, and settlement remain outside the payments domain for now
- the payment screen keeps its current UI, local persistence format, and payment simulation behavior

## Domain-First Direction

Phase 7E adds the [`domains/`](../domains/) scaffold and the typed ownership map in `domains/domainOwnership.ts`.

That scaffold does not change runtime behavior. It simply makes the future migration path explicit:

1. domain ownership is documented
2. repository boundaries stay stable
3. domain-specific stores and query hooks can be moved in later phases
4. file moves can happen with less risk because the ownership model is already frozen in docs and tests

Phase 7F makes `saved-locations` the first real extracted domain module without changing runtime behavior.

The repository layer remains the correct boundary for source selection while the domain scaffold becomes the organizational map for the next phases.
This is the domain-first direction for the app.

Phase 8B.5 extends that direction into packages:

- the package domain owns catalog, campaigns, entitlements, purchases, activation, and credits
- the repository facade still preserves the local prototype payment behavior
- compatibility contexts remain until all callers migrate to the package domain and query hooks

Phase 8B.7 extends it into payment methods:

- the payments domain owns method metadata, default method selection, and billing preference projections
- `PaymentRepository` remains the source boundary
- transaction truth remains future backend work
