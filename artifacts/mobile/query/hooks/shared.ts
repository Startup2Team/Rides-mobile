import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import type { QueryPolicy } from '../types';

export function withPolicy<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  policy: QueryPolicy,
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  return {
    ...options,
    gcTime: policy.gcTime,
    staleTime: policy.staleTime,
    refetchOnWindowFocus: policy.refetchOnWindowFocus,
    refetchOnReconnect: policy.refetchOnReconnect,
    refetchOnMount: policy.refetchOnMount,
    retry: policy.retry,
    retryDelay: policy.retryDelayMs,
    networkMode: policy.networkMode,
  } as const;
}

export function usePolicyQuery<TQueryFnData, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  policy: QueryPolicy,
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  return useQuery(withPolicy(policy, options));
}
