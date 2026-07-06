import { applyAsDriver, type DriverApplicationInput } from './driverProfile';
import { uploadDriverDocument, type DriverDocumentType } from './driverDocuments';

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
