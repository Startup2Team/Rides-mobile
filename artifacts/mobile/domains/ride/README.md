# Ride Domain

Owns active ride truth and ride lifecycle projections.

Owns:
- active ride
- ride history
- lifecycle events
- matching projection

Must not own:
- booking draft
- driver verification
- package catalog

Current source files outside this domain:
- `context/ride/RideProvider.tsx`
- `context/ride/rideContract.ts`
- `context/ride/ridePersistence.ts`

Future migration plan:
- move lifecycle logic into `domains/ride`
- keep repository boundary in `RideRepository`
- move toward event projection as backend support matures

Ownership:
- repository: `RideRepository`
- store: future rideStore
- query: future ride history hooks
- events: ride lifecycle event stream
