import { acceptDriverPolicy, applyAsDriver, type DriverApplicationInput } from './driverProfile';
import { uploadDriverDocument, type DriverDocumentType } from './driverDocuments';
import { updateProfile } from './profile';
import { reportOperationalFailure } from '@/observability/monitoring';

// Orchestrates the real driver application: create the application
// (POST /driver/apply), then upload each KYC document (presign → PUT → record).

export interface DriverApplicationDocument {
  documentType: DriverDocumentType;
  uri: string;
  contentType?: string;
}

/** Per-document upload outcome, so the caller can tell partial failure from full success. */
export interface DriverApplicationDocumentResult {
  documentType: DriverDocumentType;
  ok: boolean;
  error?: unknown;
}

export interface DriverApplicationSubmitResult {
  /** True only when every document in the batch uploaded successfully. */
  allDocumentsUploaded: boolean;
  documentResults: DriverApplicationDocumentResult[];
}

/**
 * Creates the driver application (POST /driver/apply) then uploads every KYC
 * document. The apply call is NOT best-effort: it throws on failure so the
 * caller can surface the error and keep the driver on the form instead of
 * claiming a submission that never reached the backend (this is what a
 * resubmission from REJECTED/NEEDS_MORE_INFO depends on to actually flip the
 * backend status back to PENDING_REVIEW). Document uploads stay best-effort
 * per-document — one failing image must not lose the others, or the already
 * -created application — but every outcome is returned (not swallowed) so the
 * caller can tell the driver when some documents didn't make it.
 */
export async function submitDriverApplicationWithDocuments(
  application: DriverApplicationInput,
  documents: DriverApplicationDocument[],
): Promise<DriverApplicationSubmitResult> {
  // Apply first so the driver record exists; documents attach to it.
  await applyAsDriver(application);
  // Mirror the policy acceptance the onboarding flow already recorded locally.
  // driver_profiles.policy_accepted defaults to FALSE and nothing else ever set
  // it, so every driver was refused at PATCH /users/mode with 403
  // POLICY_NOT_ACCEPTED — driver mode was unreachable on the backend.
  // Best-effort: a failure here must not lose a submitted application.
  try {
    await acceptDriverPolicy();
  } catch (error) {
    reportOperationalFailure('driver.policy.accept', error);
  }
  // All documents upload CONCURRENTLY. They used to go one at a time — seven
  // documents × three round trips each (presign → PUT → record) meant ~21
  // sequential network calls behind the submit spinner, which is why pressing
  // Submit hung for so long on a mobile connection. Each upload stays
  // best-effort: one failure doesn't block the others, and the (already
  // created) application is never lost. The outcome of each is still
  // reported back — see DriverApplicationSubmitResult above.
  const documentResults = await Promise.all(documents.map(async (doc): Promise<DriverApplicationDocumentResult> => {
    try {
      const fileUrl = await uploadDriverDocument(doc.uri, doc.documentType, doc.contentType);
      // The selfie IS the driver's account photo. POST /v1/driver/documents
      // stores the file but never touches users.profile_image_url — only the
      // admin review path does that — so a driver who onboarded and never
      // manually picked a photo kept profile_image_url NULL and showed no photo
      // on a second handset, which is the very thing uploading it was meant to
      // fix. Best-effort: the document itself is already safely stored.
      if (doc.documentType === 'SELFIE' && fileUrl) {
        try {
          await updateProfile({ profileImageUrl: fileUrl });
        } catch (error) {
          reportOperationalFailure('driver.selfie.promoteToAccountPhoto', error);
        }
      }
      return { documentType: doc.documentType, ok: true };
    } catch (error) {
      // Continue with the remaining documents; record which one failed so a
      // silent gap in the admin's document list is traceable, and hand the
      // failure back to the caller instead of swallowing it.
      reportOperationalFailure('driver.documents.upload', error, { documentType: doc.documentType });
      return { documentType: doc.documentType, ok: false, error };
    }
  }));

  return {
    allDocumentsUploaded: documentResults.every(result => result.ok),
    documentResults,
  };
}
