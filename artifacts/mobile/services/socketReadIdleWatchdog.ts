// Detects a WebSocket that has gone silent without the platform ever firing
// `onclose` — the confirmed root cause of ride sync freezing on a
// poor/stalled connection (see customerTrackingSocket.ts /
// driverTrackingSocket.ts, which both use this). React Native's WebSocket
// (OkHttp on Android, NSURLSession on iOS) replies to the server's WS-level
// ping/pong at the native layer without ever surfacing it to JS, and on a
// silently-dead connection (NAT/carrier timeout, black-holed packets) the
// native transport itself can take a very long time — far longer than a
// rider will wait — to notice and fire `onclose`. This is a small, testable
// timer: reset it on every inbound frame, and if it ever fires, the caller
// treats the socket as dead and forces a close, which the EXISTING
// exponential-backoff reconnect in each tracking socket then picks up —
// landing a fresh connection and (for the customer socket) a `ride_state`
// replay that resyncs anything missed while the old socket sat dead.
//
// Not socket-specific on purpose: both trackers share one tested
// implementation instead of two hand-rolled timers.

export interface ReadIdleWatchdog {
  /** Call on every inbound frame (including the initial `onopen`) to push the deadline out. */
  reset: () => void;
  /** Stop the watchdog — no further `onIdle` calls until the next `reset()`. */
  clear: () => void;
}

export function createReadIdleWatchdog(onIdle: () => void, timeoutMs: number): ReadIdleWatchdog {
  let handle: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (handle) clearTimeout(handle);
    handle = null;
  };

  const reset = () => {
    clear();
    handle = setTimeout(() => {
      handle = null;
      onIdle();
    }, timeoutMs);
  };

  return { reset, clear };
}
