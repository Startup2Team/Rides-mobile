export function createRideIdempotencyKey(action: string, rideId: string, actorId: string) {
  if (!action) throw new Error('Ride idempotency action is required');
  if (!rideId) throw new Error('Ride idempotency rideId is required');
  if (!actorId) throw new Error('Ride idempotency actorId is required');
  return `ride:${rideId}:${action}:${actorId}`;
}

export function createRideCommandId(prefix = 'ride_command') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRideEventId(prefix = 'ride_event') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRideCorrelationId(prefix = 'ride_correlation') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
