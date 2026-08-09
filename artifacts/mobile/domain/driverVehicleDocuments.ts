import { mergeServerDriverDocuments } from '@/domain/driverDocuments';
import type { DriverDocument } from '@/services/driverDocuments';
import type {
  DriverVehicleDocumentRecord,
  DriverVehicleDocumentSet,
  DriverVehicleProfile,
} from '@/types';

/**
 * An all-empty document set: every card present, every face blank.
 *
 * The vehicle details screen writes a newly picked photo into an existing
 * record, so a *missing* set is not the same as an empty one — a null set
 * silently swallowed every photo the driver took, with no error and nothing
 * appearing in the preview.
 */
export function emptyVehicleDocumentSet(at = new Date().toISOString()): DriverVehicleDocumentSet {
  const record = (key: DriverVehicleDocumentRecord['key']): DriverVehicleDocumentRecord => ({
    key,
    faces: [null, null],
    reviewStatus: 'pending_review',
    submissionKind: 'initial',
    submittedAt: at,
    updatedAt: at,
  });
  return {
    license: record('license'),
    nationalId: record('nationalId'),
    insurance: record('insurance'),
    authorization: record('authorization'),
  };
}

/**
 * What a vehicle's document cards show before the driver edits anything.
 *
 * A vehicle's locally held documents are only ever what THIS handset uploaded.
 * On a second phone, or after a reinstall, there are none — which is why every
 * card read "Missing" while the Verification documents list on the same screen
 * showed those exact papers APPROVED. Layering the server's documents on top is
 * what reconciles the two views.
 *
 * A pending document update wins over the stored set: it is the driver's most
 * recent submission and is what review is currently looking at.
 */
export function resolveVehicleDocuments(
  vehicle: Pick<DriverVehicleProfile, 'documents' | 'pendingDocumentUpdate'> | null | undefined,
  serverDocuments: readonly DriverDocument[] = [],
  emptyAt?: string,
): DriverVehicleDocumentSet {
  const local =
    vehicle?.pendingDocumentUpdate?.documents ?? vehicle?.documents ?? emptyVehicleDocumentSet(emptyAt);
  if (serverDocuments.length === 0) return local;
  return mergeServerDriverDocuments(local, serverDocuments) as DriverVehicleDocumentSet;
}
