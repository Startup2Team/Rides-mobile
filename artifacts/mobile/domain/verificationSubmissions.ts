import type { DocFaces, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { buildInitialDriverDocuments } from '@/domain/driverDocuments';
import { normalizeRwandaPhoneNumber, normalizeRwandaPlateNumber } from '@/utils/rwandaValidation';
import { isAtLeastAge } from '@/utils/dateUtils';
import type {
  DriverApplicationSubmission,
  DriverProfile,
  DriverVehicleDocumentSet,
  DriverVehicleProfile,
  VerificationReviewDecision,
  VerificationSubmissionHistoryEvent,
  VerificationSubmissionStatus,
  VehicleApplicationSubmission,
  VehicleDocumentUpdateSubmission,
  VehicleType,
} from '@/types';
import { requiresVehiclePhotos } from '@/hooks/driver-onboarding/onboardingTypes';
import {
  EMPTY_VERIFICATION_SUBMISSION_STORE,
  loadStoredVerificationSubmissions,
  saveStoredVerificationSubmissions,
  type VerificationSubmissionStore,
} from '@/persistence/verificationSubmissionPersistence';

type SubmissionKind = 'driver_application' | 'vehicle_application' | 'vehicle_document_update';

type SubmissionWithKind =
  | DriverApplicationSubmission
  | VehicleApplicationSubmission
  | VehicleDocumentUpdateSubmission;

interface SubmissionCreationBase {
  clientSubmissionId?: string;
  submittedAt?: string;
}

export interface SubmitDriverApplicationInput extends SubmissionCreationBase {
  userId: string;
  fullName: string;
  phone: string;
  driverProfile: DriverProfile;
  form: DriverOnboardingForm;
  docs: Record<keyof DriverVehicleDocumentSet, DocFaces>;
  vehiclePhotos?: {
    outside?: string | null;
    inside?: string | null;
  };
  selfieUri: string | null;
}

export interface SubmitVehicleApplicationInput extends SubmissionCreationBase {
  userId: string;
  driverProfile: DriverProfile;
  vehicle: DriverVehicleProfile;
  sourceVehicleStatus?: DriverVehicleProfile['status'];
  docs: DriverVehicleDocumentSet;
  photos?: {
    outside?: string | null;
    inside?: string | null;
  };
}

export interface SubmitVehicleDocumentUpdateInput extends SubmissionCreationBase {
  userId: string;
  driverProfile: DriverProfile;
  vehicle: DriverVehicleProfile;
  sourceVehicleStatus?: DriverVehicleProfile['status'];
  documents: DriverVehicleDocumentSet;
  photos?: {
    outside?: string | null;
    inside?: string | null;
  };
  changedFields?: Array<keyof DriverVehicleDocumentSet | 'outside' | 'inside'>;
}

function createSubmissionId(kind: SubmissionKind, subjectId: string, submittedAt: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${kind}:${subjectId}:${submittedAt.replace(/[^0-9A-Za-z]/g, '')}:${random}`;
}

function createHistoryEventId(submissionId: string, type: string, at: string) {
  return `${submissionId}:${type}:${at.replace(/[^0-9A-Za-z]/g, '')}`;
}

function createHistory(submissionId: string, submittedAt: string, isResubmission: boolean): VerificationSubmissionHistoryEvent[] {
  const events: VerificationSubmissionHistoryEvent[] = [];
  if (isResubmission) {
    events.push({
      id: createHistoryEventId(submissionId, 'resubmitted', submittedAt),
      type: 'resubmitted',
      at: submittedAt,
    });
  }
  events.push(
    {
      id: createHistoryEventId(submissionId, 'submitted', submittedAt),
      type: 'submitted',
      at: submittedAt,
    },
    {
      id: createHistoryEventId(submissionId, 'pending_review', submittedAt),
      type: 'pending_review',
      at: submittedAt,
    },
  );
  return events;
}

function appendDecisionHistory(
  submission: SubmissionWithKind,
  decision: VerificationReviewDecision,
): VerificationSubmissionHistoryEvent[] {
  return [
    ...submission.history,
    {
      id: createHistoryEventId(submission.id, decision.status, decision.reviewedAt),
      type: decision.status,
      at: decision.reviewedAt,
      reason: decision.reason,
      rejectedFields: decision.rejectedFields,
      rejectedDocuments: decision.rejectedDocuments,
      reviewedBy: decision.reviewedBy,
    },
  ];
}

function withDecision<T extends SubmissionWithKind>(submission: T, decision: VerificationReviewDecision): T {
  const nextStatus: VerificationSubmissionStatus = decision.status === 'approved' ? 'approved' : 'rejected';
  return {
    ...submission,
    status: nextStatus,
    reviewStatus: decision.status === 'approved' ? 'approved' : 'rejected',
    updatedAt: decision.reviewedAt,
    reviewDecision: decision,
    history: appendDecisionHistory(submission, decision),
  };
}

async function loadStore(): Promise<VerificationSubmissionStore> {
  const stored = await loadStoredVerificationSubmissions();
  return stored.data ?? EMPTY_VERIFICATION_SUBMISSION_STORE;
}

function dedupeSubmission<T extends SubmissionWithKind>(collection: T[], next: T): T[] {
  const existingIndex = collection.findIndex(item => item.clientSubmissionId === next.clientSubmissionId);
  if (existingIndex >= 0) {
    return collection;
  }
  return [...collection, next];
}

function buildDriverApplicationSubmission(input: SubmitDriverApplicationInput) {
  if (!isAtLeastAge(input.form.dob, 18)) {
    throw new Error('Driver applicants must be at least 18 years old.');
  }
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const clientSubmissionId = input.clientSubmissionId ?? createSubmissionId('driver_application', input.userId, submittedAt);
  const isResubmission = input.driverProfile.verificationStatus === 'rejected';
  const storeSubmissionId = clientSubmissionId;
  return {
    id: storeSubmissionId,
    clientSubmissionId,
    kind: 'driver_application' as const,
    status: isResubmission ? 'resubmitted' as const : 'pending_review' as const,
    reviewStatus: 'pending_review' as const,
    submittedAt,
    updatedAt: submittedAt,
    history: createHistory(storeSubmissionId, submittedAt, isResubmission),
    userId: input.userId,
    fullName: input.fullName,
    phone: input.phone,
    dob: input.form.dob,
    nationalId: input.form.nationalId,
    operatingLocation: {
      province: input.form.province,
      district: input.form.district,
      sector: input.form.sector,
      cell: input.form.cell || undefined,
      village: input.form.village || undefined,
      city: input.driverProfile.city || undefined,
    },
    momoDetails: {
      provider: input.form.momoProvider,
      momoCode: normalizeRwandaPhoneNumber(input.form.momoCode) ?? input.form.momoCode.trim(),
      merchantCode: input.form.merchantCode.trim().toUpperCase() || undefined,
    },
    selfieImage: input.selfieUri,
    firstVehicle: {
      vehicleType: input.form.vehicleType,
      plateNumber: normalizeRwandaPlateNumber(input.form.plateNumber),
      licenseNumber: input.form.licenseNumber,
      brand: input.form.brand.trim() || undefined,
      model: input.form.model.trim() || undefined,
      manufactureYear: input.form.manufactureYear ? Number.parseInt(input.form.manufactureYear, 10) : undefined,
      licenseExpiryDate: input.form.licenseExpiryDate,
      insuranceExpiryDate: input.form.insuranceExpiryDate,
      authorizationExpiryDate: input.form.authorizationExpiryDate,
      passengerSeats: input.form.passengerSeats ? Number.parseInt(input.form.passengerSeats, 10) : undefined,
      loadCapacityKg: input.form.loadCapacityKg ? Number.parseInt(input.form.loadCapacityKg, 10) : undefined,
    },
    documents: buildInitialDriverDocuments(input.form, input.docs, submittedAt),
    photos: requiresVehiclePhotos(input.form.vehicleType) ? input.vehiclePhotos : undefined,
  } satisfies DriverApplicationSubmission;
}

function buildVehicleApplicationSubmission(input: SubmitVehicleApplicationInput) {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const clientSubmissionId = input.clientSubmissionId ?? createSubmissionId('vehicle_application', input.vehicle.id, submittedAt);
  const isResubmission = input.sourceVehicleStatus === 'rejected' || input.vehicle.status === 'rejected';
  return {
    id: clientSubmissionId,
    clientSubmissionId,
    kind: 'vehicle_application' as const,
    status: isResubmission ? 'resubmitted' : 'pending_review',
    reviewStatus: 'pending_review' as const,
    submittedAt,
    updatedAt: submittedAt,
    history: createHistory(clientSubmissionId, submittedAt, isResubmission),
    userId: input.userId,
    driverId: input.userId,
    vehicleId: input.vehicle.id,
    vehicleType: input.vehicle.vehicleType,
    plateNumber: normalizeRwandaPlateNumber(input.vehicle.plateNumber),
    licenseNumber: input.vehicle.licenseNumber,
    brand: input.vehicle.brand,
    model: input.vehicle.model,
    manufactureYear: input.vehicle.manufactureYear,
    passengerSeats: input.vehicle.passengerSeats,
    loadCapacityKg: input.vehicle.loadCapacityKg,
    licenseExpiryDate: input.vehicle.licenseExpiryDate,
    insuranceExpiryDate: input.vehicle.insuranceExpiryDate,
    authorizationExpiryDate: input.vehicle.authorizationExpiryDate,
    documents: input.docs,
    photos: input.photos,
  } satisfies VehicleApplicationSubmission;
}

function buildVehicleDocumentUpdateSubmission(input: SubmitVehicleDocumentUpdateInput) {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const clientSubmissionId = input.clientSubmissionId ?? createSubmissionId('vehicle_document_update', input.vehicle.id, submittedAt);
  return {
    id: clientSubmissionId,
    clientSubmissionId,
    kind: 'vehicle_document_update' as const,
    status: 'pending_review' as const,
    reviewStatus: 'pending_review' as const,
    submittedAt,
    updatedAt: submittedAt,
    history: createHistory(clientSubmissionId, submittedAt, input.sourceVehicleStatus === 'rejected' || input.vehicle.status === 'rejected'),
    userId: input.userId,
    driverId: input.userId,
    vehicleId: input.vehicle.id,
    vehicleType: input.vehicle.vehicleType,
    plateNumber: input.vehicle.plateNumber,
    changedFields: input.changedFields ?? ['license', 'nationalId', 'insurance', 'authorization', 'outside', 'inside'],
    previousDocumentMetadata: {
      documents: input.vehicle.documents,
      photos: input.vehicle.photos,
    },
    documents: input.documents,
    photos: input.photos,
  } satisfies VehicleDocumentUpdateSubmission;
}

export async function submitDriverApplication(input: SubmitDriverApplicationInput) {
  const store = await loadStore();
  const submission = buildDriverApplicationSubmission(input);
  const existing = store.driverApplications.find(item => item.clientSubmissionId === submission.clientSubmissionId);
  if (existing) return existing;
  const nextStore: VerificationSubmissionStore = {
    ...store,
    driverApplications: dedupeSubmission(store.driverApplications, submission),
  };
  await saveStoredVerificationSubmissions(nextStore);
  return submission;
}

export async function submitVehicleApplication(input: SubmitVehicleApplicationInput) {
  const store = await loadStore();
  const submission = buildVehicleApplicationSubmission(input);
  const existing = store.vehicleApplications.find(item => item.clientSubmissionId === submission.clientSubmissionId);
  if (existing) return existing;
  const nextStore: VerificationSubmissionStore = {
    ...store,
    vehicleApplications: dedupeSubmission(store.vehicleApplications, submission),
  };
  await saveStoredVerificationSubmissions(nextStore);
  return submission;
}

export async function submitVehicleDocumentUpdate(input: SubmitVehicleDocumentUpdateInput) {
  const store = await loadStore();
  const submission = buildVehicleDocumentUpdateSubmission(input);
  const existing = store.vehicleDocumentUpdates.find(item => item.clientSubmissionId === submission.clientSubmissionId);
  if (existing) return existing;
  const nextStore: VerificationSubmissionStore = {
    ...store,
    vehicleDocumentUpdates: dedupeSubmission(store.vehicleDocumentUpdates, submission),
  };
  await saveStoredVerificationSubmissions(nextStore);
  return submission;
}

export async function applyVerificationDecision(
  submission: SubmissionWithKind,
  decision: VerificationReviewDecision,
) {
  const nextSubmission = withDecision(submission, decision);
  const store = await loadStore();
  const nextStore: VerificationSubmissionStore = {
    driverApplications: store.driverApplications.map(item => item.clientSubmissionId === nextSubmission.clientSubmissionId ? nextSubmission as DriverApplicationSubmission : item),
    vehicleApplications: store.vehicleApplications.map(item => item.clientSubmissionId === nextSubmission.clientSubmissionId ? nextSubmission as VehicleApplicationSubmission : item),
    vehicleDocumentUpdates: store.vehicleDocumentUpdates.map(item => item.clientSubmissionId === nextSubmission.clientSubmissionId ? nextSubmission as VehicleDocumentUpdateSubmission : item),
  };
  await saveStoredVerificationSubmissions(nextStore);
  return nextSubmission;
}

export function buildDriverApplicationSubmissionPayload(input: SubmitDriverApplicationInput) {
  return buildDriverApplicationSubmission(input);
}

export function buildVehicleApplicationSubmissionPayload(input: SubmitVehicleApplicationInput) {
  return buildVehicleApplicationSubmission(input);
}

export function buildVehicleDocumentUpdateSubmissionPayload(input: SubmitVehicleDocumentUpdateInput) {
  return buildVehicleDocumentUpdateSubmission(input);
}
