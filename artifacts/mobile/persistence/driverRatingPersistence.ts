import { STORAGE_KEYS } from '@/constants/storage';
import {
  buildDriverRatingIdempotencyKey,
  hasRatingForCompletedRide,
  type DriverRating,
  type DriverRatingStars,
} from '@/domain/driverWallet';
import { driverRatingsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export async function loadStoredDriverRatings() {
  return loadSecureStorage<DriverRating[]>(STORAGE_KEYS.driverRatings, driverRatingsSchema);
}

export async function saveStoredDriverRatings(ratings: DriverRating[]) {
  await saveSecureStorage(STORAGE_KEYS.driverRatings, ratings);
}

export function buildLocalDriverRating({
  comment,
  customerId,
  driverId,
  now = new Date().toISOString(),
  rideId,
  stars,
}: {
  comment?: string;
  customerId?: string;
  driverId: string;
  now?: string;
  rideId: string;
  stars: DriverRatingStars;
}): DriverRating {
  const reviewText = comment?.trim();
  return {
    id: `rating:${rideId}:${driverId}`,
    rideId,
    driverId,
    customerId,
    stars,
    ...(reviewText ? { reviewText } : {}),
    moderationStatus: 'published',
    createdAt: now,
    idempotencyKey: buildDriverRatingIdempotencyKey(rideId),
    authority: 'local_prototype',
  };
}

export async function saveDriverRatingOnce(rating: DriverRating): Promise<{ rating: DriverRating; saved: boolean }> {
  const stored = await loadStoredDriverRatings();
  const ratings = stored.data ?? [];
  if (hasRatingForCompletedRide(ratings, rating.rideId)) {
    return {
      rating: ratings.find(existing =>
        existing.rideId === rating.rideId || existing.idempotencyKey === rating.idempotencyKey,
      ) ?? rating,
      saved: false,
    };
  }
  const next = [rating, ...ratings];
  await saveStoredDriverRatings(next);
  return { rating, saved: true };
}
