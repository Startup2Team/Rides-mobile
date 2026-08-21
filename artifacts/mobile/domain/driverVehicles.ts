import type {
  DriverActiveVehicle,
  DriverProfile,
  DriverOnlineVehicleSession,
  DriverVehicleDocumentRecord,
  DriverVehicleDocumentSet,
  DriverVehicleProfile,
  DriverVehicleReviewEvent,
  DriverVehicleReviewEventType,
  DriverVehicleStatus,
  DriverVerificationStatus,
  VehicleType,
} from '@/types';

import { normalizeRwandaPlateNumber } from '@/utils/rwandaValidation';

type LegacyDriverDocuments = Partial<Record<keyof DriverVehicleDocumentSet, DriverVehicleDocumentRecord>>;

// Reconcile the BACKEND vehicle list (authoritative for which vehicles exist and,
// via the driver's approval, their status) with the locally-stored rich vehicle
// data (documents/photos/license). Matched by normalized plate. This is the
// bridge that stops a local row being stuck 'pending_review' after the backend
// approved the driver, and surfaces vehicles that only exist on the backend.
export function reconcileDriverVehicles(
  local: DriverVehicleProfile[],
  backend: {
    id: string;
    vehicleType: VehicleType | null;
    plateNumber: string;
    brand?: string | null;
    model?: string | null;
    manufactureYear?: number | null;
    passengerSeats?: number | null;
    loadCapacityKg?: number | null;
  }[],
  verificationStatus: DriverVerificationStatus | null | undefined,
): DriverVehicleProfile[] {
  const plate = (p: string) => normalizeRwandaPlateNumber(p ?? '');
  const statusFor = (fallback: DriverVehicleStatus): DriverVehicleStatus =>
    verificationStatus === 'approved'
      ? 'approved'
      : verificationStatus === 'rejected'
        ? 'rejected'
        : fallback;

  const backendByPlate = new Map(backend.map(b => [plate(b.plateNumber), b]));
  const merged: DriverVehicleProfile[] = local.map(v => {
    const b = backendByPlate.get(plate(v.plateNumber));
    if (!b) return v; // local draft not yet pushed to the backend — keep as-is
    // KEEP the local id. Everything on-device — details lookup, the per-vehicle
    // entitlement ledger, activeVehicle matching — is keyed by the app-generated
    // stable id, and every backend call already reconciles by plate. Swapping in
    // the backend UUID here is what broke "View details" (Vehicle not found)
    // and zeroed the "rides left" line on the vehicles screen.
    return {
      ...v,
      status: statusFor(v.status),
      brand: v.brand ?? b.brand ?? undefined,
      model: v.model ?? b.model ?? undefined,
      manufactureYear: v.manufactureYear ?? b.manufactureYear ?? undefined,
      // Capacity is backend-owned (migration for all 5 vehicle types); carry it
      // through so the details screen can show seats / load without it getting
      // dropped on reconciliation.
      passengerSeats: v.passengerSeats ?? b.passengerSeats ?? undefined,
      loadCapacityKg: v.loadCapacityKg ?? b.loadCapacityKg ?? undefined,
    };
  });

  const localPlates = new Set(local.map(v => plate(v.plateNumber)));
  for (const b of backend) {
    if (localPlates.has(plate(b.plateNumber))) continue;
    // Backend-only vehicle (added on another device / by an admin): surface a
    // minimal profile so it isn't invisible on this device.
    merged.push({
      id: b.id,
      vehicleType: b.vehicleType ?? 'moto',
      status: statusFor('approved'),
      plateNumber: b.plateNumber,
      licenseNumber: '',
      brand: b.brand ?? undefined,
      model: b.model ?? undefined,
      manufactureYear: b.manufactureYear ?? undefined,
      passengerSeats: b.passengerSeats ?? undefined,
      loadCapacityKg: b.loadCapacityKg ?? undefined,
    });
  }
  return merged;
}

export const DRIVER_VEHICLE_DOCUMENT_REQUIREMENTS = {
  license: { frontRequired: true, backRequired: true },
  nationalId: { frontRequired: true, backRequired: true },
  insurance: { frontRequired: true, backRequired: false },
  authorization: { frontRequired: true, backRequired: false },
} as const;

export interface DriverVehicleApplicationInput {
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  model?: string;
  brand?: string;
  manufactureYear?: number;
  passengerSeats?: number;
  loadCapacityKg?: number;
  licenseExpiryDate?: string;
  insuranceExpiryDate?: string;
  authorizationExpiryDate?: string;
  photos?: {
    outside?: string | null;
    inside?: string | null;
  };
  documents: DriverVehicleDocumentSet;
  submittedAt?: string;
}

const VEHICLE_ID_PREFIX = 'driver-vehicle';
const REVIEW_EVENT_PREFIX = 'driver-vehicle-review';

function slug(value: string | undefined) {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return normalized || 'unknown';
}

function createReviewEventId(vehicleId: string, type: DriverVehicleReviewEventType, at: string) {
  return `${REVIEW_EVENT_PREFIX}:${vehicleId}:${type}:${slug(at)}`;
}

export function getDriverVehicleStatus(profile: Pick<DriverProfile, 'verificationStatus' | 'isVerified'>): DriverVehicleStatus {
  if (profile.verificationStatus === 'approved' && profile.isVerified === true) return 'approved';
  if (profile.verificationStatus === 'rejected') return 'rejected';
  if (profile.verificationStatus === 'draft') return 'draft';
  if (profile.verificationStatus === 'pending_review') return 'pending_review';
  return profile.isVerified === true ? 'approved' : 'pending_review';
}

export function createStableDriverVehicleId(profile: Pick<DriverProfile, 'vehicleType' | 'plateNumber' | 'licenseNumber'>) {
  return `${VEHICLE_ID_PREFIX}:${profile.vehicleType}:${slug(profile.plateNumber || profile.licenseNumber)}`;
}

function documentRecord(
  key: keyof DriverVehicleDocumentSet,
  profile: DriverProfile,
  submittedAt: string,
): DriverVehicleDocumentRecord {
  const isVerified = getDriverVehicleStatus(profile) === 'approved';
  return {
    key,
    faces: [null, null],
    documentNumber: key === 'license' ? profile.licenseNumber : key === 'nationalId' ? profile.nationalId : undefined,
    expiryDate: key === 'license'
      ? profile.licenseExpiryDate
      : key === 'insurance'
        ? profile.insuranceExpiryDate
        : key === 'authorization'
          ? profile.authorizationExpiryDate
          : undefined,
    reviewStatus: isVerified ? 'verified' : 'pending_review',
    submissionKind: 'initial',
    submittedAt,
    updatedAt: submittedAt,
  };
}

export function buildDriverVehicleDocumentSetFromProfile(
  profile: DriverProfile,
  submittedAt = new Date().toISOString(),
): DriverVehicleDocumentSet {
  return {
    license: documentRecord('license', profile, submittedAt),
    nationalId: documentRecord('nationalId', profile, submittedAt),
    insurance: documentRecord('insurance', profile, submittedAt),
    authorization: documentRecord('authorization', profile, submittedAt),
  };
}

function buildDriverVehicleReviewHistory(
  vehicleId: string,
  submittedAt: string,
  status: DriverVehicleStatus,
  approvedAt?: string,
  rejectedAt?: string,
  rejectionReason?: string,
): DriverVehicleReviewEvent[] {
  const history: DriverVehicleReviewEvent[] = [
    {
      id: createReviewEventId(vehicleId, 'submitted', submittedAt),
      type: 'submitted',
      at: submittedAt,
    },
    {
      id: createReviewEventId(vehicleId, 'under_review', submittedAt),
      type: 'under_review',
      at: submittedAt,
    },
  ];

  if (status === 'approved' && approvedAt) {
    history.push({
      id: createReviewEventId(vehicleId, 'approved', approvedAt),
      type: 'approved',
      at: approvedAt,
    });
  }

  if (status === 'rejected' && rejectedAt) {
    history.push({
      id: createReviewEventId(vehicleId, 'rejected', rejectedAt),
      type: 'rejected',
      at: rejectedAt,
      reason: rejectionReason,
    });
  }

  return history;
}

function buildDriverVehicleDocumentUpdateHistory(
  vehicleId: string,
  submittedAt: string,
  previousHistory: DriverVehicleReviewEvent[],
): DriverVehicleReviewEvent[] {
  return [
    ...previousHistory,
    {
      id: createReviewEventId(vehicleId, 'documents_updated', submittedAt),
      type: 'documents_updated',
      at: submittedAt,
    },
    {
      id: createReviewEventId(vehicleId, 'under_review', submittedAt),
      type: 'under_review',
      at: submittedAt,
    },
  ];
}

export function getDriverVehicleReviewHistory(vehicle: DriverVehicleProfile | null | undefined): DriverVehicleReviewEvent[] {
  if (!vehicle) return [];
  if (vehicle.reviewHistory?.length) return vehicle.reviewHistory;
  if (!vehicle.submittedAt) return [];
  return buildDriverVehicleReviewHistory(
    vehicle.id,
    vehicle.submittedAt,
    vehicle.status,
    vehicle.approvedAt,
    vehicle.rejectedAt,
    vehicle.rejectionReason,
  );
}

export function buildDriverVehicleFromLegacyProfile(
  profile: DriverProfile,
  documents?: DriverVehicleDocumentSet,
): DriverVehicleProfile {
  const status = getDriverVehicleStatus(profile);
  const submittedAt = profile.policyAcceptedAt ?? new Date().toISOString();
  const vehicleId = createStableDriverVehicleId(profile);
  return {
    id: vehicleId,
    vehicleType: profile.vehicleType,
    status,
    plateNumber: profile.plateNumber,
    licenseNumber: profile.licenseNumber,
    passengerSeats: profile.passengerSeats,
    loadCapacityKg: profile.loadCapacityKg,
    licenseExpiryDate: profile.licenseExpiryDate,
    insuranceExpiryDate: profile.insuranceExpiryDate,
    authorizationExpiryDate: profile.authorizationExpiryDate,
    photos: undefined,
    documents: documents ?? buildDriverVehicleDocumentSetFromProfile(profile, submittedAt),
    submittedAt,
    approvedAt: status === 'approved' ? submittedAt : undefined,
    rejectedAt: status === 'rejected' ? submittedAt : undefined,
    rejectionReason: profile.rejectionReason,
    reviewHistory: buildDriverVehicleReviewHistory(
      vehicleId,
      submittedAt,
      status,
      status === 'approved' ? submittedAt : undefined,
      status === 'rejected' ? submittedAt : undefined,
      profile.rejectionReason,
    ),
  };
}

export function buildDriverVehicleFromApplication(
  input: DriverVehicleApplicationInput,
  status: DriverVehicleStatus = 'pending_review',
): DriverVehicleProfile {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const approvedAt = status === 'approved' ? submittedAt : undefined;
  const rejectedAt = status === 'rejected' ? submittedAt : undefined;
  const id = createStableDriverVehicleId(input);
  return {
    id,
    vehicleType: input.vehicleType,
    status,
    plateNumber: input.plateNumber,
    licenseNumber: input.licenseNumber,
    model: input.model?.trim() || undefined,
    brand: input.brand?.trim() || undefined,
    manufactureYear: input.manufactureYear,
    passengerSeats: input.passengerSeats,
    loadCapacityKg: input.loadCapacityKg,
    licenseExpiryDate: input.licenseExpiryDate,
    insuranceExpiryDate: input.insuranceExpiryDate,
    authorizationExpiryDate: input.authorizationExpiryDate,
    photos: input.photos,
    documents: input.documents,
    submittedAt,
    approvedAt,
    rejectedAt,
    reviewHistory: buildDriverVehicleReviewHistory(id, submittedAt, status, approvedAt, rejectedAt),
  };
}

export function resubmitDriverVehicleApplication(
  sourceVehicle: DriverVehicleProfile,
  input: DriverVehicleApplicationInput,
): DriverVehicleProfile {
  const next = buildDriverVehicleFromApplication(input, 'pending_review');
  const submittedAt = next.submittedAt ?? new Date().toISOString();
  const previousHistory = getDriverVehicleReviewHistory(sourceVehicle);
  const updateHistory: DriverVehicleReviewEvent[] = [
    {
      id: createReviewEventId(sourceVehicle.id, 'submitted', submittedAt),
      type: 'submitted',
      at: submittedAt,
    },
    {
      id: createReviewEventId(sourceVehicle.id, 'under_review', submittedAt),
      type: 'under_review',
      at: submittedAt,
    },
  ];

  return {
    ...next,
    id: sourceVehicle.id,
    reviewHistory: [...previousHistory, ...updateHistory],
  };
}

export function submitDriverVehicleDocumentUpdate(
  vehicle: DriverVehicleProfile,
  input: Pick<DriverVehicleApplicationInput, 'documents' | 'photos' | 'submittedAt'>,
): DriverVehicleProfile {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const previousHistory = getDriverVehicleReviewHistory(vehicle);
  return {
    ...vehicle,
    pendingDocumentUpdate: {
      status: 'pending_review',
      submittedAt,
      documents: input.documents,
      photos: input.photos,
    },
    reviewHistory: buildDriverVehicleDocumentUpdateHistory(vehicle.id, submittedAt, previousHistory),
  };
}

export function getDriverVehicles(profile: DriverProfile | null | undefined): DriverVehicleProfile[] {
  if (!profile) return [];
  if (profile.vehicles?.length) return profile.vehicles;
  if (!profile.vehicleType || !profile.plateNumber || !profile.licenseNumber) return [];
  return [buildDriverVehicleFromLegacyProfile(profile)];
}

export function getPrimaryDriverVehicle(profile: DriverProfile | null | undefined) {
  return getDriverVehicles(profile)[0] ?? null;
}

export function getApprovedDriverVehicles(profile: DriverProfile | null | undefined) {
  return getDriverVehicles(profile).filter(vehicle => vehicle.status === 'approved');
}

export function getDriverVehicleStatusCounts(profile: DriverProfile | null | undefined) {
  const vehicles = getDriverVehicles(profile);
  return {
    approved: vehicles.filter(vehicle => vehicle.status === 'approved').length,
    pendingReview: vehicles.filter(vehicle => vehicle.status === 'pending_review').length,
    rejected: vehicles.filter(vehicle => vehicle.status === 'rejected').length,
    draft: vehicles.filter(vehicle => vehicle.status === 'draft').length,
  };
}

export function getVehicleById(profile: DriverProfile | null | undefined, vehicleId: string | null | undefined) {
  if (!vehicleId) return null;
  return getDriverVehicles(profile).find(vehicle => vehicle.id === vehicleId) ?? null;
}

export function getActiveDriverVehicle(profile: DriverProfile | null | undefined) {
  if (!profile) return null;
  const vehicles = getDriverVehicles(profile);
  const activeVehicleId = profile.activeVehicle?.vehicleId;
  return vehicles.find(vehicle => vehicle.id === activeVehicleId) ?? getApprovedDriverVehicles(profile)[0] ?? getPrimaryDriverVehicle(profile);
}

export function getOnlineDriverVehicleSession(profile: DriverProfile | null | undefined): DriverOnlineVehicleSession | null {
  return profile?.onlineVehicleSession ?? null;
}

export function getOnlineDriverVehicle(profile: DriverProfile | null | undefined) {
  const session = getOnlineDriverVehicleSession(profile);
  if (!session) return null;
  return getVehicleById(profile, session.vehicleId);
}

export function getDriverVehicleForSession(profile: DriverProfile | null | undefined) {
  return getOnlineDriverVehicle(profile) ?? getActiveDriverVehicle(profile) ?? getPrimaryDriverVehicle(profile);
}

export function getDriverVehicleType(profile: DriverProfile | null | undefined): VehicleType | undefined {
  return getDriverVehicleForSession(profile)?.vehicleType ?? profile?.vehicleType;
}

export function getDriverVehiclePlate(profile: DriverProfile | null | undefined): string | undefined {
  return getDriverVehicleForSession(profile)?.plateNumber ?? profile?.plateNumber;
}

export function migrateDriverProfileToMultiVehicle(profile: DriverProfile): DriverProfile {
  const vehicles = getDriverVehicles(profile);
  const approvedVehicle = vehicles.find(vehicle => vehicle.status === 'approved');
  const activeVehicle: DriverActiveVehicle = profile.activeVehicle?.vehicleId
    ? profile.activeVehicle
    : { vehicleId: approvedVehicle?.id ?? null };

  return {
    ...profile,
    vehicles,
    activeVehicle,
  };
}

export function setDriverActiveVehicle(profile: DriverProfile, vehicleId: string | null): DriverProfile {
  return {
    ...profile,
    activeVehicle: { vehicleId, selectedAt: vehicleId ? new Date().toISOString() : undefined },
  };
}

export function appendDriverVehicle(profile: DriverProfile, vehicle: DriverVehicleProfile): DriverProfile {
  const vehicles = getDriverVehicles(profile);
  const nextVehicles = vehicles.some(item => item.id === vehicle.id)
    ? vehicles.map(item => item.id === vehicle.id ? vehicle : item)
    : [...vehicles, vehicle];
  return {
    ...profile,
    vehicles: nextVehicles,
  };
}

export function attachLegacyDocumentsToPrimaryVehicle(
  profile: DriverProfile,
  documents: LegacyDriverDocuments | null | undefined,
): DriverProfile {
  if (!documents) return profile;
  const vehicles = getDriverVehicles(profile);
  if (vehicles.length === 0) return profile;

  const [primary, ...rest] = vehicles;
  const hasStoredFaces = Object.values(documents).some(record => record?.faces?.some(Boolean));
  if (!hasStoredFaces && primary.documents) return profile;

  const nextPrimary: DriverVehicleProfile = {
    ...primary,
    documents: {
      ...buildDriverVehicleDocumentSetFromProfile(profile, primary.submittedAt),
      ...documents,
    } as DriverVehicleDocumentSet,
  };

  return {
    ...profile,
    vehicles: [nextPrimary, ...rest],
  };
}

export function getDriverVehicleTimeline(vehicle: DriverVehicleProfile | null | undefined) {
  if (!vehicle) return [];
  const submittedAt = vehicle.submittedAt;
  if (!submittedAt) return [];

  const history = getDriverVehicleReviewHistory(vehicle);
  if (history.length > 0) return history;

  return buildDriverVehicleReviewHistory(
    vehicle.id,
    submittedAt,
    vehicle.status,
    vehicle.approvedAt,
    vehicle.rejectedAt,
    vehicle.rejectionReason,
  );
}

export function driverVehicleStatusFromVerificationStatus(
  verificationStatus: Exclude<DriverVerificationStatus, 'not_started'> | undefined,
  isVerified: boolean,
): DriverVehicleStatus {
  return getDriverVehicleStatus({ verificationStatus, isVerified });
}
