import {
  DOCUMENTS_REQUIRING_BACK,
  buildDriverDocumentsFromProfile,
  buildInitialDriverDocuments,
  getDriverDocumentDisplayStatus,
  mergeServerDriverDocuments,
  reconcileDriverDocumentsWithProfile,
} from '../driverDocuments';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM } from '@/hooks/driver-onboarding/onboardingTypes';
import type { DriverDocument } from '@/services/driverDocuments';
import type { DriverProfile } from '@/types';

const profile: DriverProfile = {
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
  completedRides: 0,
  dailyRides: 0,
  dailyDeclines: 0,
  policyAccepted: true,
  earningsTotal: 0,
};

describe('driver documents', () => {
  test('requires back images only for licence and National ID', () => {
    expect(DOCUMENTS_REQUIRING_BACK).toEqual(['license', 'nationalId']);
  });

  test('builds pending initial records from onboarding submission', () => {
    const records = buildInitialDriverDocuments(
      {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        licenseNumber: profile.licenseNumber,
        nationalId: profile.nationalId!,
        licenseExpiryDate: profile.licenseExpiryDate!,
      },
      {
        ...INITIAL_DRIVER_DOCUMENTS,
        license: ['file:///licence-front.jpg', 'file:///licence-back.jpg'],
      },
      '2026-06-15T10:00:00.000Z',
    );

    expect(records.license.reviewStatus).toBe('pending_review');
    expect(records.license.faces).toEqual(['file:///licence-front.jpg', 'file:///licence-back.jpg']);
    expect(records.license.documentNumber).toBe(profile.licenseNumber);
  });

  test('builds verified fallback records for existing approved drivers', () => {
    const records = buildDriverDocumentsFromProfile(profile, '2026-06-15T10:00:00.000Z');

    expect(records.nationalId.reviewStatus).toBe('verified');
    expect(records.nationalId.documentNumber).toBe(profile.nationalId);
  });

  test('shows expired verified documents as expired', () => {
    const record = buildDriverDocumentsFromProfile({
      ...profile,
      insuranceExpiryDate: '01/01/2020',
    }).insurance;

    expect(getDriverDocumentDisplayStatus(record, new Date('2026-06-15T10:00:00.000Z'))).toBe('expired');
  });

  test('marks approved initial submissions verified but keeps replacements pending', () => {
    const records = buildInitialDriverDocuments(INITIAL_DRIVER_ONBOARDING_FORM, INITIAL_DRIVER_DOCUMENTS);
    records.insurance.submissionKind = 'replacement';

    const reconciled = reconcileDriverDocumentsWithProfile(records, profile);

    expect(reconciled.license.reviewStatus).toBe('verified');
    expect(reconciled.insurance.reviewStatus).toBe('pending_review');
  });

  test('shows the documents the server holds, not just this handset', () => {
    // A reinstall: nothing local, everything on the backend.
    const local = buildInitialDriverDocuments(INITIAL_DRIVER_ONBOARDING_FORM, INITIAL_DRIVER_DOCUMENTS);
    const server: DriverDocument[] = [
      { id: '1', documentType: 'LICENCE_FRONT', fileUrl: 'https://cdn/1.jpg', reviewStatus: 'APPROVED', editable: false },
      { id: '2', documentType: 'LICENCE_BACK', fileUrl: 'https://cdn/2.jpg', reviewStatus: 'APPROVED', editable: false },
      { id: '3', documentType: 'VEHICLE_INSURANCE', fileUrl: 'https://cdn/3.jpg', reviewStatus: 'REJECTED', editable: true },
    ];

    const merged = mergeServerDriverDocuments(local, server);

    expect(merged.license.faces).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg']);
    expect(merged.license.reviewStatus).toBe('verified');
    expect(merged.license.editable).toBe(false);
    expect(merged.insurance.reviewStatus).toBe('rejected');
    expect(merged.insurance.editable).toBe(true);
    // Nothing on file for this type — the local record is left alone.
    expect(merged.authorization).toBe(local.authorization);
  });

  test('keeps locally held numbers and expiry dates the API does not carry', () => {
    const local = buildInitialDriverDocuments(
      { ...INITIAL_DRIVER_ONBOARDING_FORM, licenseNumber: '1234567890123456', licenseExpiryDate: '01/01/2030' },
      INITIAL_DRIVER_DOCUMENTS,
    );

    const merged = mergeServerDriverDocuments(local, [
      { id: '1', documentType: 'LICENCE_FRONT', fileUrl: 'https://cdn/1.jpg', reviewStatus: 'PENDING', editable: true },
    ]);

    expect(merged.license.documentNumber).toBe('1234567890123456');
    expect(merged.license.expiryDate).toBe('01/01/2030');
  });
});
