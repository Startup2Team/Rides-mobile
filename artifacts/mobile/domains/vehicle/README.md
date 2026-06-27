# Vehicle Domain

Owns vehicle list and vehicle selection.

Owns:
- vehicle list
- active vehicle selection
- vehicle verification projection

Must not own:
- booking draft
- ride lifecycle
- package catalog

Current source files outside this domain:
- `domain/driverVehicles.ts`
- `persistence/driverProfilePersistence.ts`
- `app/driver-vehicles.tsx`

Future migration plan:
- move vehicle rules into `domains/vehicle`
- keep data access behind `VehicleRepository`

Ownership:
- repository: `VehicleRepository`
- store: none yet
- query: future vehicle hooks
- events: vehicle-approved, vehicle-rejected
