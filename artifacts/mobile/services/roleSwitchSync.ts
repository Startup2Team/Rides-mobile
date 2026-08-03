import { AppState, type AppStateStatus } from 'react-native';
import { STORAGE_KEYS } from '@/constants/storage';
import { BackendError } from '@/data/remote/contracts/backendErrors';
import { reportOperationalFailure } from '@/observability/monitoring';
import { loadSecureStorage, removeSecureStorage, saveSecureStorage } from '@/persistence/secureStorage';
import { roleSyncTargetSchema } from '@/persistence/storageSchemas';
import { setDriverAvailability } from '@/services/driverAvailability';
import { switchUserMode, type AppUserMode } from '@/services/userMode';

// Background reconciliation engine for role switches. The UI commits a mode
// change locally and returns instantly; this module then guarantees the backend
// converges on the same state — role_state via PATCH /users/mode, and
// is_online = FALSE when the user leaves driver mode (otherwise the dispatcher
// keeps assigning rides to a driver whose socket is gone, and every one of them
// expires against their acceptance rate).
//
// The pending target survives app restarts (persisted), retries transient
// failures with backoff, and re-kicks on app foreground + network reconnect.
// A switch during an in-flight sync supersedes it (latest wins): each target
// carries a seq, and the loop re-reads `pending` after every await.

export interface RoleSyncTarget {
  mode: AppUserMode;
  // Push is_online = FALSE before the mode PATCH (ordering matters: the
  // availability endpoint requires the driver role_state we're about to leave).
  driverOffline: boolean;
  driverOfflineDone: boolean;
  seq: number;
}

export type RoleSyncEvent =
  | { type: 'synced'; mode: AppUserMode }
  // The backend REFUSED the switch (4xx that retrying can't fix). The local
  // mode is now a lie — AuthContext listens for this and rolls it back.
  | { type: 'failed'; mode: AppUserMode; error: unknown };

type RoleSyncListener = (event: RoleSyncEvent) => void;

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000, 60_000];

let pending: RoleSyncTarget | null = null;
let seqCounter = 0;
let running = false;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let removeAppStateListener: (() => void) | null = null;
let removeNetworkListener: (() => void) | null = null;
const listeners = new Set<RoleSyncListener>();

function emit(event: RoleSyncEvent) {
  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      reportOperationalFailure('auth.roleSwitch.listener', error);
    }
  });
}

export function subscribeRoleSync(listener: RoleSyncListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The API answers a refusal with { error: { code, message } } — e.g.
// POLICY_NOT_ACCEPTED, ACTIVE_RIDE, DRIVER_NOT_ACTIVE, NO_DRIVER_PROFILE.
// The transport parks that body on `cause`. Surfacing it is the difference
// between "we couldn't switch you" and a reason the driver can act on.
export interface RoleSyncRejection {
  code: string | null;
  message: string | null;
}

export function readRoleSyncRejection(error: unknown): RoleSyncRejection {
  const cause = error instanceof BackendError ? error.cause : null;
  const body = cause && typeof cause === 'object' ? (cause as Record<string, unknown>).error : null;
  if (!body || typeof body !== 'object') return { code: null, message: null };
  const record = body as Record<string, unknown>;
  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : null;
  const message =
    typeof record.message === 'string' && record.message.trim() ? record.message.trim() : null;
  return { code, message };
}

// Retrying cannot fix a request the backend actively refused. Anything else
// (offline, timeout, 5xx, rate limit, auth blip) is worth another attempt.
function isFatal(error: unknown) {
  return (
    error instanceof BackendError &&
    (error.code === 'forbidden' ||
      error.code === 'validation_failed' ||
      error.code === 'conflict' ||
      error.code === 'not_implemented')
  );
}

function persistPending() {
  const snapshot = pending;
  const write = snapshot
    ? saveSecureStorage(STORAGE_KEYS.roleSync, snapshot)
    : removeSecureStorage(STORAGE_KEYS.roleSync);
  void write.catch(error => reportOperationalFailure('auth.roleSwitch.persist', error));
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function kick() {
  if (!running && pending) void run();
}

async function run() {
  running = true;
  try {
    while (pending) {
      const snapshot = pending;
      try {
        if (snapshot.driverOffline && !snapshot.driverOfflineDone) {
          try {
            await setDriverAvailability(false);
          } catch (error) {
            // A refusal here usually means role_state already flipped on a
            // previous partial sync — the offline push no longer applies.
            // Transient errors bubble up into the shared retry path.
            if (!isFatal(error)) throw error;
            reportOperationalFailure('auth.roleSwitch.availability', error);
          }
          if (pending?.seq !== snapshot.seq) continue; // superseded mid-flight
          pending = { ...snapshot, driverOfflineDone: true };
          persistPending();
        }
        await switchUserMode(snapshot.mode);
        if (pending?.seq !== snapshot.seq) continue; // superseded — sync the newer target
        pending = null;
        retryCount = 0;
        persistPending();
        emit({ type: 'synced', mode: snapshot.mode });
      } catch (error) {
        if (pending?.seq !== snapshot.seq) continue;
        if (isFatal(error)) {
          pending = null;
          retryCount = 0;
          persistPending();
          reportOperationalFailure('auth.roleSwitch.rejected', error, { mode: snapshot.mode });
          emit({ type: 'failed', mode: snapshot.mode, error });
          continue;
        }
        const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
        retryCount += 1;
        clearRetryTimer();
        retryTimer = setTimeout(() => {
          retryTimer = null;
          kick();
        }, delay);
        return;
      }
    }
  } finally {
    running = false;
  }
}

export function queueRoleSync(input: { mode: AppUserMode; driverOffline: boolean }) {
  clearRetryTimer();
  retryCount = 0;
  pending = {
    mode: input.mode,
    driverOffline: input.driverOffline,
    driverOfflineDone: !input.driverOffline,
    seq: ++seqCounter,
  };
  persistPending();
  kick();
}

export function getPendingRoleSync(): RoleSyncTarget | null {
  return pending;
}

// Logout: the session the pending PATCH belongs to is gone.
export async function clearRoleSync() {
  clearRetryTimer();
  pending = null;
  retryCount = 0;
  await removeSecureStorage(STORAGE_KEYS.roleSync).catch(() => {});
}

// Hydrate a sync that a previous app run never finished, and register the
// wake-up triggers. Safe to call more than once. The listeners only ACCELERATE
// retries (foreground / reconnect) — the backoff timer alone still guarantees
// convergence — so their registration is best-effort by design.
export async function initRoleSync() {
  if (initialized) return;
  initialized = true;
  if (typeof AppState?.addEventListener === 'function') {
    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') kick();
    });
    removeAppStateListener = () => appStateSubscription.remove();
  }
  try {
    // Lazy: pulling in the netinfo-backed monitor eagerly would drag native
    // modules into every consumer of AuthContext (including test trees).
    const { offlineNetwork } = require('@/offline') as typeof import('@/offline');
    removeNetworkListener = offlineNetwork.subscribe(state => {
      if (state.isOnline) kick();
    });
  } catch (error) {
    reportOperationalFailure('auth.roleSwitch.networkListener', error);
  }
  const stored = await loadSecureStorage(STORAGE_KEYS.roleSync, roleSyncTargetSchema);
  if (stored.data && !pending) {
    pending = stored.data;
    seqCounter = Math.max(seqCounter, stored.data.seq);
    kick();
  }
}

export function __resetRoleSyncForTests() {
  clearRetryTimer();
  pending = null;
  seqCounter = 0;
  running = false;
  retryCount = 0;
  initialized = false;
  removeAppStateListener?.();
  removeAppStateListener = null;
  removeNetworkListener?.();
  removeNetworkListener = null;
  listeners.clear();
}
