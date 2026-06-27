import { notificationRepository } from '@/data/repositories';
import { notificationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useNotificationsQuery() {
  return usePolicyQuery(queryPolicies.notifications, {
    queryKey: notificationKeys.list(),
    queryFn: async () => notificationRepository.getReadState(),
  });
}
