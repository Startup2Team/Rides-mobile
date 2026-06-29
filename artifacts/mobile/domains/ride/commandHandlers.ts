import type { RideLifecycleCommand } from './commands';

export const rideCommandFlow = [
  'ui',
  'command_creator',
  'offline_mutation_engine',
  'repository',
  'backend',
  'realtime_event',
  'domain_event_platform',
  'projector',
  'tanstack_query_cache',
  'ui',
] as const;

export type RideCommandFlowStep = typeof rideCommandFlow[number];

export interface RideCommandHandlerBlueprint<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  commandType: string;
  accepts: TCommand;
  flow: readonly RideCommandFlowStep[];
  idempotent: true;
  runtimeEnabled: false;
}

export function createRideCommandHandlerBlueprint<TCommand extends RideLifecycleCommand>(
  commandType: string,
): Omit<RideCommandHandlerBlueprint<TCommand>, 'accepts'> {
  return {
    commandType,
    flow: rideCommandFlow,
    idempotent: true,
    runtimeEnabled: false,
  };
}
