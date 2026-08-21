import {
  BackendError,
  ConflictError,
  OfflineError,
  ServerError,
} from '@/data/remote/contracts/backendErrors';
import { isTerminalCustomerLocationError, updateCustomerLocation } from '../customerLocation';

const mockPost = jest.fn();

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    post: (path: string, options?: unknown) => mockPost(path, options),
  }),
}));

beforeEach(() => {
  mockPost.mockReset();
});

describe('updateCustomerLocation', () => {
  test('POSTs lat/lng and maps speed (km/h) + heading onto the backend body', async () => {
    mockPost.mockResolvedValue({ status: 204, data: undefined });

    await updateCustomerLocation('ride-1', { lat: -1.95, lng: 30.05, heading: 90, speed: 12 });

    expect(mockPost).toHaveBeenCalledWith('/v1/rides/ride-1/customer-location', {
      body: { lat: -1.95, lng: 30.05, heading: 90, speed_kmh: 12 },
    });
  });

  test('omits heading/speed when not provided', async () => {
    mockPost.mockResolvedValue({ status: 204, data: undefined });

    await updateCustomerLocation('ride-1', { lat: -1.95, lng: 30.05 });

    expect(mockPost).toHaveBeenCalledWith('/v1/rides/ride-1/customer-location', {
      body: { lat: -1.95, lng: 30.05 },
    });
  });

  test('propagates a backend rejection to the caller instead of swallowing it', async () => {
    const error = new ConflictError({ status: 409 });
    mockPost.mockRejectedValue(error);

    await expect(updateCustomerLocation('ride-1', { lat: 0, lng: 0 })).rejects.toBe(error);
  });
});

describe('isTerminalCustomerLocationError', () => {
  test('is terminal for a 404 (unknown/expired ride)', () => {
    expect(isTerminalCustomerLocationError(new BackendError('backend_unavailable', 'x', { status: 404 }))).toBe(true);
  });

  test('is terminal for a 409 (RIDE_NOT_ACTIVE)', () => {
    expect(isTerminalCustomerLocationError(new ConflictError({ status: 409 }))).toBe(true);
  });

  test('is not terminal for a transient offline/5xx/rate-limit error', () => {
    expect(isTerminalCustomerLocationError(new OfflineError())).toBe(false);
    expect(isTerminalCustomerLocationError(new ServerError({ status: 500 }))).toBe(false);
  });

  test('is not terminal for a non-BackendError (e.g. a plain thrown Error)', () => {
    expect(isTerminalCustomerLocationError(new Error('boom'))).toBe(false);
    expect(isTerminalCustomerLocationError(null)).toBe(false);
  });
});
