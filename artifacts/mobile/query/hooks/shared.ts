import { useQuery, type QueryFunctionContext, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { observeQueryError, observeQueryStart, observeQuerySuccess } from '@/observability/performance/instrumentation';
import type { QueryPolicy } from '../types';

export function withPolicy<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  policy: QueryPolicy,
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  const originalQueryFn = options.queryFn;
  return {
    ...options,
    queryFn: typeof originalQueryFn === 'function'
      ? async (context: QueryFunctionContext<TQueryKey>) => {
          observeQueryStart(options.queryKey);
          try {
            const result = await originalQueryFn(context);
            observeQuerySuccess(options.queryKey);
            return result;
          } catch (error) {
            observeQueryError(options.queryKey, error);
            throw error;
          }
        }
      : originalQueryFn,
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
