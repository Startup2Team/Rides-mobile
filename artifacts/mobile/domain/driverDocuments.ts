import type { DocFaces, DocumentKey, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
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
}

export type DriverDocuments = Record<DocumentKey, DriverDocumentRecord>;

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
