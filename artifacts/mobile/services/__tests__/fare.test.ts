import { estimateFare } from '../fare';

const mockCalls: Array<{ method: string; path: string; options?: any }> = [];
let mockNextResponse: any = { data: { data: {} } };

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    get: (path: string, options?: any) => {
      mockCalls.push({ method: 'GET', path, options });
      return Promise.resolve(mockNextResponse);
    },
  }),
}));

beforeEach(() => { mockCalls.length = 0; });

const baseInput = {
  vehicleType: 'moto' as const,
  pickupLat: -1.95,
  pickupLng: 30.05,
  destLat: -1.96,
  destLng: 30.08,
};

const baseDto = {
  transport_type: 'MOTO_BIKE',
  distance_km: 4.2,
  duration_minutes: 13,
  breakdown: {
    base_fare_rwf: 500,
    distance_charge_rwf: 1000,
    night_surcharge_rwf: 0,
    total_fare_rwf: 1500,
    night_surcharge_applied: false,
  },
  min_fare_rwf: 800,
  cancellation_fee_rwf: 300,
  note: 'Estimate only',
};

describe('estimateFare (real backend contract)', () => {
  it('sends the backend transport code and query params', async () => {
    mockNextResponse = { data: { data: baseDto } };
    await estimateFare(baseInput);
    expect(mockCalls[0]).toMatchObject({
      method: 'GET',
      path: '/v1/customer/fare-estimate',
      options: { query: {
        transport_type: 'MOTO_BIKE', pickup_lat: -1.95, pickup_lng: 30.05, dest_lat: -1.96, dest_lng: 30.08,
      } },
    });
  });

  it('when OSRM route fields are absent, routeDurationSeconds/routeCoordinates fall back to null', async () => {
    mockNextResponse = { data: { data: baseDto } };
    const result = await estimateFare(baseInput);
    expect(result.distanceKm).toBe(4.2);
    expect(result.durationMinutes).toBe(13);
    expect(result.routeDurationSeconds).toBeNull();
    expect(result.routeCoordinates).toBeNull();
  });

  it('when OSRM route fields are present, decodes route_geometry and carries route_duration_seconds', async () => {
    mockNextResponse = {
      data: {
        data: {
          ...baseDto,
          route_duration_seconds: 780,
          // Encoded (precision 5) form of [[-1.95,30.05],[-1.955,30.06],[-1.96,30.08]].
          route_geometry: 'nz{JoclvDf^o}@f^_|B',
        },
      },
    };
    const result = await estimateFare(baseInput);
    expect(result.routeDurationSeconds).toBe(780);
    expect(result.routeCoordinates).toEqual([
      { latitude: -1.95, longitude: 30.05 },
      { latitude: -1.955, longitude: 30.06 },
      { latitude: -1.96, longitude: 30.08 },
    ]);
  });
});
