import { buildPendingDriverProfile } from '@/hooks/driver-onboarding/onboardingSubmission';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM, type DocFaces } from '@/hooks/driver-onboarding/onboardingTypes';
import type { DriverApplicationSubmission, DriverProfile, DriverVehicleDocumentSet, DriverVehicleProfile } from '@/types';
import {
  applyVerificationDecision,
  buildDriverApplicationSubmissionPayload,
  buildVehicleApplicationSubmissionPayload,
  buildVehicleDocumentUpdateSubmissionPayload,
  submitDriverApplication,
  submitVehicleApplication,
  submitVehicleDocumentUpdate,
} from '../verificationSubmissions';

let mockStore = {
  driverApplications: [] as DriverApplicationSubmission[],
  vehicleApplications: [] as any[],
  vehicleDocumentUpdates: [] as any[],
};

jest.mock('@/persistence/verificationSubmissionPersistence', () => ({
  EMPTY_VERIFICATION_SUBMISSION_STORE: {
    driverApplications: [],
    vehicleApplications: [],
    vehicleDocumentUpdates: [],
  },
  __setMockVerificationSubmissionStore: (store: typeof mockStore) => {
    mockStore = store;
  },
  loadStoredVerificationSubmissions: jest.fn(async () => ({ data: mockStore, source: 'current' })),
  saveStoredVerificationSubmissions: jest.fn(async (store: typeof mockStore) => {
    mockStore = store;
  }),
}));

function makeDriverProfile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    ...buildPendingDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      dob: '01/01/1990',
      vehicleType: 'cab',
      plateNumber: 'rac 002 a',
      licenseNumber: '1234567890123456',
      nationalId: '1990010112345678',
      momoCode: '0788000000',
      merchantCode: 'abc123',
    }, 'selfie://photo'),
    verificationStatus: 'pending_review',
    ...overrides,
  };
}

function makeDocuments(): DriverVehicleDocumentSet {
  return {
    license: { key: 'license', faces: ['license-front://photo', 'license-back://photo'], reviewStatus: 'pending_review', submissionKind: 'initial', submittedAt: '2026-06-18T08:00:00.000Z', updatedAt: '2026-06-18T08:00:00.000Z' },
    nationalId: { key: 'nationalId', faces: ['national-front://photo', 'national-back://photo'], reviewStatus: 'pending_review', submissionKind: 'initial', submittedAt: '2026-06-18T08:00:00.000Z', updatedAt: '2026-06-18T08:00:00.000Z' },
    insurance: { key: 'insurance', faces: ['insurance-front://photo', null], reviewStatus: 'pending_review', submissionKind: 'initial', submittedAt: '2026-06-18T08:00:00.000Z', updatedAt: '2026-06-18T08:00:00.000Z' },
    authorization: { key: 'authorization', faces: ['authorization-front://photo', null], reviewStatus: 'pending_review', submissionKind: 'initial', submittedAt: '2026-06-18T08:00:00.000Z', updatedAt: '2026-06-18T08:00:00.000Z' },
  };
}

function makeVehicle(overrides: Partial<DriverVehicleProfile> = {}): DriverVehicleProfile {
  return {
    id: 'driver-vehicle:cab:rac-002-a',
    vehicleType: 'cab',
    status: 'approved',
    plateNumber: 'RAC 002 A',
    licenseNumber: '1234567890123456',
    brand: 'Toyota',
    model: 'Corolla',
    manufactureYear: 2020,
    documents: makeDocuments(),
    submittedAt: '2026-06-18T08:00:00.000Z',
    approvedAt: '2026-06-18T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockStore = {
    driverApplications: [],
    vehicleApplications: [],
    vehicleDocumentUpdates: [],
  };
  const persistence = require('@/persistence/verificationSubmissionPersistence');
  persistence.__setMockVerificationSubmissionStore(mockStore);
  persistence.loadStoredVerificationSubmissions.mockClear();
  persistence.saveStoredVerificationSubmissions.mockClear();
});

describe('verification submissions', () => {
  test('driver application creates a pending review submission with required payload', async () => {
    const profile = makeDriverProfile();
    const submission = await submitDriverApplication({
      userId: 'user-1',
      fullName: 'Driver One',
      phone: '250788000000',
      driverProfile: profile,
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        brand: 'Toyota',
        model: 'Corolla',
        manufactureYear: '2020',
        dob: '01/01/1990',
        vehicleType: 'cab',
        plateNumber: 'rac 002 a',
        licenseNumber: '1234567890123456',
        nationalId: '1990010112345678',
        momoCode: '0788000000',
        merchantCode: 'abc123',
      },
      docs: {
        license: ['license-front://photo', 'license-back://photo'],
        nationalId: ['national-front://photo', 'national-back://photo'],
        insurance: ['insurance-front://photo', null],
        authorization: ['authorization-front://photo', null],
      },
      vehiclePhotos: { outside: 'outside://photo', inside: 'inside://photo' },
      selfieUri: 'selfie://photo',
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'driver-submission:1',
    });

    expect(submission.kind).toBe('driver_application');
    expect(submission.status).toBe('pending_review');
    expect(submission.selfieImage).toBe('selfie://photo');
    expect(submission.firstVehicle).toMatchObject({
      brand: 'Toyota',
      model: 'Corolla',
      manufactureYear: 2020,
    });
    expect(submission.photos).toEqual({ outside: 'outside://photo', inside: 'inside://photo' });
    expect(submission.documents.license.faces[0]).toBe('license-front://photo');
    const persistence = require('@/persistence/verificationSubmissionPersistence');
    expect(persistence.saveStoredVerificationSubmissions).toHaveBeenCalled();
  });

  test('rejects driver applications from applicants younger than 18', async () => {
    await expect(submitDriverApplication({
      userId: 'user-1',
      fullName: 'Driver One',
      phone: '250788000000',
      driverProfile: makeDriverProfile(),
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        dob: '31/12/2099',
      },
      docs: {
        license: ['license-front://photo', 'license-back://photo'],
        nationalId: ['national-front://photo', 'national-back://photo'],
        insurance: ['insurance-front://photo', null],
        authorization: ['authorization-front://photo', null],
      },
      selfieUri: 'selfie://photo',
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'driver-submission:underage',
    })).rejects.toThrow('Driver applicants must be at least 18 years old.');
  });

  test('rejected driver application can be resubmitted', async () => {
    const submission = await submitDriverApplication({
      userId: 'user-1',
      fullName: 'Driver One',
      phone: '250788000000',
      driverProfile: makeDriverProfile({ verificationStatus: 'rejected', rejectionReason: 'Update required' }),
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        brand: 'Toyota',
        model: 'Corolla',
        manufactureYear: '2020',
        dob: '01/01/1990',
      },
      docs: {
        license: ['license-front://photo', 'license-back://photo'],
        nationalId: ['national-front://photo', 'national-back://photo'],
        insurance: ['insurance-front://photo', null],
        authorization: ['authorization-front://photo', null],
      },
      vehiclePhotos: { outside: 'outside://photo', inside: 'inside://photo' },
      selfieUri: 'selfie://photo',
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'driver-submission:2',
    });

    expect(submission.status).toBe('resubmitted');
    expect(submission.history.some(entry => entry.type === 'resubmitted')).toBe(true);
  });

  test('approved review decision is only applied explicitly', async () => {
    const submission = await submitDriverApplication({
      userId: 'user-1',
      fullName: 'Driver One',
      phone: '250788000000',
      driverProfile: makeDriverProfile(),
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        brand: 'Toyota',
        model: 'Corolla',
        manufactureYear: '2020',
        dob: '01/01/1990',
      },
      docs: {
        license: ['license-front://photo', 'license-back://photo'],
        nationalId: ['national-front://photo', 'national-back://photo'],
        insurance: ['insurance-front://photo', null],
        authorization: ['authorization-front://photo', null],
      },
      vehiclePhotos: { outside: 'outside://photo', inside: 'inside://photo' },
      selfieUri: 'selfie://photo',
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'driver-submission:3',
    });
    expect(submission.status).toBe('pending_review');

    const approved = await applyVerificationDecision(submission, {
      status: 'approved',
      reviewedAt: '2026-06-18T09:00:00.000Z',
      reviewedBy: 'agent-1',
    });
    expect(approved.status).toBe('approved');
    expect(approved.reviewDecision?.reviewedBy).toBe('agent-1');
  });

  test('vehicle application creates a pending review submission and resubmits rejected vehicles', async () => {
    const submission = await submitVehicleApplication({
      userId: 'user-1',
      driverProfile: makeDriverProfile({ verificationStatus: 'approved', isVerified: true }),
      vehicle: makeVehicle(),
      docs: makeDocuments(),
      photos: { outside: 'outside://photo', inside: 'inside://photo' },
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'vehicle-submission:1',
    });
    expect(submission.kind).toBe('vehicle_application');
    expect(submission.status).toBe('pending_review');
    expect(submission.documents.authorization.faces[0]).toBe('authorization-front://photo');

    const resubmitted = await submitVehicleApplication({
      userId: 'user-1',
      driverProfile: makeDriverProfile({ verificationStatus: 'approved', isVerified: true }),
      vehicle: makeVehicle({ status: 'rejected', rejectedAt: '2026-06-17T09:00:00.000Z' }),
      sourceVehicleStatus: 'rejected',
      docs: makeDocuments(),
      photos: { outside: 'outside://photo', inside: 'inside://photo' },
      submittedAt: '2026-06-18T08:05:00.000Z',
      clientSubmissionId: 'vehicle-submission:2',
    });
    expect(resubmitted.status).toBe('resubmitted');
  });

  test('vehicle document update creates a review submission and keeps previous metadata', async () => {
    const submission = await submitVehicleDocumentUpdate({
      userId: 'user-1',
      driverProfile: makeDriverProfile({ verificationStatus: 'approved', isVerified: true }),
      vehicle: makeVehicle(),
      documents: makeDocuments(),
      photos: { outside: 'outside://photo', inside: 'inside://photo' },
      submittedAt: '2026-06-18T08:10:00.000Z',
      clientSubmissionId: 'vehicle-update:1',
    });

    expect(submission.kind).toBe('vehicle_document_update');
    expect(submission.status).toBe('pending_review');
    expect(submission.previousDocumentMetadata?.documents?.license.faces[0]).toBe('license-front://photo');
  });

  test('duplicate clientSubmissionId does not create duplicate submissions', async () => {
    const input = {
      userId: 'user-1',
      driverProfile: makeDriverProfile({ verificationStatus: 'approved', isVerified: true }),
      vehicle: makeVehicle(),
      docs: makeDocuments(),
      photos: { outside: 'outside://photo', inside: 'inside://photo' },
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'vehicle-submission:duplicate',
    };
    const first = await submitVehicleApplication(input);
    const second = await submitVehicleApplication(input);

    expect(first.clientSubmissionId).toBe(second.clientSubmissionId);
    expect(mockStore.vehicleApplications).toHaveLength(1);
  });

  test('payload builder exposes required docs and photos for backend handoff', () => {
    const payload = buildVehicleDocumentUpdateSubmissionPayload({
      userId: 'user-1',
      driverProfile: makeDriverProfile({ verificationStatus: 'approved', isVerified: true }),
      vehicle: makeVehicle(),
      documents: makeDocuments(),
      photos: { outside: 'outside://photo', inside: 'inside://photo' },
      submittedAt: '2026-06-18T08:10:00.000Z',
      clientSubmissionId: 'vehicle-update:payload',
    });

    expect(payload.documents.license.faces[1]).toBe('license-back://photo');
    expect(payload.photos?.outside).toBe('outside://photo');
  });

  test('driver payload builder exposes all required first-vehicle fields', () => {
    const payload = buildDriverApplicationSubmissionPayload({
      userId: 'user-1',
      fullName: 'Driver One',
      phone: '250788000000',
      driverProfile: makeDriverProfile(),
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        dob: '01/01/1990',
        vehicleType: 'cab',
        plateNumber: 'rac 002 a',
        licenseNumber: '1234567890123456',
        nationalId: '1990010112345678',
        momoCode: '0788000000',
        merchantCode: 'abc123',
      },
      docs: {
        license: ['license-front://photo', 'license-back://photo'],
        nationalId: ['national-front://photo', 'national-back://photo'],
        insurance: ['insurance-front://photo', null],
        authorization: ['authorization-front://photo', null],
      },
      selfieUri: 'selfie://photo',
      submittedAt: '2026-06-18T08:00:00.000Z',
      clientSubmissionId: 'driver-payload:1',
    });

    expect(payload.firstVehicle.plateNumber).toBe('RAC 002 A');
    expect(payload.documents.authorization.faces[0]).toBe('authorization-front://photo');
  });
});
