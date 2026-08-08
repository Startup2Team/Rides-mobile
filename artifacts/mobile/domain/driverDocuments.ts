import type { DocFaces, DocumentKey, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import type { DriverDocument, DriverDocumentType } from '@/services/driverDocuments';
import type { DriverProfile } from '@/types';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';

export type DriverDocumentReviewStatus = 'verified' | 'pending_review' | 'rejected';
export type DriverDocumentDisplayStatus = DriverDocumentReviewStatus | 'expired' | 'expiring_soon';

export interface DriverDocumentRecord {
  key: DocumentKey;
  faces: DocFaces;
  documentNumber?: string;
  expiryDate?: string;
  reviewStatus: DriverDocumentReviewStatus;
  submissionKind: 'initial' | 'replacement';
  submittedAt: string;
  updatedAt: string;
  /**
   * Server-derived: whether the API would accept a replacement. Approved
   * documents are view-only until an admin opens a re-upload window, so the
   * screen can hide an action that would 409. Undefined when nothing has been
   * read back from the API yet.
   */
  editable?: boolean;
}

export type DriverDocuments = Record<DocumentKey, DriverDocumentRecord>;

/**
 * Which API document types make up each card, as [front, back]. The API models
 * a two-sided document as two independent rows, the UI as one card with two
 * faces, and this is the single place that reconciles the two.
 */
export const DRIVER_DOCUMENT_API_TYPES: Record<DocumentKey, readonly [DriverDocumentType, DriverDocumentType | null]> = {
  license: ['LICENCE_FRONT', 'LICENCE_BACK'],
  nationalId: ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK'],
  insurance: ['VEHICLE_INSURANCE', null],
  authorization: ['VEHICLE_AUTHORIZATION', null],
};

export const DRIVER_DOCUMENT_LABELS: Record<DocumentKey, string> = {
  license: "Driver's Licence",
  nationalId: 'National ID',
  insurance: 'Vehicle Insurance',
  authorization: 'Authorization Certificate',
};

export const DOCUMENTS_REQUIRING_BACK: DocumentKey[] = ['license', 'nationalId'];

export function buildInitialDriverDocuments(
  form: DriverOnboardingForm,
  docs: Record<DocumentKey, DocFaces>,
  submittedAt = new Date().toISOString(),
): DriverDocuments {
  return {
    license: createRecord('license', docs.license, submittedAt, form.licenseNumber, form.licenseExpiryDate),
    nationalId: createRecord('nationalId', docs.nationalId, submittedAt, form.nationalId),
    insurance: createRecord('insurance', docs.insurance, submittedAt, undefined, form.insuranceExpiryDate),
    authorization: createRecord('authorization', docs.authorization, submittedAt, undefined, form.authorizationExpiryDate),
  };
}

export function buildDriverDocumentsFromProfile(profile: DriverProfile, submittedAt = new Date().toISOString()): DriverDocuments {
  const record = (key: DocumentKey, documentNumber?: string, expiryDate?: string): DriverDocumentRecord => ({
    key,
    faces: [null, null],
    documentNumber,
    expiryDate,
    reviewStatus: profile.isVerified ? 'verified' : 'pending_review',
    submissionKind: 'initial',
    submittedAt,
    updatedAt: submittedAt,
  });
  return {
    license: record('license', profile.licenseNumber, profile.licenseExpiryDate),
    nationalId: record('nationalId', profile.nationalId),
    insurance: record('insurance', undefined, profile.insuranceExpiryDate),
    authorization: record('authorization', undefined, profile.authorizationExpiryDate),
  };
}

export function reconcileDriverDocumentsWithProfile(documents: DriverDocuments, profile: DriverProfile): DriverDocuments {
  if (!profile.isVerified) return documents;
  let changed = false;
  const reconciled = Object.fromEntries(
    Object.entries(documents).map(([key, record]) => [
      key,
      (() => {
        if (record.submissionKind !== 'initial' || record.reviewStatus !== 'pending_review') return record;
        changed = true;
        return { ...record, reviewStatus: 'verified' as const };
      })(),
    ]),
  ) as DriverDocuments;
  return changed ? reconciled : documents;
}

function toReviewStatus(status: DriverDocument['reviewStatus']): DriverDocumentReviewStatus | undefined {
  switch (status) {
    case 'APPROVED':
      return 'verified';
    case 'REJECTED':
      return 'rejected';
    case 'PENDING':
      return 'pending_review';
    default:
      return undefined;
  }
}

/**
 * Overlay the LIVE server documents (GET /v1/driver/documents) onto the locally
 * held records.
 *
 * The server owns the files and their review state; local storage only ever knew
 * about uploads made on this handset, which is why a reinstall showed a driver
 * empty document cards even though the backend held their approved papers. The
 * document number and expiry date stay local — the API does not carry them.
 */
export function mergeServerDriverDocuments(
  documents: DriverDocuments,
  serverDocuments: readonly DriverDocument[],
): DriverDocuments {
  const byType = new Map(serverDocuments.map(doc => [doc.documentType, doc]));
  let changed = false;

  const merged = Object.fromEntries(
    (Object.keys(documents) as DocumentKey[]).map(key => {
      const [frontType, backType] = DRIVER_DOCUMENT_API_TYPES[key];
      const front = byType.get(frontType);
      const back = backType ? byType.get(backType) : undefined;
      if (!front && !back) return [key, documents[key]];

      const record = documents[key];
      const faces: DocFaces = [front?.fileUrl ?? record.faces[0], back?.fileUrl ?? record.faces[1]];
      // The front carries the card's status; a two-sided document is reviewed as
      // one thing, and the front is the face that always exists.
      const reviewStatus = toReviewStatus(front?.reviewStatus ?? back?.reviewStatus) ?? record.reviewStatus;
      const editable = front?.editable ?? back?.editable ?? record.editable;
      const updatedAt = front?.createdAt ?? back?.createdAt ?? record.updatedAt;

      if (
        faces[0] === record.faces[0]
        && faces[1] === record.faces[1]
        && reviewStatus === record.reviewStatus
        && editable === record.editable
        && updatedAt === record.updatedAt
      ) {
        return [key, record];
      }
      changed = true;
      return [key, { ...record, faces, reviewStatus, editable, updatedAt }];
    }),
  ) as DriverDocuments;

  return changed ? merged : documents;
}

export function getDriverDocumentDisplayStatus(record: DriverDocumentRecord, now = new Date()): DriverDocumentDisplayStatus {
  if (record.reviewStatus !== 'verified') return record.reviewStatus;
  if (!record.expiryDate) return 'verified';
  const expiry = parseDateDdMmYyyy(record.expiryDate);
  if (!expiry) return 'verified';
  if (expiry < now) return 'expired';
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return expiry <= thirtyDaysFromNow ? 'expiring_soon' : 'verified';
}

function createRecord(
  key: DocumentKey,
  faces: DocFaces,
  submittedAt: string,
  documentNumber?: string,
  expiryDate?: string,
): DriverDocumentRecord {
  return {
    key,
    faces,
    documentNumber,
    expiryDate,
    reviewStatus: 'pending_review',
    submissionKind: 'initial',
    submittedAt,
    updatedAt: submittedAt,
  };
}
