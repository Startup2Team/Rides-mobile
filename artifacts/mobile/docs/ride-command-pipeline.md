# Ride Command Pipeline

Phase 10C adds a safe infrastructure-only command pipeline for ride actions.
It validates and classifies commands, but it does not change runtime ride
behavior.

## Current State

- Commands are created by `domains/ride/commandCreators.ts`
- The pipeline consumes those typed commands
- `RideProvider` remains the production source of truth
- UI buttons are not wired to the pipeline yet

## Pipeline Modes

- `disabled`: no work is performed
- `dryRun`: validate and emit telemetry only
- `shadow`: validate, emit telemetry, and keep diagnostic records
- `enqueueReady`: build an offline mutation preview only

Production stays disabled. Dev/test defaults to dry-run or shadow.

## Routing

The pipeline routes the current ride commands:

- request ride
- cancel ride
- accept ride
- decline ride
- start ride
- complete ride
- submit rating

Each route defines priority, safety, online requirement, idempotency
requirement, actor capability requirement, and the future mutation type name.

## Offline Preview

`toOfflineMutationPreview()` converts a command into a future offline mutation
envelope. It does not enqueue anything by default.

## Rollback Strategy

`rideCommandPipeline` is isolated from UI, repository, and RideProvider state.
If a future cutover causes divergence, the app can keep the pipeline disabled
and continue using RideProvider exactly as before.

Phase 10D should connect selected actions behind explicit feature flags only
after the command pipeline, dual-read layer, and readiness gates stay green
under shadow traffic.

## Phase 10D Shadow Wiring

Selected ride actions are now shadow-wired into the pipeline from the live
action layer:

- request ride
- cancel ride
- submit rating

These shadow commands are created alongside the real RideProvider flow. They
do not enqueue, do not call repositories, and never block the real action if
the shadow path fails. Actions such as start ride, complete ride, payment, and
package-related behavior remain unwired.

Rollback is immediate: disable `ENABLE_RIDE_COMMAND_PIPELINE` or keep the
pipeline in disabled mode and the app continues to use RideProvider only.

## Phase 10E Shadow Wiring

Driver accept and decline actions are now shadow-wired as well:

- accept ride
- decline ride

The live driver action still runs first. The shadow command path remains
diagnostic-only, never enqueues, never calls repositories, and fails closed
without interrupting the live flow.

Still unwired:

- start ride
- complete ride
- payment actions
- package credit deduction
- negotiation finalization
