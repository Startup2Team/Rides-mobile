import type { QueryClient } from '@tanstack/react-query';

export const packagePaymentKeys = {
  all: ['package-payments'] as const,
  configuration: () => [...packagePaymentKeys.all, 'configuration'] as const,
};

export const packagePaymentConfigurationQueryPolicy = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: false,
} as const;

export function invalidatePackagePaymentConfiguration(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: packagePaymentKeys.configuration() });
}
