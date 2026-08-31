import { createRide } from '../rides';

const mockCalls: Array<{ method: string; path: string; options?: any }> = [];
let mockNextResponse: any = { data: { data: {} } };

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    post: (path: string, options?: any) => {
      mockCalls.push({ method: 'POST', path, options });
      return Promise.resolve(mockNextResponse);
    },
  }),
}));

beforeEach(() => { mockCalls.length = 0; });

const baseInput = {
  vehicleType: 'moto' as const,
  pickup: { lat: -1.95, lng: 30.05, address: 'Kimironko' },
  destination: { lat: -1.96, lng: 30.08, address: 'Downtown' },
};

describe('createRide (real backend contract)', () => {
  it('sends the ride creation payload with backend transport code', async () => {
    mockNextResponse = { data: { data: { ride_id: 'r1', status: 'searching' } } };
    await createRide(baseInput);
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/customer/rides' });
    expect(mockCalls[0].options.body).toMatchObject({
      pickup_lat: -1.95, pickup_lng: 30.05, dest_lat: -1.96, dest_lng: 30.08,
      transport_type: 'MOTO_BIKE',
    });
  });

  it('when route_* fields are absent, route results fall back to null (pre-OSRM / OSRM-disabled contract)', async () => {
    mockNextResponse = { data: { data: { ride_id: 'r1', status: 'searching' } } };
    const result = await createRide(baseInput);
    expect(result).toEqual({
      rideId: 'r1',
      status: 'searching',
      giveUpSeconds: null,
      searchDeadlineAt: null,
      routeDistanceKm: null,
      routeDurationMinutes: null,
      routeDurationSeconds: null,
      routeCoordinates: null,
    });
  });

  it('when route_* fields are present, decodes route_geometry and carries the OSRM numbers', async () => {
    mockNextResponse = {
      data: {
        data: {
          ride_id: 'r1',
          status: 'searching',
          give_up_seconds: 90,
          search_deadline_at: '2026-08-30T12:00:00Z',
          route_distance_km: 4.2,
          route_duration_minutes: 13,
          route_duration_seconds: 780,
          // Encoded (precision 5) form of [[-1.95,30.05],[-1.955,30.06],[-1.96,30.08]].
          route_geometry: 'nz{JoclvDf^o}@f^_|B',
        },
      },
    };
    const result = await createRide(baseInput);
    expect(result.giveUpSeconds).toBe(90);
    expect(result.searchDeadlineAt).toBe('2026-08-30T12:00:00Z');
    expect(result.routeDistanceKm).toBe(4.2);
    expect(result.routeDurationMinutes).toBe(13);
    expect(result.routeDurationSeconds).toBe(780);
    expect(result.routeCoordinates).toEqual([
      { latitude: -1.95, longitude: 30.05 },
      { latitude: -1.955, longitude: 30.06 },
      { latitude: -1.96, longitude: 30.08 },
    ]);
  });
});
