import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useProfile, useProfileActions, useProfileIdentity, useProfilePhoto, profileRepository } from '..';
import type { AppMode, ProfileIdentity, ProfilePhoto, UserProfile } from '..';

const mockUser = {
  id: 'user-1',
  name: 'Alice Rider',
  phone: '+250788111000',
  email: 'alice@example.com',
  mode: 'customer' as AppMode,
  isDriver: true,
  createdAt: '2026-06-28T00:00:00.000Z',
};

const mockDriverProfile = {
  profileImage: 'file://profile.jpg',
};

const mockAuth = {
  user: mockUser,
  driverProfile: mockDriverProfile,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateUser: jest.fn(),
  saveDriverProfile: jest.fn(),
  setActiveVehicle: jest.fn(),
  setDriverOnline: jest.fn(),
  switchMode: jest.fn(),
  recordCompletedRide: jest.fn(),
};

const mockToast = { showToast: jest.fn() };
const mockProfilePhoto: ProfilePhoto = { uri: mockDriverProfile.profileImage };

const sharedProfileIdentity: ProfileIdentity = {
  userId: mockUser.id,
  fullName: mockUser.name,
  phoneNumber: mockUser.phone,
  email: mockUser.email,
  profilePhoto: mockProfilePhoto,
  preferredLanguage: 'en',
  notificationPreferences: { rideUpdates: true },
};

const sharedUserProfile: UserProfile = {
  ...sharedProfileIdentity,
  mode: mockUser.mode,
  isDriver: mockUser.isDriver,
  createdAt: mockUser.createdAt,
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => mockToast,
}));

const mockUseProfileQuery = jest.fn();
const mockUseProfilePhotoQuery = jest.fn();
const mockUseUpdateProfileMutation = jest.fn();
const mockUseUpdateProfilePhotoMutation = jest.fn();

jest.mock('@/query/hooks/useProfileQuery', () => ({
  useProfileQuery: () => mockUseProfileQuery(),
  useProfilePhotoQuery: () => mockUseProfilePhotoQuery(),
  useUpdateProfileMutation: () => mockUseUpdateProfileMutation(),
  useUpdateProfilePhotoMutation: () => mockUseUpdateProfilePhotoMutation(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
}));

jest.mock('@/persistence/profilePersistence', () => ({
  loadStoredProfileImage: jest.fn(() => Promise.resolve({ data: 'file://stored.jpg' })),
  saveStoredProfileImage: jest.fn(() => Promise.resolve({ data: null })),
  removeStoredProfileImage: jest.fn(() => Promise.resolve({ data: null })),
}));

describe('profile domain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProfileQuery.mockReturnValue({ data: { user: mockUser, profilePhoto: mockProfilePhoto }, refetch: jest.fn() });
    mockUseProfilePhotoQuery.mockReturnValue({ data: 'file://stored.jpg', refetch: jest.fn() });
    mockUseUpdateProfileMutation.mockReturnValue({ mutateAsync: jest.fn(async (updates: Partial<typeof mockUser>) => ({ ...mockUser, ...updates })) });
    mockUseUpdateProfilePhotoMutation.mockReturnValue({ mutateAsync: jest.fn(async (uri: string | null) => uri) });
  });

  test('exports the profile repository boundary', () => {
    expect(profileRepository).toBeDefined();
  });

  test('builds shared identity from the auth session', () => {
    const { result } = renderHook(() => useProfileIdentity());

    expect(result.current).toEqual(expect.objectContaining({
      userId: 'user-1',
      fullName: 'Alice Rider',
      phoneNumber: '+250788111000',
      email: 'alice@example.com',
    }));
    expect(result.current).not.toHaveProperty('driverApprovalStatus');
    expect(result.current).not.toHaveProperty('driverVerificationStatus');
  });

  test('prefers the live auth session over a stale profile query user', () => {
    mockUseProfileQuery.mockReturnValue({
      data: {
        user: {
          ...mockUser,
          id: 'stale-user',
          name: 'Kezakase Mercy Joan',
        },
        profilePhoto: mockProfilePhoto,
      },
      refetch: jest.fn(),
    });
    mockUseProfilePhotoQuery.mockReturnValue({
      data: 'file://stale-previous-user.jpg',
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useProfile());

    expect(result.current.profile?.userId).toBe('user-1');
    expect(result.current.profile?.fullName).toBe('Alice Rider');
    expect(result.current.profile?.profilePhoto).toBeNull();
  });

  test('returns profile state and compatibility actions', async () => {
    const { result } = renderHook(() => useProfile());
    const actions = renderHook(() => useProfileActions());

    await waitFor(() => {
      expect(result.current.profile?.profilePhoto?.uri).toBe('file://stored.jpg');
      expect(actions.result.current.profileImage).toBe('file://stored.jpg');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.profile).toEqual(expect.objectContaining({
      userId: 'user-1',
      fullName: 'Alice Rider',
    }));
    expect(sharedProfileIdentity).toEqual(expect.objectContaining({
      userId: 'user-1',
      fullName: 'Alice Rider',
    }));
    expect(sharedUserProfile).toEqual(expect.objectContaining({
      mode: 'customer',
      isDriver: true,
    }));
    expect(actions.result.current.logout).toBe(mockAuth.logout);
    expect(actions.result.current.switchMode).toBe(mockAuth.switchMode);
    await act(async () => {
      await actions.result.current.updateUser({ name: 'Alicia Rider' });
    });
    expect(mockUseUpdateProfileMutation).toHaveBeenCalled();
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ name: 'Alicia Rider' });
    expect(actions.result.current).not.toHaveProperty('saveDriverProfile');
  });

  test('loads profile photo through the domain hook', async () => {
    const { result } = renderHook(() => useProfilePhoto(mockDriverProfile.profileImage));
    await waitFor(() => {
      expect(result.current.profileImage).toBe('file://stored.jpg');
    });
    await act(async () => {
      await result.current.handleDeletePhoto();
    });
    expect(mockAuth.saveDriverProfile).toHaveBeenCalled();
    const savedProfile = mockAuth.saveDriverProfile.mock.calls.at(-1)?.[0];
    expect(savedProfile).toEqual(expect.not.objectContaining({ profileImage: expect.anything() }));
  });
});
