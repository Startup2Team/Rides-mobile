import { listDriverDocuments, type DriverDocument } from '@/services/driverDocuments';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

const EMPTY: DriverDocument[] = [];

/**
 * The driver's KYC documents as the BACKEND holds them (GET /v1/driver/documents).
 *
 * This exists because `listDriverDocuments` was dead code — the only reference to
 * it was its own definition. Documents were uploaded once during the application
 * flow (`services/driverApplication.ts`) and then never read back, while every
 * screen showed `vehicle.documents` sourced purely from AsyncStorage. The
 * consequence: a driver on a new handset, or after a reinstall, saw no documents
 * at all even when the server held them — and nobody could tell that apart from
 * genuinely having uploaded none.
 *
 * Returns the LIVE version of each document; superseded versions stay server-side
 * for audit and are not surfaced here.
 */
export function useDriverDocumentsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverDocument[]>(queryPolicies.driverDocuments, {
    queryKey: driverKeys.documents(),
    queryFn: async () => await listDriverDocuments(),
    enabled: options?.enabled ?? true,
    // Deliberately NOT placeholderData: an empty array must mean "the server has
    // none", not "still loading". Conflating the two is what made this invisible.
    // Callers should branch on isPending before treating [] as authoritative.
    initialData: undefined,
    select: (docs) => docs ?? EMPTY,
  });
}
