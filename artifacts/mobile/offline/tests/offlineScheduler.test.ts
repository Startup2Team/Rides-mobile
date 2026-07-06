import { createNetworkMonitor } from '../network/networkMonitor';
import { OfflineMutationQueue } from '../queue/offlineQueue';
import { createOfflineScheduler } from '../scheduler/offlineScheduler';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

describe('offline scheduler', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('runs queue processing on ticks and network resume', async () => {
    jest.useFakeTimers();
    const processor = jest.fn(async () => ({ ok: true }));
    const queue = new OfflineMutationQueue({ processor });
    const network = createNetworkMonitor({ isOnline: false, isInternetReachable: false });
    const scheduler = createOfflineScheduler(queue, network, 100);
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'scheduled-1' });

    scheduler.start();
    network.setOnlineForTests?.(true);
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    expect(processor).toHaveBeenCalled();
    scheduler.stop();
  });
});
