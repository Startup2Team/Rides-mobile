import { observeNavigation } from '@/observability/performance/instrumentation';

export type NavigationTarget =
  | string
  | { pathname: string; params?: Record<string, string | undefined> };

export interface NavigationRouter {
  push: (...args: any[]) => void;
  replace: (...args: any[]) => void;
  back: (...args: any[]) => void;
  canGoBack?: (...args: any[]) => boolean;
}

export function pushFlowScreen(router: NavigationRouter, target: NavigationTarget) {
  observeNavigation('pushFlowScreen', target);
  router.push(target);
}

export function replaceFlowScreen(router: NavigationRouter, target: NavigationTarget) {
  observeNavigation('replaceFlowScreen', target);
  router.replace(target);
}

export function replaceAuthBoundary(router: NavigationRouter, target: NavigationTarget) {
  observeNavigation('replaceAuthBoundary', target);
  router.replace(target);
}

export function navigateToCustomerHomeAfterCompletion(router: NavigationRouter) {
  observeNavigation('navigateToCustomerHomeAfterCompletion', '/(tabs)');
  router.replace('/(tabs)');
}

export function navigateToDriverHomeAfterCompletion(router: NavigationRouter) {
  observeNavigation('navigateToDriverHomeAfterCompletion', '/(driver)');
  router.replace('/(driver)');
}

// Land on the home screen that matches a mode. Used when a role switch is
// rolled back: the refused mode's screen is still mounted, so reverting state
// alone leaves driver UI running on customer state (or vice versa).
export function navigateToModeHome(mode: 'customer' | 'driver') {
  const target = mode === 'driver' ? '/(driver)' : '/(tabs)';
  observeNavigation('navigateToModeHome', target);
  // Imported lazily: this module is consumed by AuthContext, which loads before
  // the router in some entry paths.
  const { router } = require('expo-router') as typeof import('expo-router');
  router.replace(target);
}

export function closeTemporaryScreen(router: NavigationRouter, fallbackRoute: NavigationTarget) {
  observeNavigation('closeTemporaryScreen', fallbackRoute);
  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
