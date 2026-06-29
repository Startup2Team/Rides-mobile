# Ride Lifecycle Blueprint

Phase 9A defines the production ride lifecycle contracts and event-driven integration plan. It does not change the current mock ride lifecycle, UI, navigation, matching, negotiation, payment, or RideProvider behavior.

## Production Lifecycle

The production lifecycle is modeled as an ordered aggregate stream for `aggregateType=ride` and `aggregateId=rideId`.

1. `customer draft`
   The customer has selected draft pickup, destination, and vehicle preferences locally. No production ride aggregate exists yet.
2. `ride requested`
   A customer command creates the ride request. Event: `ride.requested`.
3. `matching started`
   Matching begins for the requested vehicle type and service area. Event: `ride.matching.started`.
4. `driver offered`
   A candidate driver is offered the ride. Event: `ride.driver.offered`.
5. `driver accepted`
   A driver accepts the ride. Event: `ride.driver.accepted`.
6. `driver en route`
   The accepted driver is moving toward pickup. Event: `ride.driver.en_route`.
7. `driver arrived`
   The driver has arrived at pickup. Event: `ride.driver.arrived`.
8. `ride started`
   The ride journey begins. Event: `ride.started`.
9. `ride completed`
   The ride journey ends. Event: `ride.completed`.
10. `fare finalized`
   The final fare is calculated and frozen. Event: `ride.fare.finalized`.
11. `payment authorized`
   Payment authorization succeeds. Event: `ride.payment.authorized`.
12. `payment completed`
   Payment capture/completion succeeds. Event: `ride.payment.completed`.
13. `rating submitted`
   Customer or driver rating is submitted. Event: `ride.rating.submitted`.

## Cancellation Paths

- `customer cancels before accepted`
  Allowed before `ride.driver.accepted`. Produces `ride.cancelled` with reason `customer_before_acceptance`.
- `customer cancels after accepted`
  Allowed after driver acceptance subject to policy. Produces `ride.cancelled` with reason `customer_after_acceptance`.
- `driver cancels`
  Allowed for accepted driver subject to capability and policy. Produces `ride.cancelled` with reason `driver_cancelled`.
- `system cancels`
  Used for policy, safety, fraud, or operational failures. Produces `ride.cancelled` with reason `system_cancelled`.
- `timeout/no driver found`
  Matching expires without an acceptable driver. Produces `ride.timeout` with reason `no_driver_found`.

## Commands

Ride commands are defined in `domains/ride/commands.ts`:

- `RequestRideCommand`
- `CancelRideCommand`
- `AcceptRideCommand`
- `DeclineRideCommand`
- `StartRideCommand`
- `CompleteRideCommand`
- `SubmitRatingCommand`

Every command includes:

- `commandId`
- `idempotencyKey`
- `correlationId`
- `actorId`
- `actorRole`
- `timestamp`
- `payload`

## Events

Ride events are defined in `domains/ride/events.ts` using the shared `DomainEvent<TPayload>` contract.

Each event includes:

- `eventId`
- `aggregateId`, equal to `rideId`
- `aggregateType`, equal to `ride`
- `eventType`
- `eventVersion`
- `sequenceNumber`
- `timestamp`
- `correlationId`
- `causationId`
- `producer`
- `payload`

## Read Models

Read model contracts are defined in `domains/ride/readModels.ts`:

- `ActiveRideReadModel`
- `RideHistoryReadModel`
- `DriverRideRequestReadModel`
- `RideStatus`
- `RidePhase`
- `RideParticipant`
- `RideLocationSnapshot`
- `RideFareSnapshot`

Active ride state must eventually be rebuildable from the ride event stream. Ride history and driver request views should be projector-owned read models.

## Projectors

Ride projectors are implemented and tested as pure transformation functions in `domains/ride/projectors/`:

- `activeRideProjector`
- `rideHistoryProjector`
- `driverRequestProjector`

They transform ride domain events into read models, ignore stale sequence numbers, track applied event ids, and avoid mutating their inputs.

These projectors are registered through a shadow projection manager for diagnostics only. The current RideProvider mock lifecycle remains the active behavior. Shadow projection builds memory-only read models and compares them with production snapshots without changing the user experience.

## Future Command Flow

The future command flow is documented in `domains/ride/commandHandlers.ts`:

1. UI
2. command creator
3. offline mutation engine
4. repository
5. backend
6. realtime event
7. domain event platform
8. projector
9. TanStack Query cache
10. UI

Current ride buttons continue to call the existing RideProvider behavior.

## Idempotency And Ordering

- Every command gets an `idempotencyKey`.
- Backend command endpoints must safely accept duplicate commands.
- Events are deduplicated by `eventId`.
- Events are ordered per ride aggregate by `sequenceNumber`.
- Stale events with an older or already-applied sequence are ignored.
- Active ride snapshots can be rebuilt from events.
- On app resume, the app must reconcile the active ride from a backend snapshot before replaying fresh realtime events.

## One-App Actor Model

- The same user can act as a customer or approved driver.
- Customer commands use `actorRole=customer`.
- Driver commands use `actorRole=driver`.
- Driver commands require the driver capability and approved vehicle/session state.
- The shared account identity remains canonical across customer and driver actions.

## Runtime Guardrail

Phase 9D keeps the existing mock lifecycle as the runtime source of truth. Ride projectors can run in shadow mode for diagnostics, but they are not wired into UI, RideProvider state updates, navigation, matching, negotiation, payment, driver flows, packages, repositories, or realtime behavior.
