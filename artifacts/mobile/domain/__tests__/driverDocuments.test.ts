import {
  DOCUMENTS_REQUIRING_BACK,
  buildDriverDocumentsFromProfile,
  buildInitialDriverDocuments,
  getDriverDocumentDisplayStatus,
  reconcileDriverDocumentsWithProfile,
} from '../driverDocuments';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM } from '@/hooks/driver-onboarding/onboardingTypes';
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
});
