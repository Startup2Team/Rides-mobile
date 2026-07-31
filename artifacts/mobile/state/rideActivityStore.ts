// Tracks whether a ride is in flight, outside React, so the role-switch
// controller in AuthContext can refuse a mid-ride switch without a dependency
// on RideContext (RideProvider mounts inside AuthProvider, so AuthContext can
// never consume it directly). RideProvider reports into this store; switching
// roles while a ride is active is what made the customer and driver flow
// navigators fight over the router.

const TERMINAL_RIDE_STATUSES = new Set(['completed', 'cancelled']);

let activeRideStatus: string | null = null;
let hasPendingDriverRequest = false;

export function setRideActivity(status: string | null, pendingDriverRequest: boolean) {
  activeRideStatus = status;
  hasPendingDriverRequest = pendingDriverRequest;
}

export function isRideSwitchBlocking() {
  if (hasPendingDriverRequest) return true;
  return activeRideStatus !== null && !TERMINAL_RIDE_STATUSES.has(activeRideStatus);
}

export function resetRideActivity() {
  activeRideStatus = null;
  hasPendingDriverRequest = false;
}
