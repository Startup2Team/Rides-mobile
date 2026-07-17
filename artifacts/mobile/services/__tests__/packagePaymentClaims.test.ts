import { backendPackagePaymentRepository } from '../packagePaymentClaims';

const mockCalls: Array<{ method: string; path: string; options?: any }> = [];
let mockNextResponse: any = { data: { data: {} } };
let mockNextError: any = null;

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    get: (path: string, options?: any) => { mockCalls.push({ method: 'GET', path, options }); return mockNextError ? Promise.reject(mockNextError) : Promise.resolve(mockNextResponse); },
    post: (path: string, options?: any) => { mockCalls.push({ method: 'POST', path, options }); return mockNextError ? Promise.reject(mockNextError) : Promise.resolve(mockNextResponse); },
  }),
}));

const CLAIM_DTO = {
  id: 'c1', version: 1, driver_id: 'd1', vehicle_id: 'v1', vehicle_type: 'MOTO_BIKE',
  offer_id: 'o1', package_id: 'p1', package_version: 'pv1', package_name: 'Starter',
  expected_amount_rwf: 2000, provider: 'mtn', merchant_code_snapshot: '123456',
  payer_phone_number: '+250788', status: 'submitted', created_at: '2026-07-15T00:00:00Z',
  expires_at: '2026-07-15T02:00:00Z', idempotency_key: 'k1',
  audit_log: [{ id: 'a1', at: '2026-07-15T00:00:00Z', actor_type: 'driver', action: 'claim_created' }],
};

beforeEach(() => { mockCalls.length = 0; mockNextError = null; });

describe('backendPackagePaymentRepository (real backend contract)', () => {
  test('list maps snake_case claim → domain (incl. vehicleType code, auditLog)', async () => {
    mockNextResponse = { data: { data: { items: [CLAIM_DTO], next_cursor: null } } };
    const out = await backendPackagePaymentRepository.listDriverManualPaymentClaims('d1');
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/package-payments/manual-claims' });
    expect(out.failure).toBeNull();
    expect(out.data?.[0]).toMatchObject({
      id: 'c1', driverId: 'd1', vehicleType: 'moto', expectedAmountRwf: 2000,
      provider: 'mtn', status: 'submitted', idempotencyKey: 'k1',
    });
    expect(out.data?.[0].auditLog[0]).toMatchObject({ actorType: 'driver', action: 'claim_created' });
  });

  test('create sends snake_case body from the offer snapshot', async () => {
    mockNextResponse = { data: { data: { claim: CLAIM_DTO } } };
    await backendPackagePaymentRepository.createManualPaymentClaim({
      driverId: 'd1', provider: 'mtn', payerPhoneNumber: '+250788',
      offer: {
        offerId: 'o1', packageId: 'p1' as any, packageVersion: 'pv1', packageName: 'Starter',
        vehicleId: 'v1', vehicleType: 'moto', priceRwf: 2000, ridesGranted: 30, bonusRidesGranted: 5,
        quoteAuthority: 'backend' as any, createdAt: 'x', expiresAt: 'y', source: 'catalog' as any,
      },
    });
    expect(mockCalls[0].path).toBe('/v1/package-payments/manual-claims');
    expect(mockCalls[0].options.body).toMatchObject({
      driver_id: 'd1', vehicle_id: 'v1', offer_id: 'o1', package_id: 'p1',
      expected_amount_rwf: 2000, provider: 'mtn', payer_phone_number: '+250788',
    });
    expect(typeof mockCalls[0].options.body.idempotency_key).toBe('string');
  });

  test('maps a 404 error to a claim_not_found failure (never throws)', async () => {
    mockNextError = Object.assign(new Error('not found'), { status: 404 });
    const out = await backendPackagePaymentRepository.getManualPaymentClaim('missing');
    expect(out.data).toBeNull();
    expect(out.failure?.code).toBe('claim_not_found');
  });
});
