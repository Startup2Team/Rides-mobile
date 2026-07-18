import type { QueryFunction, QueryKey, UseQueryOptions } from '@tanstack/react-query';

export type AppQueryKey = QueryKey;

export interface QueryPolicy {
  staleTime: number;
  gcTime: number;
  refetchOnWindowFocus: boolean;
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
  | 'demandHeatmap';

export type QueryPolicyMap = Record<QueryPolicyName, QueryPolicy>;

export interface AppQueryHookOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey>
  extends Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'> {}

export type AppQueryFunction<TQueryFnData, TQueryKey extends QueryKey> = QueryFunction<TQueryFnData, TQueryKey>;
