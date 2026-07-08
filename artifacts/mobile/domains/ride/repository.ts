import { rideRepository as localRideRepository } from '@/data/repositories';
import type { Ride } from './types';

export interface RideHistoryOptions {
  userId?: string | null;
}

export const rideHistoryRepository = {
  async listRideHistory(_options?: RideHistoryOptions): Promise<Ride[]> {
    return (await localRideRepository.loadRideHistory()) ?? [];
  },

  async getRideDetail(rideId: string): Promise<Ride | null> {
    return localRideRepository.getRideDetail(rideId);
  },
};
