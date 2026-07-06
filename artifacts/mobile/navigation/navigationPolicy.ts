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

export function closeTemporaryScreen(router: NavigationRouter, fallbackRoute: NavigationTarget) {
  observeNavigation('closeTemporaryScreen', fallbackRoute);
  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
