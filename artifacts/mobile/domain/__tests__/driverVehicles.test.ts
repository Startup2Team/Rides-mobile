import {
  DRIVER_VEHICLE_DOCUMENT_REQUIREMENTS,
  getActiveDriverVehicle,
  getApprovedDriverVehicles,
  getDriverVehiclePlate,
  getDriverVehicleReviewHistory,
  getDriverVehicleStatus,
  getDriverVehicleStatusCounts,
  getDriverVehicleType,
  getDriverVehicles,
  migrateDriverProfileToMultiVehicle,
  reconcileDriverVehicles,
  resubmitDriverVehicleApplication,
  submitDriverVehicleDocumentUpdate,
} from '../driverVehicles';
import type { DriverProfile, DriverVehicleProfile } from '@/types';

const baseProfile: DriverProfile = {
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  licenseNumber: '1234567890123456',
  nationalId: '1199080012345678',
  licenseExpiryDate: '01/01/2030',
  insuranceExpiryDate: '01/01/2030',
  authorizationExpiryDate: '01/01/2030',
  province: 'City of Kigali',
  district: 'Gasabo',
  sector: 'Kacyiru',
  momoCode: '0788000000',
  momoProvider: 'mtn',
  dob: '01/01/1990',
  isOnline: false,
  isVerified: true,
  acceptanceRate: 100,
  completedRides: 10,
  dailyRides: 2,
  dailyDeclines: 1,
  policyAccepted: true,
  policyAcceptedAt: '2026-06-15T10:00:00.000Z',
  earningsTotal: 50000,
  verificationStatus: 'approved',
};

describe('driver vehicle migration', () => {
  test('legacy approved profile migrates to one approved vehicle with active vehicle set', () => {
    const migrated = migrateDriverProfileToMultiVehicle(baseProfile);

    expect(migrated.vehicles).toHaveLength(1);
    expect(migrated.vehicles?.[0]).toMatchObject({
      id: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      status: 'approved',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      approvedAt: '2026-06-15T10:00:00.000Z',
    });
    expect(migrated.activeVehicle?.vehicleId).toBe('driver-vehicle:moto:rad-001-a');
  });

  test('legacy pending profile migrates to one pending vehicle without active vehicle', () => {
    const migrated = migrateDriverProfileToMultiVehicle({
      ...baseProfile,
      verificationStatus: 'pending_review',
      isVerified: false,
    });

    expect(migrated.vehicles?.[0].status).toBe('pending_review');
    expect(migrated.activeVehicle?.vehicleId).toBeNull();
  });

  test('legacy rejected profile migrates to one rejected vehicle without active vehicle', () => {
    const migrated = migrateDriverProfileToMultiVehicle({
      ...baseProfile,
      verificationStatus: 'rejected',
      isVerified: false,
      rejectionReason: 'Insurance expired',
    });

    expect(migrated.vehicles?.[0]).toMatchObject({
      status: 'rejected',
      rejectedAt: '2026-06-15T10:00:00.000Z',
      rejectionReason: 'Insurance expired',
    });
    expect(migrated.activeVehicle?.vehicleId).toBeNull();
  });

  test('flat vehicle fields remain accessible through compatibility helpers', () => {
    const migrated = migrateDriverProfileToMultiVehicle(baseProfile);

    expect(getDriverVehicles(migrated)).toHaveLength(1);
    expect(getApprovedDriverVehicles(migrated)).toHaveLength(1);
    expect(getActiveDriverVehicle(migrated)?.vehicleType).toBe('moto');
    expect(getDriverVehicleType(migrated)).toBe('moto');
    expect(getDriverVehiclePlate(migrated)).toBe('RAD 001 A');
  });

  test('document shape includes required front and back rules', () => {
    expect(DRIVER_VEHICLE_DOCUMENT_REQUIREMENTS).toEqual({
      license: { frontRequired: true, backRequired: true },
      nationalId: { frontRequired: true, backRequired: true },
      insurance: { frontRequired: true, backRequired: false },
      authorization: { frontRequired: true, backRequired: false },
    });
  });

  test('unknown fields are preserved during migration', () => {
    const profileWithUnknown = {
      ...baseProfile,
      backendOnlyField: 'preserve-me',
    } as DriverProfile & { backendOnlyField: string };
    const migrated = migrateDriverProfileToMultiVehicle(profileWithUnknown) as DriverProfile & { backendOnlyField: string };

    expect(migrated.backendOnlyField).toBe('preserve-me');
  });

  test('status mapping follows verificationStatus and isVerified', () => {
    expect(getDriverVehicleStatus({ verificationStatus: 'approved', isVerified: true })).toBe('approved');
    expect(getDriverVehicleStatus({ verificationStatus: 'approved', isVerified: false })).toBe('pending_review');
    expect(getDriverVehicleStatus({ verificationStatus: 'draft', isVerified: false })).toBe('draft');
    expect(getDriverVehicleStatus({ verificationStatus: 'rejected', isVerified: false })).toBe('rejected');
  });

  test('review history is created for legacy migrated vehicles', () => {
    const migrated = migrateDriverProfileToMultiVehicle(baseProfile);

    expect(getDriverVehicleReviewHistory(migrated.vehicles?.[0])).toEqual([
      expect.objectContaining({ type: 'submitted' }),
      expect.objectContaining({ type: 'under_review' }),
      expect.objectContaining({ type: 'approved' }),
    ]);
  });

  test('status counts summarize the vehicle set', () => {
    const migrated = migrateDriverProfileToMultiVehicle({
      ...baseProfile,
      vehicles: [
        { ...migratedVehicle('moto', 'approved'), status: 'approved' },
        { ...migratedVehicle('cab', 'pending_review'), status: 'pending_review' },
        { ...migratedVehicle('fuso', 'rejected'), status: 'rejected' },
      ],
    } as DriverProfile);

    expect(getDriverVehicleStatusCounts(migrated)).toEqual({
      approved: 1,
      pendingReview: 1,
      rejected: 1,
      draft: 0,
    });
  });

  test('resubmitting a rejected vehicle preserves the vehicle id and review history', () => {
    const sourceVehicle = {
      id: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      status: 'rejected',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      submittedAt: '2026-06-15T10:00:00.000Z',
      rejectedAt: '2026-06-16T10:00:00.000Z',
      rejectionReason: 'Insurance expired',
      reviewHistory: [
        { id: 'event-1', type: 'submitted', at: '2026-06-15T10:00:00.000Z' },
        { id: 'event-2', type: 'under_review', at: '2026-06-15T10:00:00.000Z' },
        { id: 'event-3', type: 'rejected', at: '2026-06-16T10:00:00.000Z', reason: 'Insurance expired' },
      ],
    } satisfies NonNullable<DriverProfile['vehicles']>[number];

    const resubmitted = resubmitDriverVehicleApplication(sourceVehicle, {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      documents: {
        license: { key: 'license', faces: ['front', 'back'], reviewStatus: 'pending_review', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        nationalId: { key: 'nationalId', faces: ['front', 'back'], reviewStatus: 'pending_review', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        insurance: { key: 'insurance', faces: ['front', null], reviewStatus: 'pending_review', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        authorization: { key: 'authorization', faces: ['front', null], reviewStatus: 'pending_review', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
      },
      submittedAt: '2026-06-17T10:00:00.000Z',
    });

    expect(resubmitted.id).toBe(sourceVehicle.id);
    expect(resubmitted.status).toBe('pending_review');
    expect(resubmitted.reviewHistory?.slice(-2)).toEqual([
      expect.objectContaining({ type: 'submitted' }),
      expect.objectContaining({ type: 'under_review' }),
    ]);
  });

  test('submitting a document update preserves the vehicle id and keeps the vehicle approved', () => {
    const vehicle = {
      id: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      status: 'approved',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      submittedAt: '2026-06-15T10:00:00.000Z',
      reviewHistory: [
        { id: 'event-1', type: 'submitted', at: '2026-06-15T10:00:00.000Z' },
        { id: 'event-2', type: 'under_review', at: '2026-06-15T10:00:00.000Z' },
        { id: 'event-3', type: 'approved', at: '2026-06-15T11:00:00.000Z' },
      ],
    } satisfies NonNullable<DriverProfile['vehicles']>[number];

    const updated = submitDriverVehicleDocumentUpdate(vehicle, {
      documents: {
        license: { key: 'license', faces: ['front', 'back'], reviewStatus: 'verified', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        nationalId: { key: 'nationalId', faces: ['front', 'back'], reviewStatus: 'verified', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        insurance: { key: 'insurance', faces: ['front', null], reviewStatus: 'verified', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        authorization: { key: 'authorization', faces: ['front', null], reviewStatus: 'verified', submissionKind: 'replacement', submittedAt: '2026-06-17T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
      },
      photos: { outside: 'vehicle-outside://photo', inside: 'vehicle-inside://photo' },
      submittedAt: '2026-06-17T10:00:00.000Z',
    });

    expect(updated.id).toBe(vehicle.id);
    expect(updated.status).toBe('approved');
    expect(updated.pendingDocumentUpdate?.status).toBe('pending_review');
    expect(updated.reviewHistory?.slice(-2)).toEqual([
      expect.objectContaining({ type: 'documents_updated' }),
      expect.objectContaining({ type: 'under_review' }),
    ]);
  });
});

function migratedVehicle(vehicleType: 'moto' | 'cab' | 'fuso', status: 'approved' | 'pending_review' | 'rejected') {
  return {
    id: `driver-vehicle:${vehicleType}:sample`,
    vehicleType,
    status,
    plateNumber: `${vehicleType.toUpperCase()} 001 A`,
    licenseNumber: '1234567890123456',
    submittedAt: '2026-06-15T10:00:00.000Z',
  } satisfies NonNullable<DriverProfile['vehicles']>[number];
}

describe('reconcileDriverVehicles capacity', () => {
  const localVehicle: DriverVehicleProfile = {
    id: 'driver-vehicle:cab:rac-001-b',
    vehicleType: 'cab',
    status: 'approved',
    plateNumber: 'RAC 001 B',
    licenseNumber: '1234567890123456',
  };

  it('carries backend passenger seats / load capacity onto a matched local vehicle', () => {
    const [merged] = reconcileDriverVehicles(
      [localVehicle],
      [
        {
          id: 'backend-uuid',
          vehicleType: 'cab',
          plateNumber: 'RAC 001 B',
          passengerSeats: 4,
          loadCapacityKg: null,
        },
      ],
      'approved',
    );

    // Local id is preserved (details lookup keys off it) while capacity fills in.
    expect(merged.id).toBe('driver-vehicle:cab:rac-001-b');
    expect(merged.passengerSeats).toBe(4);
    expect(merged.loadCapacityKg).toBeUndefined();
  });

  it('surfaces capacity on a backend-only vehicle', () => {
    const [surfaced] = reconcileDriverVehicles(
      [],
      [
        {
          id: 'backend-uuid',
          vehicleType: 'fuso',
          plateNumber: 'RAB 001 K',
          passengerSeats: null,
          loadCapacityKg: 3500,
        },
      ],
      'approved',
    );

    expect(surfaced.loadCapacityKg).toBe(3500);
    expect(surfaced.passengerSeats).toBeUndefined();
  });
});
