import { submitDriverApplicationWithDocuments } from '../driverApplication';
import { applyAsDriver } from '../driverProfile';
import { uploadDriverDocument } from '../driverDocuments';

jest.mock('../driverProfile', () => ({ applyAsDriver: jest.fn() }));
jest.mock('../driverDocuments', () => ({ uploadDriverDocument: jest.fn() }));

const applyMock = applyAsDriver as jest.Mock;
const uploadMock = uploadDriverDocument as jest.Mock;

const application = { vehicleType: 'MOTO_BIKE', vehiclePlate: 'RAB123A' } as never;
const documents = [
  { documentType: 'LICENCE_FRONT' as const, uri: 'file://a.jpg' },
  { documentType: 'NATIONAL_ID_FRONT' as const, uri: 'file://b.jpg' },
];

beforeEach(() => {
  jest.clearAllMocks();
  applyMock.mockResolvedValue(undefined);
  uploadMock.mockResolvedValue('https://cdn.example/documents/x.jpg');
});

describe('submitDriverApplicationWithDocuments', () => {
  test('reports every uploaded document on the happy path', async () => {
    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(result.applicationAccepted).toBe(true);
    expect(result.applicationError).toBeUndefined();
    expect(result.uploaded).toEqual(['LICENCE_FRONT', 'NATIONAL_ID_FRONT']);
    expect(result.failed).toEqual([]);
  });

  // The original bug: a failed upload was caught and dropped, so onboarding
  // showed the success screen while the admin panel had nothing to review.
  test('reports failed uploads instead of swallowing them', async () => {
    uploadMock
      .mockRejectedValueOnce(Object.assign(new Error('upload failed with status 401'), { status: 401 }))
      .mockResolvedValueOnce('https://cdn.example/documents/b.jpg');

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(result.uploaded).toEqual(['NATIONAL_ID_FRONT']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].documentType).toBe('LICENCE_FRONT');
    expect(result.failed[0].error.message).toContain('401');
  });

  test('still attempts later documents after an earlier one fails', async () => {
    uploadMock.mockRejectedValue(new Error('storage down'));

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(result.failed).toHaveLength(2);
    expect(result.uploaded).toEqual([]);
  });

  test('a failed application aborts before uploading and is reported', async () => {
    applyMock.mockRejectedValue(new Error('validation exploded'));

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(result.applicationAccepted).toBe(false);
    expect(result.applicationError?.message).toBe('validation exploded');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  // A re-submitting driver 409s on apply, but their driver record already
  // exists — the documents must still attach to it. Treating 409 as fatal is
  // how a second application ended up with zero documents.
  test('a 409 already-applied continues to the document uploads', async () => {
    applyMock.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));

    const result = await submitDriverApplicationWithDocuments(application, documents);

    expect(result.applicationAccepted).toBe(true);
    expect(result.applicationError).toBeUndefined();
    expect(result.uploaded).toEqual(['LICENCE_FRONT', 'NATIONAL_ID_FRONT']);
  });
});
