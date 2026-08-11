import { AppState, type AppStateStatus } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { instrumentQueryClient } from '@/observability/performance/instrumentation';

// Teach React Query when the app is actually in front of the user. On the web
// this happens automatically via window focus events; React Native has no
// window, so without this wiring "refetchOnWindowFocus" never fires and every
// screen keeps showing whatever it fetched last — which is why an admin
// approval (payment claim, document review) only appeared after navigating
// away and back. With it, returning to the app refetches stale queries.
if (typeof AppState?.addEventListener === 'function') {
  AppState.addEventListener('change', (state: AppStateStatus) => {
    focusManager.setFocused(state === 'active');
  });
}

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
        // Stale data refreshes when the app comes back to the foreground.
        // staleTime still gates it: a query fetched moments ago won't refire.
        refetchOnWindowFocus: true,
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
