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

Current query-backed read models:
- `rideHistoryRepository.listRideHistory()` reads completed ride history through `RideRepository`
- `rideHistoryRepository.getRideDetail(rideId)` reads a ride detail snapshot through `RideRepository`

Remote prototype:
- Phase 12I adds `RemoteRideRepository` for read-only active ride, ride history, and ride detail reads
- `SHADOW_REMOTE` diagnostics run after local reads and never mutate UI/state
- local/live-provider ride lifecycle behavior remains authoritative
- ride request, cancel, accept, decline, start, complete, matching, negotiation, payment, package credit deduction, and realtime event integration remain future work

Future migration plan:
- move lifecycle logic into `domains/ride`
- keep repository boundary in `RideRepository`
- move toward event projection as backend support matures

Ownership:
- repository: `RideRepository`
- store: future rideStore
- query: ride history and ride detail read hooks
- events: ride lifecycle event stream
