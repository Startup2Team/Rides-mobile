export type RealtimePresenceState =
  | 'Offline'
  | 'Connecting'
  | 'Connected'
  | 'Authenticated'
  | 'Reconnecting'
  | 'Disconnected'
  | 'Degraded';

export interface PresenceSnapshot {
  state: RealtimePresenceState;
  previousState: RealtimePresenceState;
  updatedAt: string;
}

export function createPresenceSnapshot(
  state: RealtimePresenceState,
  previousState: RealtimePresenceState = 'Offline',
  updatedAt = new Date().toISOString(),
): PresenceSnapshot {
  return { state, previousState, updatedAt };
}
