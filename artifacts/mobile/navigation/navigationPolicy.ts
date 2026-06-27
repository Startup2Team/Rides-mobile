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
  router.push(target);
}

export function replaceFlowScreen(router: NavigationRouter, target: NavigationTarget) {
  router.replace(target);
}

export function replaceAuthBoundary(router: NavigationRouter, target: NavigationTarget) {
  router.replace(target);
}

export function navigateToCustomerHomeAfterCompletion(router: NavigationRouter) {
  router.replace('/(tabs)');
}

export function navigateToDriverHomeAfterCompletion(router: NavigationRouter) {
  router.replace('/(driver)');
}

export function closeTemporaryScreen(router: NavigationRouter, fallbackRoute: NavigationTarget) {
  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
