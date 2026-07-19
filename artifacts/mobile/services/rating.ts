import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { expectField } from '@/observability/monitoring';

// Real backend ratings: submit/get per ride under /api/v1/customer/rides/{id},
// and the caller's own ratings under /api/v1/users/me/ratings.

export interface RatingInput {
  score: number; // 1..5
  comment?: string | null;
  tags?: string[];
}

export interface RideRating {
  rideId: string;
  score: number;
  comment: string | null;
  tags: string[];
  createdAt: string | null;
}

interface RatingDto {
  ride_id?: string;
  score: number;
  comment?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
}

interface Envelope<T> {
  data: T;
}

function toDomain(dto: RatingDto, rideId: string): RideRating {
  return {
    rideId: dto.ride_id ?? rideId,
    score: dto.score,
    comment: dto.comment ?? null,
    tags: dto.tags ?? [],
    createdAt: dto.created_at ?? null,
  };
}

export async function submitRideRating(rideId: string, input: RatingInput): Promise<void> {
  const body: Record<string, unknown> = { score: input.score };
  if (input.comment !== undefined) body.comment = input.comment;
  if (input.tags !== undefined) body.tags = input.tags;
  await getAppBackendClient().post(`/v1/customer/rides/${rideId}/rate`, { body });
}

export async function getRideRating(rideId: string): Promise<RideRating | null> {
  const response = await getAppBackendClient().get<Envelope<RatingDto | null>>(
    `/v1/customer/rides/${rideId}/rating`,
  );
  const data = response.data.data;
  return data ? toDomain(data, rideId) : null;
}

// Backend shape: { data: { ratings: [ ... ], limit, offset } } — the array is
// nested under `ratings`, not the top-level data envelope.
export async function getMyRatings(): Promise<RideRating[]> {
  const response = await getAppBackendClient().get<
    Envelope<{ ratings: RatingDto[] | null; limit?: number; offset?: number } | null>
  >('/v1/users/me/ratings');
  const payload = response.data.data;
  expectField(payload, 'ratings', 'ratings.mine');
  return (payload?.ratings ?? []).map(dto => toDomain(dto, dto.ride_id ?? ''));
}

export interface RatingSummary {
  averageRating: number | null;
  ratingCount: number;
}

// Aggregates the caller's received ratings (GET /users/me/ratings) into an
// average + count. Rounds to one decimal, matching the driver UI presentation.
export function summarizeRatings(ratings: RideRating[]): RatingSummary {
  const scored = ratings.filter(rating => Number.isFinite(rating.score));
  if (scored.length === 0) {
    return { averageRating: null, ratingCount: 0 };
  }
  const total = scored.reduce((sum, rating) => sum + rating.score, 0);
  return {
    averageRating: Math.round((total / scored.length) * 10) / 10,
    ratingCount: scored.length,
  };
}
