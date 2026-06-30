# Server State Foundation

This document defines the TanStack Query foundation for the Rides mobile app.

The app still uses the current repositories and local adapters. Query hooks are added as the next server-state layer, but runtime consumers do not move yet.

## Query Client

The app uses one shared QueryClient from `query/client.ts`.

Default policy:
- retry transient failures
- use `online` network mode
- do not refetch on window focus
- refetch on reconnect
- refetch on mount
- keep cache entries around for a bounded time
- use exponential retry delay

The goal is predictable mobile behavior with offline readiness, not aggressive background churn.

## Query Key Rules

- never use raw string query keys
- use key factories from `query/keys`
- keep keys domain-first
- include stable identifiers in the key
- avoid ad hoc array literals in screens

Examples:
- `profileKeys.current()`
- `savedLocationKeys.list(userId)`
- `rideKeys.active()`
- `driverKeys.vehicles(userId)`
- `driverKeys.vehicle(vehicleId)`
- `packageKeys.catalog()`
- `packageKeys.campaigns()`
- `packageKeys.entitlements(driverId)`
- `packageKeys.purchases(driverId)`
- `packageKeys.offers(driverId, vehicleType)`
- `paymentKeys.methods(userId)`
- `paymentKeys.default(userId)`
- `paymentKeys.billing(userId)`
- `searchKeys.autocomplete(query, near)`
- `searchKeys.reverseGeocode(coords)`

## Cache Policy Matrix

Policies live in `query/policies.ts`.

Current intent:
- profile: medium stale time, moderate cache lifetime
- saved locations: medium stale time, longer cache lifetime
- ride history: medium stale time
- active ride: very short stale time
- driver profile and vehicles: medium stale time
- packages: medium stale time with longer cache lifetime
- notifications: short stale time
- payment methods: long stale time
- search autocomplete and reverse geocode: effectively immediate freshness

The policies are centralized so future fetch behavior can be tuned without changing screens.

## Query Hooks

Wrapper hooks live in `query/hooks`.

Examples:
- `useProfileQuery()`
- `useSavedLocationsQuery(userId)`
- `useNotificationsQuery()`
- `useRideHistoryQuery(userId)`
- `useDriverProfileQuery()`
- `useDriverVehiclesQuery()`
- `useDriverVehicleQuery(vehicleId)`
- `usePackageCatalogQuery()`
- `usePackageCampaignsQuery()`
- `useDriverEntitlementsQuery(driverId)`
- `useDriverPackagePurchasesQuery(driverId)`
- `useAvailablePackageOffersQuery(driverId, vehicleType)`
- `usePackagesQuery(vehicleType)`
- `useCreatePackagePurchaseMutation()`
- `useUpdatePackagePurchaseStatusMutation()`
- `useActivatePackageMutation()`
- `useDeductRideCreditMutation()`
- `usePaymentMethodsQuery()`
- `useDefaultPaymentMethodQuery()`
- `useBillingProfileQuery()`
- `useAddPaymentMethodMutation()`
- `useUpdatePaymentMethodMutation()`
- `useDeletePaymentMethodMutation()`
- `useSetDefaultPaymentMethodMutation()`
- `useSearchAutocompleteQuery(query, options)`
- `useReverseGeocodeQuery(coords)`

These wrappers still call the current repositories. They are the bridge to a future TanStack Query migration, not a runtime rewrite.

## Ownership Rules

- repositories own data-source selection
- query hooks own cache policy and data fetching
- screens should not talk to persistence directly
- screens should not build query keys by hand
- query hooks should stay thin and domain-specific

## Migration Plan

Phase 8A creates the foundation.

Phase 8B can start moving read-heavy domains onto query hooks one at a time:
- profile
- saved locations
- notifications
- vehicles
- packages
- ride history
- payment methods

The active ride and mutation-heavy flows should move later, after query behavior is proven stable.

## Current Query-Backed Domains

Saved locations, shared profile, and notifications are the first production domains that are now backed by TanStack Query.

- `useSavedLocationsQuery(userId)` reads through the repository
- add/edit/delete mutations update the repository and invalidate the saved-locations key
- `SavedLocationsContext` remains as a compatibility facade during the migration
- `useProfileQuery()` and the profile mutations read and write the shared identity through the query layer
- `AuthContext` remains as the session and role compatibility layer
- `useNotificationsQuery()` and the notification mutations read and write the notification feed and read state through the query layer
- the persistence format stays unchanged
- `useDriverVehiclesQuery()` and `useDriverVehicleQuery()` now expose the driver vehicle list and detail projections through the query layer
- vehicle add/update/delete/primary-selection mutations still preserve the existing local driver-profile compatibility path
- `usePackageCatalogQuery()` and `usePackageCampaignsQuery()` now read the package offer source through TanStack Query
- `useDriverEntitlementsQuery(driverId)` and `useDriverPackagePurchasesQuery(driverId)` expose the driver entitlement snapshot and purchase history through the query layer
- package create/update/activate/deduct mutations still preserve the local prototype economics while updating the cache and repository boundary
- `PackageSyncContext` and `DriverEntitlementContext` remain compatibility facades while package callers migrate
- `usePaymentMethodsQuery()`, `useDefaultPaymentMethodQuery()`, and `useBillingProfileQuery()` read payment method and billing preference projections through TanStack Query
- payment method add/update/delete/default mutations update `PaymentRepository`, optimistically update only method caches, and invalidate manually after writes
- payment transaction truth, receipts, refunds, wallet balances, driver payouts, and settlement remain future backend work
