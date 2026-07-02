import type {
  RideLifecycleCommand,
} from '../commands';
import { createRideCorrelationId } from '../idempotency';
import { isRideCommandAllowed } from './rideCommandPolicy';
import { createRideCommandRoute, toOfflineMutationPreview } from './rideCommandRouter';
import {
  ENABLE_RIDE_COMMAND_ENQUEUE,
  ENABLE_RIDE_COMMAND_PIPELINE,
  RIDE_COMMAND_PIPELINE_MODE,
  type RideCommandDiagnosticRecord,
  type RideCommandPipelineContext,
  type RideCommandPipelineDiagnostics,
  type RideCommandPipelineMode,
  type RideCommandPolicyResult,
  type RideCommandRoute,
  type RideCommandValidationIssue,
  type RideCommandValidationResult,
  type RideOfflineMutationPreview,
} from './rideCommandTypes';
import { ObservabilityRideCommandTelemetry, type RideCommandTelemetry, type RideCommandTelemetryRecord } from './rideCommandMetrics';

export interface RideCommandPipelineResult<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  mode: RideCommandPipelineMode;
  command: TCommand;
  route: RideCommandRoute | null;
  validation: RideCommandValidationResult;
  policy: RideCommandPolicyResult | null;
  preview: RideOfflineMutationPreview<TCommand> | null;
  accepted: boolean;
  reason: string;
}

function assertString(value: unknown, field: string, issues: RideCommandValidationIssue[]) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ field, message: `${field} is required` });
  }
}

function validateLocation(value: unknown, field: string, issues: RideCommandValidationIssue[]) {
  if (!value || typeof value !== 'object') {
    issues.push({ field, message: `${field} is required` });
    return;
  }
  const location = value as { address?: unknown; latitude?: unknown; longitude?: unknown };
  assertString(location.address, `${field}.address`, issues);
  if (typeof location.latitude !== 'number') {
    issues.push({ field: `${field}.latitude`, message: `${field}.latitude is required` });
  }
  if (typeof location.longitude !== 'number') {
    issues.push({ field: `${field}.longitude`, message: `${field}.longitude is required` });
  }
}

function validateCommandPayload(command: RideLifecycleCommand): RideCommandValidationResult {
  const issues: RideCommandValidationIssue[] = [];
  const payload = command.payload as unknown as Record<string, unknown>;

  assertString(command.commandId, 'commandId', issues);
  assertString(command.idempotencyKey, 'idempotencyKey', issues);
  assertString(command.correlationId, 'correlationId', issues);
  assertString(command.actorId, 'actorId', issues);
  assertString(command.actorRole, 'actorRole', issues);
  assertString(command.timestamp, 'timestamp', issues);
  assertString(payload.rideId, 'payload.rideId', issues);

  if ('pickup' in payload) validateLocation(payload.pickup, 'payload.pickup', issues);
  if ('destination' in payload) validateLocation(payload.destination, 'payload.destination', issues);

  if ('vehicleType' in payload && typeof payload.vehicleType !== 'string') {
    issues.push({ field: 'payload.vehicleType', message: 'payload.vehicleType is required' });
  }

  if ('reason' in payload && typeof payload.reason !== 'string') {
    issues.push({ field: 'payload.reason', message: 'payload.reason is required' });
  }

  if ('driverId' in payload) assertString(payload.driverId, 'payload.driverId', issues);
  if ('startedAt' in payload) assertString(payload.startedAt, 'payload.startedAt', issues);
  if ('completedAt' in payload) assertString(payload.completedAt, 'payload.completedAt', issues);
  const rating = payload.rating;
  if ('rating' in payload && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    issues.push({ field: 'payload.rating', message: 'payload.rating must be an integer from 1 to 5' });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return { valid: true, issues: [] };
}

function normalizeCommand<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  now: () => Date,
): TCommand {
  return {
    ...command,
    correlationId: command.correlationId || createRideCorrelationId(),
    timestamp: command.timestamp || now().toISOString(),
  };
}

function createTelemetryRecord<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  route: RideCommandRoute | null,
  validation: RideCommandValidationResult,
  policy: RideCommandPolicyResult | null,
  preview: RideOfflineMutationPreview<TCommand> | null,
  mode: RideCommandPipelineMode,
): RideCommandTelemetryRecord {
  return {
    commandId: command.commandId,
    commandType: route?.commandType ?? 'ride.command.unknown',
    mode,
    route: route ?? createRideCommandRoute(command),
    validation,
    policy: policy ?? { allowed: false, reason: 'disabled', requiredCapability: null },
    previewCreated: Boolean(preview),
    timestamp: new Date().toISOString(),
    correlationId: command.correlationId,
  };
}

export class RideCommandPipeline {
  private readonly telemetry: RideCommandTelemetry;
  private readonly now: () => Date;
  private mode: RideCommandPipelineMode;
  private records: RideCommandDiagnosticRecord[] = [];
  private processedCount = 0;
  private rejectedCount = 0;
  private lastRecord: RideCommandDiagnosticRecord | null = null;

  constructor(options: RideCommandPipelineContext & { telemetry?: RideCommandTelemetry } = {}) {
    this.mode = options.mode ?? RIDE_COMMAND_PIPELINE_MODE;
    this.now = options.now ?? (() => new Date());
    this.telemetry = options.telemetry ?? new ObservabilityRideCommandTelemetry();
  }

  setMode(mode: RideCommandPipelineMode) {
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  getDiagnostics(): RideCommandPipelineDiagnostics {
    return {
      mode: this.mode,
      enabled: ENABLE_RIDE_COMMAND_PIPELINE,
      enqueueEnabled: ENABLE_RIDE_COMMAND_ENQUEUE,
      processedCount: this.processedCount,
      rejectedCount: this.rejectedCount,
      lastRecord: this.lastRecord,
      records: [...this.records],
      currentSelection: this.mode,
    };
  }

  reset() {
    this.mode = RIDE_COMMAND_PIPELINE_MODE;
    this.records = [];
    this.processedCount = 0;
    this.rejectedCount = 0;
    this.lastRecord = null;
  }

  process<TCommand extends RideLifecycleCommand>(
    command: TCommand,
    context: RideCommandPipelineContext = {},
  ): RideCommandPipelineResult<TCommand> {
    const mode = context.mode ?? this.mode;
    if (!ENABLE_RIDE_COMMAND_PIPELINE || mode === 'disabled') {
      return {
        mode: 'disabled',
        command,
        route: null,
        validation: { valid: false, issues: [] },
        policy: null,
        preview: null,
        accepted: false,
        reason: 'disabled',
      };
    }

    const normalized = normalizeCommand(command, context.now ?? this.now);
    const route = createRideCommandRoute(normalized);
    const validation = validateCommandPayload(normalized);
    const policy = validation.valid
      ? isRideCommandAllowed(route.routeName, normalized, { capabilitySnapshot: context.capabilitySnapshot ?? null })
      : { allowed: false, reason: 'validation-failed', requiredCapability: route.requiresActorCapability };
    const preview = validation.valid && policy.allowed && mode === 'enqueueReady'
      ? toOfflineMutationPreview(normalized, route, context.now ?? this.now)
      : null;
    const accepted = validation.valid && policy.allowed;
    const reason = !validation.valid
      ? 'invalid'
      : !policy.allowed
        ? 'policy-denied'
        : mode === 'enqueueReady'
          ? 'enqueue-preview'
          : mode === 'shadow'
            ? 'shadow-recorded'
            : 'dry-run';

    const telemetryRecord = createTelemetryRecord(normalized, route, validation, policy, preview, mode);
    this.telemetry.record(telemetryRecord);

    const diagnosticRecord: RideCommandDiagnosticRecord = {
      commandId: normalized.commandId,
      commandType: route.commandType,
      mode,
      route,
      validation,
      policy,
      preview,
      timestamp: telemetryRecord.timestamp,
      correlationId: normalized.correlationId,
    };

    this.processedCount += validation.valid && policy.allowed ? 1 : 0;
    this.rejectedCount += validation.valid && policy.allowed ? 0 : 1;
    this.lastRecord = diagnosticRecord;

    if (mode === 'shadow') {
      this.records = [...this.records, diagnosticRecord];
    }

    if (!validation.valid || !policy.allowed) {
      return {
        mode,
        command: normalized,
        route,
        validation,
        policy,
        preview: null,
        accepted: false,
        reason,
      };
    }

    if (mode === 'dryRun' || mode === 'shadow') {
      return {
        mode,
        command: normalized,
        route,
        validation,
        policy,
        preview: null,
        accepted: true,
        reason,
      };
    }

    return {
      mode,
      command: normalized,
      route,
      validation,
      policy,
      preview,
      accepted: true,
      reason,
    };
  }
}

export const rideCommandPipeline = new RideCommandPipeline();

export function processRideCommand<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  context: RideCommandPipelineContext = {},
) {
  return rideCommandPipeline.process(command, context);
}

export function isRideCommandPipelineEnabled() {
  return ENABLE_RIDE_COMMAND_PIPELINE;
}
