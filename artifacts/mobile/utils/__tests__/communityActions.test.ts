const mockIsAvailable = jest.fn();
const mockRequestReview = jest.fn();
const mockOpenUrl = jest.fn();
const mockShare = jest.fn();

jest.mock('expo-store-review', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailable(...args),
  requestReview: (...args: unknown[]) => mockRequestReview(...args),
}));

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: (...args: unknown[]) => mockOpenUrl(...args),
  },
  Platform: { OS: 'android' },
  Share: { share: (...args: unknown[]) => mockShare(...args) },
}));

import { leaveRidesFeedback, rateRides, shareRides } from '../communityActions';

describe('community actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requests the native store review when available', async () => {
    mockIsAvailable.mockResolvedValue(true);

    await rateRides();

    expect(mockRequestReview).toHaveBeenCalled();
  });

  test('opens a prefilled feedback email', async () => {
    await leaveRidesFeedback();

    expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining('mailto:support@rides.rw'));
    expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining('Feature%20suggestion'));
  });

  test('skips opening mail when the device cannot handle the url', async () => {
    const { Linking } = require('react-native');
    Linking.canOpenURL.mockResolvedValueOnce(false);

    await leaveRidesFeedback();

    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  test('shares the Rides website', async () => {
    await shareRides();

    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('https://rides.rw'),
    }));
  });
});
