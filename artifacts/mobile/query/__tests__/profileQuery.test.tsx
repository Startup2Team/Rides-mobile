import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { profileKeys } from '../keys';
import {
  useProfilePhotoQuery,
  useProfileQuery,
  useUpdatePhoneMutation,
  useUpdateProfileMutation,
  useUpdateProfilePhotoMutation,
} from '../hooks/useProfileQuery';
import { authRepository } from '@/data/repositories/authRepository';
import { profileRepository } from '@/domains/profile/repository';
import type { User } from '@/types';

const mockGetCurrentUser = jest.fn();
const mockSaveCurrentUser = jest.fn();
const mockGetProfileImage = jest.fn();
const mockSaveProfileImage = jest.fn();
const mockRemoveProfileImage = jest.fn();
let currentUserState: User | null = null;
let profileImageState: string | null = null;

jest.mock('@/data/repositories/authRepository', () => ({
  authRepository: {
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
    saveCurrentUser: (...args: unknown[]) => mockSaveCurrentUser(...args),
    getDriverProfile: jest.fn(),
    saveDriverProfile: jest.fn(),
    clearSession: jest.fn(),
  },
}));

jest.mock('@/domains/profile/repository', () => ({
  profileRepository: {
    getProfileImage: (...args: unknown[]) => mockGetProfileImage(...args),
    saveProfileImage: (...args: unknown[]) => mockSaveProfileImage(...args),
    removeProfileImage: (...args: unknown[]) => mockRemoveProfileImage(...args),
  },
}));

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

describe('profile query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUserState = null;
    profileImageState = null;
    mockGetCurrentUser.mockImplementation(async () => currentUserState);
    mockSaveCurrentUser.mockImplementation(async (next: User) => {
      currentUserState = next;
    });
    mockGetProfileImage.mockImplementation(async () => profileImageState);
    mockSaveProfileImage.mockImplementation(async (next: string) => {
      profileImageState = next;
    });
    mockRemoveProfileImage.mockImplementation(async () => {
      profileImageState = null;
    });
  });

  test('loads shared profile and photo through repositories', async () => {
    const user = {
      id: 'user-1',
      name: 'Alice Rider',
      phone: '+250788111000',
      email: 'alice@example.com',
      mode: 'customer',
      isDriver: false,
      createdAt: '2026-06-28T00:00:00.000Z',
    } satisfies User;
    mockGetCurrentUser.mockResolvedValue(user);
    mockGetProfileImage.mockResolvedValue('file://profile.jpg');
    const { wrapper, client } = createWrapper();

    const { result } = renderHook(() => useProfileQuery(), { wrapper });
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.data).toEqual({
      user,
      profilePhoto: { uri: 'file://profile.jpg' },
    });
    expect(client.getQueryData(profileKeys.current())).toEqual({
      user,
      profilePhoto: { uri: 'file://profile.jpg' },
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockGetProfileImage).toHaveBeenCalledTimes(1);
  });

  test('loads the shared profile photo through the photo query', async () => {
    mockGetProfileImage.mockResolvedValue('file://profile.jpg');
    const { wrapper, client } = createWrapper();

    const { result } = renderHook(() => useProfilePhotoQuery(), { wrapper });
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.data).toBe('file://profile.jpg');
    expect(client.getQueryData(profileKeys.photo())).toBe('file://profile.jpg');
  });

  test('optimistically updates profile details and rolls back on failure', async () => {
    const user = {
      id: 'user-1',
      name: 'Alice Rider',
      phone: '+250788111000',
      email: 'alice@example.com',
      mode: 'customer',
      isDriver: false,
      createdAt: '2026-06-28T00:00:00.000Z',
    } satisfies User;
    currentUserState = user;
    profileImageState = 'file://profile.jpg';
    const { wrapper, client } = createWrapper();

    renderHook(() => useProfileQuery(), { wrapper });
    const hook = renderHook(() => useUpdateProfileMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({ name: 'Alicia Rider' });
    });

    await waitFor(() => {
      expect(client.getQueryData(profileKeys.current())).toEqual({
        user: { ...user, name: 'Alicia Rider' },
        profilePhoto: { uri: 'file://profile.jpg' },
      });
    });
    expect(mockSaveCurrentUser).toHaveBeenCalledWith({ ...user, name: 'Alicia Rider' });

    mockSaveCurrentUser.mockRejectedValueOnce(new Error('save failed'));
    await expect(hook.result.current.mutateAsync({ name: 'Alice 2' })).rejects.toThrow('save failed');
    await waitFor(() => {
      expect(client.getQueryData(profileKeys.current())).toEqual({
        user: { ...user, name: 'Alicia Rider' },
        profilePhoto: { uri: 'file://profile.jpg' },
      });
    });
  });

  test('optimistically updates the profile photo and rolls back on failure', async () => {
    const user = {
      id: 'user-1',
      name: 'Alice Rider',
      phone: '+250788111000',
      email: 'alice@example.com',
      mode: 'customer',
      isDriver: false,
      createdAt: '2026-06-28T00:00:00.000Z',
    } satisfies User;
    currentUserState = user;
    profileImageState = 'file://profile.jpg';
    const { wrapper, client } = createWrapper();

    renderHook(() => useProfileQuery(), { wrapper });
    const hook = renderHook(() => useUpdateProfilePhotoMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync('file://new-photo.jpg');
    });

    await waitFor(() => expect(client.getQueryData(profileKeys.photo())).toBe('file://new-photo.jpg'));
    expect(mockSaveProfileImage).toHaveBeenCalledWith('file://new-photo.jpg');

    mockSaveProfileImage.mockRejectedValueOnce(new Error('photo failed'));
    await expect(hook.result.current.mutateAsync('file://another.jpg')).rejects.toThrow('photo failed');
    await waitFor(() => expect(client.getQueryData(profileKeys.photo())).toBe('file://new-photo.jpg'));
  });

  test('update phone mutation updates the cached shared profile phone', async () => {
    const user = {
      id: 'user-1',
      name: 'Alice Rider',
      phone: '+250788111000',
      email: 'alice@example.com',
      mode: 'customer',
      isDriver: false,
      createdAt: '2026-06-28T00:00:00.000Z',
    } satisfies User;
    currentUserState = user;
    profileImageState = 'file://profile.jpg';
    const { wrapper, client } = createWrapper();

    renderHook(() => useProfileQuery(), { wrapper });
    const hook = renderHook(() => useUpdatePhoneMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({ phone: '+250788222333' });
    });

    await waitFor(() => {
      expect(client.getQueryData(profileKeys.current())).toEqual({
        user: { ...user, phone: '+250788222333' },
        profilePhoto: { uri: 'file://profile.jpg' },
      });
    });
  });

  test('profile query does not own driver approval state', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      name: 'Alice Rider',
      phone: '+250788111000',
      email: 'alice@example.com',
      mode: 'customer',
      isDriver: false,
      createdAt: '2026-06-28T00:00:00.000Z',
    } satisfies User);
    mockGetProfileImage.mockResolvedValue(null);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProfileQuery(), { wrapper });
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.data).not.toHaveProperty('driverApprovalStatus');
    expect(result.current.data).not.toHaveProperty('driverVehicles');
  });
});
