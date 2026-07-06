import type { NavigationRouter } from '@/navigation/navigationPolicy';

export const DRIVER_PACKAGES_ROUTE = '/(driver)/packages' as const;

export function navigateToDriverPackages(router: Pick<NavigationRouter, 'push'>) {
  router.push(DRIVER_PACKAGES_ROUTE);
}
