import { QueryClient } from '@tanstack/react-query';
import { instrumentQueryClient } from '@/observability/performance/instrumentation';

const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

export function createAppQueryClient() {
  return instrumentQueryClient(new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: attemptIndex =>
          Math.min(DEFAULT_RETRY_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS),
        networkMode: 'online',
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
        staleTime: 0,
        gcTime: 1000 * 60 * 30,
      },
      mutations: {
        retry: 1,
        retryDelay: attemptIndex =>
          Math.min(DEFAULT_RETRY_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS),
        networkMode: 'online',
      },
    },
  }));
}

export const queryClient = createAppQueryClient();
