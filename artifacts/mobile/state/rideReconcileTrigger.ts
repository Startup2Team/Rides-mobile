// Lets an inbound push notification (services/usePushNotifications.ts) ask
// RideProvider to re-verify its currently-loaded ride against the backend,
// without a direct import between the two. usePushNotifications runs inside
// RootLayoutNav, itself a descendant of RideProvider, so a React context call
// would work too — but that would couple the push-handling hook to ride
// internals it has no other reason to know about, and risks an import cycle
// as the ride domain grows. Mirrors state/rideActivityStore.ts's decoupling
// pattern (a module-level store instead of context), just in the other
// direction: a command going IN to RideProvider instead of status coming out.
//
// Rationale: a WS `ride_cancelled` missed while the socket is down or
// reconnecting (backgrounded app, flaky network) leaves a stale ride on
// screen. The backend also sends a push for the same event — this lets that
// push self-heal the stale state by triggering the same reconcile-against-
// GET-/rides/active path RideProvider already runs on foreground resume and
// on its backstop interval, instead of doing nothing but refresh a badge.

let reconcileHandler: (() => void) | null = null;

/** Called once by RideProvider on mount/unmount; not for use elsewhere. */
export function registerRideReconcileHandler(handler: (() => void) | null) {
  reconcileHandler = handler;
}

/** Called by usePushNotifications when a push implies the ride may be gone. */
export function triggerRideReconcile() {
  reconcileHandler?.();
}
