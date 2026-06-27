import { paymentRepository } from '@/data/repositories';
import { paymentKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function usePaymentMethodsQuery() {
  return usePolicyQuery(queryPolicies.paymentMethods, {
    queryKey: paymentKeys.methods(),
    queryFn: async () => paymentRepository.listPaymentMethods(),
  });
}
