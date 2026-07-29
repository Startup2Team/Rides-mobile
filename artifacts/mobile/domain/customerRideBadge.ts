export type CustomerRideBadgeTier =
  | "BRONZE"
  | "PINK"
  | "GREEN"
  | "GOLD";

export interface CustomerRideBadge {
  tier: CustomerRideBadgeTier;
  label: string;
}

// A customer earns a badge from completed rides only.
export function getCustomerRideBadge(
  completedRides: number,
): CustomerRideBadge | null {
  const rides = Math.max(0, Math.floor(completedRides));

  if (rides >= 80) return { tier: "GOLD", label: "Gold" };
  if (rides >= 50) return { tier: "GREEN", label: "Green" };
  if (rides >= 25) return { tier: "PINK", label: "Pink" };
  if (rides >= 10) return { tier: "BRONZE", label: "Bronze" };
  return null;
}
