import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Ride } from '@/types';
import { rideKeys } from '../keys';
import { useRideDetailQuery, useRideHistoryQuery } from '../hooks/useRideHistoryQuery';

const mockListRideHistory = jest.fn();
const mockGetRideDetail = jest.fn();

jest.mock('@/domains/ride', () => ({
  rideHistoryRepository: {
    listRideHistory: (...args: unknown[]) => mockListRideHistory(...args),
    getRideDetail: (...args: unknown[]) => mockGetRideDetail(...args),
  },
}));

function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 2,
    duration: 10,
    suggestedFare: 10000,
    agreedFare: 9000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:20:00.000Z',
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

describe('ride history query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads ride history through the repository', async () => {
    const ride = createRide();
    mockListRideHistory.mockResolvedValue([ride]);
    const { client, wrapper } = createWrapper();

    const { result } = renderHook(() => useRideHistoryQuery('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toEqual([ride]);
    expect(mockListRideHistory).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(client.getQueryData(rideKeys.history('user-1'))).toEqual([ride]);
  });

  test('loads ride detail through the repository', async () => {
    const ride = createRide({ id: 'ride-detail-1' });
    mockGetRideDetail.mockResolvedValue(ride);
    const { client, wrapper } = createWrapper();

    const { result } = renderHook(() => useRideDetailQuery('ride-detail-1'), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toEqual(ride);
    expect(mockGetRideDetail).toHaveBeenCalledWith('ride-detail-1');
    expect(client.getQueryData(rideKeys.detail('ride-detail-1'))).toEqual(ride);
  });

  test('does not query ride detail without a ride id', () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRideDetailQuery(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetRideDetail).not.toHaveBeenCalled();
  });
});
