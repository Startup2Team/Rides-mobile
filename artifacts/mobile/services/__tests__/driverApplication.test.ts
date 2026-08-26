import { submitDriverApplicationWithDocuments, type DriverApplicationDocument } from '@/services/driverApplication';
import { acceptDriverPolicy, applyAsDriver, type DriverApplicationInput } from '@/services/driverProfile';
import { uploadDriverDocument } from '@/services/driverDocuments';
import { updateProfile } from '@/services/profile';
import { reportOperationalFailure } from '@/observability/monitoring';

// This is the resubmission path: POST /driver/apply then upload every KYC
// document. A rejected/needs-more-info driver only moves back to
// PENDING_REVIEW on the backend when applyAsDriver actually succeeds, so the
// regression this guards against is the app faking success or swallowing a
// failure here (see app/driver-onboarding.tsx saveAndContinue).

jest.mock('@/services/driverProfile', () => ({
  applyAsDriver: jest.fn(),
  acceptDriverPolicy: jest.fn(),
}));

jest.mock('@/services/driverDocuments', () => ({
  uploadDriverDocument: jest.fn(),
}));

jest.mock('@/services/profile', () => ({
  updateProfile: jest.fn(),
}));

jest.mock('@/observability/monitoring', () => ({
  reportOperationalFailure: jest.fn(),
}));

const mockedApply = applyAsDriver as jest.MockedFunction<typeof applyAsDriver>;
const mockedAcceptPolicy = acceptDriverPolicy as jest.MockedFunction<typeof acceptDriverPolicy>;
const mockedUpload = uploadDriverDocument as jest.MockedFunction<typeof uploadDriverDocument>;
const mockedUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;
const mockedReportFailure = reportOperationalFailure as jest.MockedFunction<typeof reportOperationalFailure>;

const application: DriverApplicationInput = {
  vehicleType: 'moto',
  vehiclePlate: 'RAD 123 A',
  licenseNumber: '1234567890123456',
  dateOfBirth: '1990-01-01',
  city: 'Kigali',
  momoPayCode: '+250788111000',
  momoProvider: 'mtn',
  province: 'City of Kigali',
  district: 'Gasabo',
  sector: 'Kacyiru',
  cell: 'Cell A',
  village: 'Village B',
  nationalIdNumber: '1199080012345678',
  nationalIdCountry: 'RW',
};

const documents: DriverApplicationDocument[] = [
  { documentType: 'LICENCE_FRONT', uri: 'file://license-front.jpg' },
  { documentType: 'NATIONAL_ID_FRONT', uri: 'file://national-id-front.jpg' },
  { documentType: 'SELFIE', uri: 'file://selfie.jpg' },
];

describe('submitDriverApplicationWithDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAcceptPolicy.mockResolvedValue(undefined);
    mockedUpdateProfile.mockResolvedValue(undefined as never);
  });

  test('propagates the apply failure instead of swallowing it, and never uploads documents', async () => {
    const applyError = new Error('network unreachable');
    mockedApply.mockRejectedValue(applyError);

    await expect(submitDriverApplicationWithDocuments(application, documents)).rejects.toBe(applyError);

    // Resubmission from REJECTED/NEEDS_MORE_INFO only reaches the backend if
    // apply succeeds — a failure here must stop the flow, not be reported as
    // a successful upload batch.
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  test('reports success and uploads every document when apply succeeds', async () => {
    mockedApply.mockResolvedValue(undefined);
    mockedUpload.mockImplementation(async (_uri, documentType) => `https://cdn.test/${documentType}.jpg`);

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(mockedApply).toHaveBeenCalledWith(application);
    expect(mockedUpload).toHaveBeenCalledTimes(3);
    expect(result.allDocumentsUploaded).toBe(true);
    expect(result.documentResults).toEqual(
      expect.arrayContaining([
        { documentType: 'LICENCE_FRONT', ok: true },
        { documentType: 'NATIONAL_ID_FRONT', ok: true },
        { documentType: 'SELFIE', ok: true },
      ]),
    );
    // The selfie doubles as the account photo once it's actually stored.
    expect(mockedUpdateProfile).toHaveBeenCalledWith({ profileImageUrl: 'https://cdn.test/SELFIE.jpg' });
  });

  test('surfaces a partial document failure instead of reporting full success', async () => {
    mockedApply.mockResolvedValue(undefined);
    const uploadError = new Error('upload failed with status 500');
    mockedUpload.mockImplementation(async (_uri, documentType) => {
      if (documentType === 'NATIONAL_ID_FRONT') throw uploadError;
      return `https://cdn.test/${documentType}.jpg`;
    });

    const result = await submitDriverApplicationWithDocuments(application, documents);

    // The application itself was created (apply succeeded) but the caller
    // must be able to tell this wasn't a full, clean submission.
    expect(result.allDocumentsUploaded).toBe(false);
    expect(result.documentResults).toEqual(
      expect.arrayContaining([
        { documentType: 'LICENCE_FRONT', ok: true },
        { documentType: 'NATIONAL_ID_FRONT', ok: false, error: uploadError },
        { documentType: 'SELFIE', ok: true },
      ]),
    );
    expect(mockedReportFailure).toHaveBeenCalledWith(
      'driver.documents.upload',
      uploadError,
      { documentType: 'NATIONAL_ID_FRONT' },
    );
  });

  test('a failed policy acceptance is best-effort and does not block the submission', async () => {
    mockedApply.mockResolvedValue(undefined);
    mockedAcceptPolicy.mockRejectedValue(new Error('policy endpoint down'));
    mockedUpload.mockResolvedValue('https://cdn.test/doc.jpg');

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(result.allDocumentsUploaded).toBe(true);
    expect(mockedReportFailure).toHaveBeenCalledWith('driver.policy.accept', expect.any(Error));
  });
});
