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

- `SavedLocationsRepository`
  - saved place CRUD
  - ordering
  - validation

- `DriverRepository`
  - driver profile
  - availability
  - driver-side identity projection

- `VehicleRepository`
  - vehicle list
  - active vehicle selection

- `PackageRepository`
  - package catalog
  - campaigns
  - offer source cache

- `NotificationRepository`
  - notification read state

- `PaymentRepository`
  - payment methods

- `SearchRepository`
  - search history
  - search suggestions

- `MapRepository`
  - reverse geocoding and map lookup helpers

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
