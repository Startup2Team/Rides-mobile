# Vehicle Domain

Query-backed vehicle domain for the one-app driver projection.

Owns:
- vehicle list
- active/primary vehicle selection
- vehicle verification projection
- vehicle identity and photos

Must not own:
- shared driver profile
- driver approval state
- package entitlements
- active ride lifecycle
- online/offline state

Current source files outside this domain:
- `domain/driverVehicles.ts`
- `query/hooks/useDriverVehiclesQuery.ts`
- `app/driver-vehicles.tsx`
- `app/driver-add-vehicle.tsx`
- `app/driver-vehicle-details.tsx`
- `app/(driver)/index.tsx`
- `app/(driver)/profile.tsx`

Current behavior:
- the repository still persists through the existing local driver profile storage
- query hooks are now the canonical read and mutation surface
- compatibility screens can still bridge through `AuthContext` until they are fully migrated
- the first remote repository prototype is available in `SHADOW_REMOTE` diagnostics mode only
- local remains the authoritative source of truth for vehicle ownership, selection, and verification state

Future migration plan:
- keep the repository boundary stable
- move more screens to the query hooks as the compatibility layer is reduced
- keep capability resolution derived from the same vehicle truth
- use the remote prototype only to validate backend DTO contracts before any HYBRID or REMOTE rollout
- keep vehicle verification/admin approval backend-owned in the future, not app-owned

Ownership:
- repository: `vehicleRepository`
- store: none yet
- query: `useDriverVehiclesQuery`, `useDriverVehicleQuery`
- mutations: add, update, delete, primary selection
- events: vehicle-approved, vehicle-rejected
- remote prototype: `RemoteVehicleRepository` in `SHADOW_REMOTE` only
