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
  // All documents upload CONCURRENTLY. They used to go one at a time — seven
  // documents × three round trips each (presign → PUT → record) meant ~21
  // sequential network calls behind the submit spinner, which is why pressing
  // Submit hung for so long on a mobile connection. Each upload stays
  // best-effort: one failure doesn't block the others, and the (already
  // created) application is never lost.
  await Promise.all(documents.map(async doc => {
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
    } catch (error) {
      // Continue with the remaining documents; record which one failed so a
      // silent gap in the admin's document list is traceable.
      reportOperationalFailure('driver.documents.upload', error, { documentType: doc.documentType });
    }
  }));
}
