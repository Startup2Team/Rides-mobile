import { applyAsDriver, type DriverApplicationInput } from './driverProfile';
import { uploadDriverDocument, type DriverDocumentType } from './driverDocuments';

// Orchestrates the real driver application: create the application
// (POST /driver/apply), then upload each KYC document (presign → PUT → record).

export interface DriverApplicationDocument {
  documentType: DriverDocumentType;
  uri: string;
  contentType?: string;
}

export interface DriverApplicationResult {
  // The application itself was created (or already existed) on the backend.
  applicationAccepted: boolean;
  // Set when the application call failed outright — no document was attempted.
  applicationError?: Error;
  uploaded: DriverDocumentType[];
  failed: { documentType: DriverDocumentType; error: Error }[];
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

// Creates the application, then uploads each KYC document. Every document is
// attempted even if an earlier one fails, but the outcome is REPORTED rather
// than swallowed: a caller that ignores `failed` will tell the driver their
// documents are in when they are not, and the admin panel will show an
// application with nothing to review.
export async function submitDriverApplicationWithDocuments(
  application: DriverApplicationInput,
  documents: DriverApplicationDocument[],
): Promise<DriverApplicationResult> {
  const result: DriverApplicationResult = { applicationAccepted: false, uploaded: [], failed: [] };

  // Apply first so the driver record exists; documents attach to it. A repeat
  // application 409s (ErrDriverAlreadyApplied) — the driver record is already
  // there, so documents can and must still be uploaded against it.
  try {
    await applyAsDriver(application);
    result.applicationAccepted = true;
  } catch (error) {
    const err = asError(error);
    if (isAlreadyAppliedError(err)) {
      result.applicationAccepted = true;
    } else {
      result.applicationError = err;
      return result;
    }
  }

  for (const doc of documents) {
    try {
      await uploadDriverDocument(doc.uri, doc.documentType, doc.contentType);
      result.uploaded.push(doc.documentType);
    } catch (error) {
      result.failed.push({ documentType: doc.documentType, error: asError(error) });
    }
  }
  return result;
}

// A driver who re-submits (or resumes a draft) hits 409 DRIVER_ALREADY_APPLIED.
// That is not a failure for our purposes — the profile documents attach to
// already exists, so we continue to the uploads instead of aborting.
function isAlreadyAppliedError(error: Error): boolean {
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  if (status === 409) return true;
  if (code && code.toUpperCase().includes('ALREADY_APPLIED')) return true;
  return /already applied/i.test(error.message);
}
