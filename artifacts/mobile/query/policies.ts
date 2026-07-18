import type { QueryPolicy, QueryPolicyMap } from './types';

const minute = 60 * 1000;

function policy(overrides: Partial<QueryPolicy>): QueryPolicy {
  return {
    staleTime: 5 * minute,
    gcTime: 30 * minute,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelayMs: 1_000,
    networkMode: 'online',
    ...overrides,
  };
}

export const queryPolicies = {
  profile: policy({
    staleTime: 5 * minute,
    gcTime: 30 * minute,
  }),
  savedLocations: policy({
    staleTime: 10 * minute,
    gcTime: 45 * minute,
  }),
  rideHistory: policy({
    staleTime: 5 * minute,
    gcTime: 30 * minute,
  }),
  activeRide: policy({
    staleTime: 0,
    gcTime: 5 * minute,
    refetchOnMount: 'always',
  }),
  driverProfile: policy({
    staleTime: 5 * minute,
    gcTime: 30 * minute,
  }),
  driverStats: policy({
    // All-time counters shift slowly; refetch on focus keeps them current
    // after a completed ride without hammering the endpoint.
    staleTime: 2 * minute,
    gcTime: 20 * minute,
    refetchOnMount: 'always',
  }),
  driverEarnings: policy({
    // Earnings change the moment a trip completes — keep them fresh.
    staleTime: 60 * 1000,
    gcTime: 20 * minute,
    refetchOnMount: 'always',
  }),
  driverRatings: policy({
    staleTime: 2 * minute,
    gcTime: 30 * minute,
  }),
  driverVehicles: policy({
    staleTime: 5 * minute,
    gcTime: 30 * minute,
  }),
  driverVehicle: policy({
    staleTime: 5 * minute,
    gcTime: 30 * minute,
  }),
  packages: policy({
    staleTime: 10 * minute,
    gcTime: 45 * minute,
  }),
  packageCatalog: policy({
    staleTime: 10 * minute,
    gcTime: 45 * minute,
  }),
  packageCampaigns: policy({
    staleTime: 10 * minute,
    gcTime: 45 * minute,
  }),
  packageEntitlements: policy({
    staleTime: 2 * minute,
    gcTime: 20 * minute,
  }),
  packagePurchases: policy({
    staleTime: 2 * minute,
    gcTime: 20 * minute,
  }),
  packageOffers: policy({
    staleTime: 1 * minute,
    gcTime: 10 * minute,
  }),
  notifications: policy({
    staleTime: 60 * 1000,
    gcTime: 15 * minute,
  }),
  paymentMethods: policy({
    staleTime: 60 * minute,
    gcTime: 120 * minute,
  }),
  searchAutocomplete: policy({
    staleTime: 0,
    gcTime: 5 * minute,
    retry: 1,
  }),
  reverseGeocode: policy({
    staleTime: 0,
    gcTime: 10 * minute,
    retry: 1,
  }),
  demandHeatmap: policy({
    // Demand shifts continuously; keep it fresh but cheap to poll.
    staleTime: 60 * 1000,
    gcTime: 10 * minute,
    retry: 1,
  }),
} satisfies QueryPolicyMap;

export function getQueryPolicy(name: keyof typeof queryPolicies) {
  return queryPolicies[name];
}
