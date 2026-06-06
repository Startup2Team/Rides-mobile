import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { RIDE_HISTORY_LIMIT } from '../rideConstants';
import { appendRideHistory, loadRideHistory } from '../ridePersistence';
import { createRide } from './rideTestFactory';

describe('ride history persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('prepends a completed ride and loads it back', async () => {
    const completed = createRide({ id: 'completed', status: 'completed' });

    await appendRideHistory(completed);

    expect(await loadRideHistory()).toEqual([completed]);
  });

  test('caps persisted history at the configured limit', async () => {
    const existing = Array.from({ length: RIDE_HISTORY_LIMIT }, (_, index) =>
      createRide({ id: `existing-${index}`, status: 'completed' }),
    );
    await AsyncStorage.setItem(STORAGE_KEYS.rideHistory, JSON.stringify(existing));

    await appendRideHistory(createRide({ id: 'latest', status: 'completed' }));

    const stored = await loadRideHistory();
    expect(stored).toHaveLength(RIDE_HISTORY_LIMIT);
    expect(stored?.[0].id).toBe('latest');
    expect(stored?.at(-1)?.id).toBe(`existing-${RIDE_HISTORY_LIMIT - 2}`);
  });
});
