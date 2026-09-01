import type { QueryPolicy, QueryPolicyMap } from './types';

const minute = 60 * 1000;

function policy(overrides: Partial<QueryPolicy>): QueryPolicy {
  return {
    staleTime: 5 * minute,
    gcTime: 30 * minute,
    // The app-foreground moment is when a user checks whether something changed
    // (an approval, a payment, a new offer). Stale queries refetch then;
    // staleTime still protects anything fetched moments ago.
    refetchOnWindowFocus: true,
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
    // Waiting-on-an-admin data: refresh on every return to the app, fresh or not.
    refetchOnWindowFocus: 'always',
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
  customerRatings: policy({
    staleTime: 2 * minute,
    gcTime: 30 * minute,
  }),
  driverCredits: policy({
    // Ride credits change when a package is activated or an admin approves a
    // manual payment claim (granting rides). Refetch on focus/mount so a grant
    // that happened while the app was backgrounded shows up promptly.
    staleTime: 30 * 1000,
    gcTime: 20 * minute,
    refetchOnMount: 'always',
  }),
  // KYC documents change rarely and the screen is entered deliberately, so a
  // longer stale window is fine; refetchOnMount still picks up a review result.
  driverDocuments: policy({
    // Waiting-on-an-admin data: refresh on every return to the app, fresh or not.
    refetchOnWindowFocus: 'always',
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
    staleTime: 0,
    gcTime: 30 * minute,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  }),
  packageCatalog: policy({
    staleTime: 0,
    gcTime: 30 * minute,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  }),
  packageCampaigns: policy({
    staleTime: 0,
    gcTime: 30 * minute,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  }),
  packageEntitlements: policy({
    refetchOnWindowFocus: 'always',
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 20 * minute,
  }),
  packagePurchases: policy({
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    gcTime: 20 * minute,
  }),
  packageOffers: policy({
    staleTime: 0,
    gcTime: 10 * minute,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  }),
  notifications: policy({
    // Waiting-on-an-admin data: refresh on every return to the app, fresh or not.
    refetchOnWindowFocus: 'always',
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
  landmarks: policy({
    // Curated Rwanda landmarks: a seeded list that only moves on a backend
    // deploy. Cache it for the day so the destination sheet opens with free
    // results instead of waiting on a paid geocoder, and keep it in gc for a
    // week so a returning rider still has it offline.
    staleTime: 24 * 60 * minute,
    gcTime: 7 * 24 * 60 * minute,
    refetchOnMount: false,
  }),
  adminUnits: policy({
    // Province/district/sector hierarchy — reference data that changes when the
    // country redistricts. Same treatment as landmarks.
    staleTime: 24 * 60 * minute,
    gcTime: 7 * 24 * 60 * minute,
    refetchOnMount: false,
  }),
  adminUnitSearch: policy({
    // Autocomplete over that same static tree, so a result stays correct for as
    // long as the rider is typing. One retry: a miss just hides the area chips.
    staleTime: 30 * minute,
    gcTime: 60 * minute,
    refetchOnMount: false,
    retry: 1,
  }),
  locationSuggestions: policy({
    // Personalised, and the server already caches it for 10 minutes while
    // busting on every new recent. Mirror that window, but revalidate on mount
    // so a destination picked on another device shows up when the sheet opens.
    staleTime: 5 * minute,
    gcTime: 30 * minute,
    refetchOnMount: 'always',
    retry: 1,
  }),
  recentLocations: policy({
    // Changes the moment the rider picks a destination — never serve it stale.
    staleTime: 0,
    gcTime: 15 * minute,
    refetchOnMount: 'always',
    retry: 1,
  }),
} satisfies QueryPolicyMap;

export function getQueryPolicy(name: keyof typeof queryPolicies) {
  return queryPolicies[name];
}
