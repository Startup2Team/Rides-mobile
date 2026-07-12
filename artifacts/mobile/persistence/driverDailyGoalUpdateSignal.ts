let driverDailyGoalUpdateVersion = 0;

export function getDriverDailyGoalUpdateVersion() {
  return driverDailyGoalUpdateVersion;
}

export function publishDriverDailyGoalUpdate() {
  driverDailyGoalUpdateVersion += 1;
  return driverDailyGoalUpdateVersion;
}
