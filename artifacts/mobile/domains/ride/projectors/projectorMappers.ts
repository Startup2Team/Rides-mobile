import type { RideLifecycleEvent } from '../events';
import type { RideLocationSnapshot, RideParticipant } from '../readModels';

export const unknownRideParticipant: RideParticipant = {
  userId: 'unknown',
  role: 'system',
};

export const unknownRideLocation: RideLocationSnapshot = {
  address: 'unknown',
  latitude: 0,
  longitude: 0,
};

export function eventTimestamp(event: RideLifecycleEvent) {
  return new Date(event.timestamp).toISOString();
}

export function getPayloadLocation(value: RideLocationSnapshot | null | undefined) {
  return value ?? null;
}
