import * as paymentMethods from '../paymentMethods';

const mockCalls: Array<{ method: string; path: string; options?: any }> = [];
let mockNextResponse: any = { data: { data: {} } };

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    get: (path: string, options?: any) => { mockCalls.push({ method: 'GET', path, options }); return Promise.resolve(mockNextResponse); },
    post: (path: string, options?: any) => { mockCalls.push({ method: 'POST', path, options }); return Promise.resolve(mockNextResponse); },
    patch: (path: string, options?: any) => { mockCalls.push({ method: 'PATCH', path, options }); return Promise.resolve(mockNextResponse); },
    delete: (path: string, options?: any) => { mockCalls.push({ method: 'DELETE', path, options }); return Promise.resolve(mockNextResponse); },
  }),
}));

beforeEach(() => { mockCalls.length = 0; });

describe('paymentMethods service (real backend contract)', () => {
  test('list maps snake_case items to domain PaymentMethod', async () => {
    mockNextResponse = { data: { data: { items: [
      { id: 'm1', provider: 'mtn', label: 'MTN', phone_number: '+250788', is_default: true },
    ] } } };
    const result = await paymentMethods.listPaymentMethods();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/payments/methods' });
    expect(result).toEqual([{ id: 'm1', provider: 'mtn', label: 'MTN', phoneNumber: '+250788', isDefault: true }]);
  });

  test('add sends snake_case body incl. idempotency_key', async () => {
    mockNextResponse = { data: { data: { items: [] } } };
    await paymentMethods.addPaymentMethod({ id: 'x', provider: 'airtel', label: 'Airtel', phoneNumber: '+2507', isDefault: true });
    expect(mockCalls[0].path).toBe('/v1/payments/methods');
    expect(mockCalls[0].options.body).toMatchObject({
      provider: 'airtel', label: 'Airtel', phone_number: '+2507', is_default: true,
    });
    expect(typeof mockCalls[0].options.body.idempotency_key).toBe('string');
  });

  test('setDefault hits the /default path', async () => {
    mockNextResponse = { data: { data: { items: [] } } };
    await paymentMethods.setDefaultPaymentMethod('m9');
    expect(mockCalls[0]).toMatchObject({ method: 'PATCH', path: '/v1/payments/methods/m9/default' });
  });
});
