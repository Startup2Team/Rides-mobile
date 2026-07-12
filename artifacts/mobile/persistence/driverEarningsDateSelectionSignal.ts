let driverEarningsDateSelectionVersion = 0;
let pendingLocalDate: string | null = null;

export function getDriverEarningsDateSelectionVersion() {
  return driverEarningsDateSelectionVersion;
}

export function publishDriverEarningsDateSelection(localDate: string) {
  driverEarningsDateSelectionVersion += 1;
  pendingLocalDate = localDate;
  return driverEarningsDateSelectionVersion;
}

/**
 * Consumes a one-time calendar date selection.
 * Advances the caller's seen version so stale selections are not replayed.
 */
export function consumeDriverEarningsDateSelection(lastSeenVersion: number): {
  version: number;
  localDate: string | null;
} {
  if (driverEarningsDateSelectionVersion === lastSeenVersion) {
    return { version: lastSeenVersion, localDate: null };
  }

  const localDate = pendingLocalDate;
  pendingLocalDate = null;
  return {
    version: driverEarningsDateSelectionVersion,
    localDate,
  };
}
