import { getCustomerRideBadge } from "../customerRideBadge";

describe("getCustomerRideBadge", () => {
  test.each([
    [0, null],
    [9, null],
    [10, "BRONZE"],
    [24, "BRONZE"],
    [25, "PINK"],
    [49, "PINK"],
    [50, "GREEN"],
    [79, "GREEN"],
    [80, "GOLD"],
    [200, "GOLD"],
  ] as const)("maps %i completed rides to %s", (rides, expected) => {
    expect(getCustomerRideBadge(rides)?.tier ?? null).toBe(expected);
  });
});
