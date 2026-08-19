import { applyAsDriver, type DriverApplicationInput } from '@/services/driverProfile';
import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: jest.fn(),
}));

const mockedClient = getAppBackendClient as jest.MockedFunction<typeof getAppBackendClient>;

function stubClient() {
  const post = jest.fn().mockResolvedValue({ data: null });
  mockedClient.mockReturnValue({ post } as unknown as ReturnType<typeof getAppBackendClient>);
  return { post };
}

const baseInput: DriverApplicationInput = {
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

describe('applyAsDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // DB-1 / FEAT-onboarding-fields: the onboarding form always captured this
  // number, but it was never sent — every driver application 400s once the
  // backend flips NATIONAL_ID_REQUIRED unless the wire carries it.
  test('sends national_id_number and national_id_country in the apply body', async () => {
    const { post } = stubClient();

    await applyAsDriver(baseInput);

    expect(post).toHaveBeenCalledWith('/v1/driver/apply', {
      body: expect.objectContaining({
        national_id_number: '1199080012345678',
        national_id_country: 'RW',
      }),
    });
  });

  test('sends a UG national ID unmodified (alphanumeric, not digit-stripped)', async () => {
    const { post } = stubClient();

    await applyAsDriver({ ...baseInput, nationalIdNumber: 'CM12345678901A', nationalIdCountry: 'UG' });

    expect(post).toHaveBeenCalledWith('/v1/driver/apply', {
      body: expect.objectContaining({
        national_id_number: 'CM12345678901A',
        national_id_country: 'UG',
      }),
    });
  });

  test('still sends every other required field alongside the national ID', async () => {
    const { post } = stubClient();

    await applyAsDriver(baseInput);

    expect(post).toHaveBeenCalledWith('/v1/driver/apply', {
      body: expect.objectContaining({
        transport_type: expect.any(String),
        vehicle_plate: 'RAD 123 A',
        license_number: '1234567890123456',
        date_of_birth: '1990-01-01',
        province: 'City of Kigali',
        district: 'Gasabo',
        sector: 'Kacyiru',
        cell: 'Cell A',
        village: 'Village B',
      }),
    });
  });
});
