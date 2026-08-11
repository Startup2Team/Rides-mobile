import type { QueryFunction, QueryKey, UseQueryOptions } from '@tanstack/react-query';

export type AppQueryKey = QueryKey;

export interface QueryPolicy {
  staleTime: number;
  gcTime: number;
  // 'always' bypasses staleTime on app-foreground — reserved for data whose
  // change the user is actively waiting on (an admin approval landing).
  refetchOnWindowFocus: boolean | 'always';
  refetchOnReconnect: boolean;
  refetchOnMount: boolean | 'always';
  retry: number;
  retryDelayMs: number;
  networkMode: 'online' | 'always' | 'offlineFirst';
}

export type QueryPolicyName =
  | 'profile'
  | 'savedLocations'
  | 'rideHistory'
  | 'activeRide'
  | 'driverProfile'
  | 'driverStats'
  | 'driverEarnings'
  | 'driverRatings'
  | 'customerRatings'
  | 'driverCredits'
  | 'driverDocuments'
  | 'driverVehicles'
  | 'driverVehicle'
  | 'packages'
  | 'packageCatalog'
  | 'packageCampaigns'
  | 'packageEntitlements'
  | 'packagePurchases'
  | 'packageOffers'
  | 'notifications'
  | 'paymentMethods'
  | 'searchAutocomplete'
  | 'reverseGeocode'
  | 'demandHeatmap'
  | 'landmarks'
  | 'adminUnits'
  | 'adminUnitSearch'
  | 'locationSuggestions'
  | 'recentLocations';

export type QueryPolicyMap = Record<QueryPolicyName, QueryPolicy>;

export interface AppQueryHookOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey>
  extends Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'> {}

export type AppQueryFunction<TQueryFnData, TQueryKey extends QueryKey> = QueryFunction<TQueryFnData, TQueryKey>;
