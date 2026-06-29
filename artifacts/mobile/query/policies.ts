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
  notifications: policy({
    staleTime: 60 * 1000,
    gcTime: 15 * minute,
  }),
  paymentMethods: policy({
    staleTime: 10 * minute,
    gcTime: 30 * minute,
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
} satisfies QueryPolicyMap;

export function getQueryPolicy(name: keyof typeof queryPolicies) {
  return queryPolicies[name];
}
