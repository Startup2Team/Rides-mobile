import type { PendingMutationPriority, RetryPolicy } from '@/offline';
import type { RideLifecycleCommand, StartRideCommand, CompleteRideCommand } from '../commands';
import type { RideTransactionCommandType, RideTransactionFinancialPreview, RideTransactionPreview, RideTransactionRollbackPlan, RideTransactionRollbackContext, RideTransactionState } from './transactionTypes';

export const RIDE_TRANSACTION_COMMAND_TYPES: readonly RideTransactionCommandType[] = ['ride.start', 'ride.complete'];

export function isRideStartTransactionCommand(command: RideLifecycleCommand): command is StartRideCommand {
  return 'startedAt' in command.payload;
}

export function isRideCompleteTransactionCommand(command: RideLifecycleCommand): command is CompleteRideCommand {
  return 'completedAt' in command.payload;
}

export function getRideTransactionCommandType(command: RideLifecycleCommand): RideTransactionCommandType | null {
  if (isRideStartTransactionCommand(command)) return 'ride.start';
  if (isRideCompleteTransactionCommand(command)) return 'ride.complete';
  return null;
}

export function getRideTransactionPriority(commandType: RideTransactionCommandType): PendingMutationPriority {
  return commandType === 'ride.start' ? 'critical' : 'critical';
}

export function getRideTransactionRetryPolicy(): RetryPolicy {
  return {
    baseDelayMs: 5_000,
    maxDelayMs: 60_000,
    maxRetryCount: 3,
    jitterRatio: 0.1,
  };
}

export function getRideTransactionExpiryMs() {
  return 15 * 60 * 1000;
}

export function getRideTransactionStateForCommand(commandType: RideTransactionCommandType): Extract<RideTransactionState, 'Pending' | 'Accepted'> {
  return commandType === 'ride.start' || commandType === 'ride.complete' ? 'Pending' : 'Pending';
}

export function getRideTransactionAllowedStatuses(commandType: RideTransactionCommandType) {
  return commandType === 'ride.start'
    ? ['driver_arrived'] as const
    : ['started'] as const;
}

export function getRideTransactionAllowedPhases(commandType: RideTransactionCommandType) {
  return commandType === 'ride.start'
    ? ['accepted'] as const
    : ['active'] as const;
}

export function getRideTransactionNextStatus(commandType: RideTransactionCommandType) {
  return commandType === 'ride.start' ? 'started' : 'completed';
}

export function getRideTransactionNextPhase(commandType: RideTransactionCommandType) {
  return commandType === 'ride.start' ? 'active' : 'closed';
}

export function createRideTransactionFinancialPreview(
  commandType: RideTransactionCommandType,
): RideTransactionFinancialPreview | null {
  if (commandType !== 'ride.complete') return null;
  return {
    mode: 'preview',
    effects: [
      { name: 'fare-settlement', mode: 'preview', description: 'Fare settlement would be prepared.' },
      { name: 'payment-authorization', mode: 'preview', description: 'Payment authorization would be evaluated.' },
      { name: 'package-credit-deduction', mode: 'preview', description: 'Package credit deduction would be evaluated.' },
      { name: 'driver-earnings', mode: 'preview', description: 'Driver earnings would be calculated.' },
      { name: 'customer-receipt', mode: 'preview', description: 'Customer receipt would be prepared.' },
      { name: 'promotions', mode: 'preview', description: 'Promotions would be evaluated.' },
      { name: 'loyalty-rewards', mode: 'preview', description: 'Loyalty rewards would be evaluated.' },
      { name: 'referral-rewards', mode: 'preview', description: 'Referral rewards would be evaluated.' },
      { name: 'analytics', mode: 'preview', description: 'Analytics events would be emitted.' },
      { name: 'notifications', mode: 'preview', description: 'Notifications would be prepared.' },
    ],
    notes: [
      'Preview only. No repository writes are performed.',
      'Preview only. No payment or earnings execution is performed.',
    ],
  };
}

export function createRideTransactionRollbackPlan(
  transactionId: string,
  rideId: string,
  commandType: RideTransactionCommandType,
  hooks: readonly { name: string }[] = [],
): RideTransactionRollbackPlan {
  return {
    transactionId,
    rideId,
    commandType,
    hooks: hooks.map(hook => hook.name),
  };
}

export function createRideTransactionPreview<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  transactionId: string,
  options: {
    now: Date;
    hooks?: readonly { name: string }[];
  } = { now: new Date() },
): RideTransactionPreview<TCommand> {
  const commandType = getRideTransactionCommandType(command);
  if (!commandType) {
    throw new Error('Unsupported ride transaction command.');
  }
  const payload = command.payload as { rideId: string };
  return {
    transactionId,
    rideId: payload.rideId,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    actorId: command.actorId,
    actorRole: command.actorRole,
    commandType,
    state: 'Pending',
    statusBefore: null,
    phaseBefore: null,
    statusAfter: getRideTransactionNextStatus(commandType),
    phaseAfter: getRideTransactionNextPhase(commandType),
    priority: getRideTransactionPriority(commandType),
    retryPolicy: getRideTransactionRetryPolicy(),
    createdAt: options.now.toISOString(),
    expiresAt: new Date(options.now.getTime() + getRideTransactionExpiryMs()).toISOString(),
    payload: command.payload,
    rollbackPlan: createRideTransactionRollbackPlan(transactionId, payload.rideId, commandType, options.hooks ?? []),
    financialPreview: createRideTransactionFinancialPreview(commandType),
  };
}

export function isRideTransactionRollbackContext(value: RideTransactionRollbackContext | null | undefined) {
  return Boolean(value && value.transactionId && value.rideId && value.commandId);
}
