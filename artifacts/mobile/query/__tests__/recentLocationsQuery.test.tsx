import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { RecentLocation } from '@/services/locations';
import {
  useDeleteRecentLocationMutation,
  useRecentLocationsQuery,
  useRecordRecentLocationMutation,
} from '../hooks/useRecentLocationsQuery';
import { locationKeys } from '../keys';

const mockListRecentLocations = jest.fn();
const mockRecordRecentLocation = jest.fn();
const mockDeleteRecentLocation = jest.fn();

jest.mock('@/services/locations', () => ({
  listRecentLocations: (...args: unknown[]) => mockListRecentLocations(...args),
  recordRecentLocation: (...args: unknown[]) => mockRecordRecentLocation(...args),
  deleteRecentLocation: (...args: unknown[]) => mockDeleteRecentLocation(...args),
}));

let mockUser: { id: string } | null = { id: 'user-1' };
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

function recent(overrides: Partial<RecentLocation> = {}): RecentLocation {
  return {
    id: 'recent-1',
    address: 'Kimironko Market',
    latitude: -1.95,
    longitude: 30.12,
    useCount: 2,
    lastUsedAt: '2026-08-01T10:00:00Z',
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

describe('recent locations query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1' };
  });

  test('loads the signed-in rider recents', async () => {
    mockListRecentLocations.mockResolvedValue([recent()]);
    const { wrapper, client } = createWrapper();

    const { result } = renderHook(() => useRecentLocationsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(client.getQueryData(locationKeys.recent())).toHaveLength(1);
  });

  test('stays idle for a signed-out rider', () => {
    mockUser = null;
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecentLocationsQuery(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListRecentLocations).not.toHaveBeenCalled();
  });

  test('optimistically prepends a recorded destination and invalidates suggestions', async () => {
    mockRecordRecentLocation.mockResolvedValue(undefined);
    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useRecordRecentLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ address: 'Nyabugogo', latitude: -1.94, longitude: 30.04 });
    });

    const cached = client.getQueryData<RecentLocation[]>(locationKeys.recent()) ?? [];
    expect(cached[0]).toMatchObject({ address: 'Nyabugogo', useCount: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: locationKeys.suggestions() });
  });

  test('re-picking an address bumps the existing entry instead of duplicating it', async () => {
    mockListRecentLocations.mockResolvedValue([recent()]);
    mockRecordRecentLocation.mockResolvedValue(undefined);
    const { wrapper, client } = createWrapper();

    const listHook = renderHook(() => useRecentLocationsQuery(), { wrapper });
    await waitFor(() => expect(listHook.result.current.isFetched).toBe(true));
    // Hold the settle refetch back so the optimistic state is what we assert on.
    jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useRecordRecentLocationMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ address: 'kimironko market', latitude: -1.95, longitude: 30.12 });
    });

    const cached = client.getQueryData<RecentLocation[]>(locationKeys.recent()) ?? [];
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ id: 'recent-1', useCount: 3 });
  });

  test('rolls the optimistic delete back when the server rejects it', async () => {
    mockListRecentLocations.mockResolvedValue([recent()]);
    mockDeleteRecentLocation.mockRejectedValue(new Error('gone'));
    const { wrapper, client } = createWrapper();

    const listHook = renderHook(() => useRecentLocationsQuery(), { wrapper });
    await waitFor(() => expect(listHook.result.current.isFetched).toBe(true));

    const { result } = renderHook(() => useDeleteRecentLocationMutation(), { wrapper });
    await expect(result.current.mutateAsync('recent-1')).rejects.toThrow('gone');

    const cached = client.getQueryData<RecentLocation[]>(locationKeys.recent()) ?? [];
    expect(cached).toHaveLength(1);
    expect(mockDeleteRecentLocation).toHaveBeenCalledWith('recent-1');
  });
});
