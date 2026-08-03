import { acceptDriverPolicy, applyAsDriver, type DriverApplicationInput } from './driverProfile';
import { uploadDriverDocument, type DriverDocumentType } from './driverDocuments';
import { reportOperationalFailure } from '@/observability/monitoring';

// Orchestrates the real driver application: create the application
// (POST /driver/apply), then upload each KYC document (presign → PUT → record).

export interface DriverApplicationDocument {
  documentType: DriverDocumentType;
  uri: string;
  contentType?: string;
}

export async function submitDriverApplicationWithDocuments(
  application: DriverApplicationInput,
  documents: DriverApplicationDocument[],
): Promise<void> {
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
  // Best-effort per document — a failed upload can be retried later without
  // losing the (already created) application.
  for (const doc of documents) {
    try {
      await uploadDriverDocument(doc.uri, doc.documentType, doc.contentType);
    } catch {
      // continue with the remaining documents
    }
  }
}
