import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Customer gamification: GET /api/v1/customer/level. The backend is the single
// authority for level qualification (rides + spend), so the client only renders
// what it returns — it never recomputes tiers locally.

export type CustomerLevelTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PREMIUM';

export interface CustomerLevel {
  level: CustomerLevelTier;
  levelIndex: number;
  completedRides: number;
  totalSpend: number;
  currentThreshold: number;
  nextLevel: CustomerLevelTier | null;
  nextThreshold: number | null;
  ridesToNextLevel: number;
  progressToNext: number; // 0..1
  perks: string[];
}

interface CustomerLevelDto {
  level: string;
  level_index: number;
  completed_rides: number;
  total_spend: number;
  current_threshold: number;
  next_level?: string | null;
  next_threshold?: number | null;
  rides_to_next_level: number;
  progress_to_next: number;
  perks?: string[] | null;
}

interface Envelope<T> {
  data: T;
}

const TIERS: CustomerLevelTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PREMIUM'];

function toTier(value: string | null | undefined): CustomerLevelTier | null {
  return value && (TIERS as string[]).includes(value) ? (value as CustomerLevelTier) : null;
}

function toDomain(dto: CustomerLevelDto): CustomerLevel {
  return {
    level: toTier(dto.level) ?? 'BRONZE',
    levelIndex: dto.level_index ?? 0,
    completedRides: dto.completed_rides ?? 0,
    totalSpend: dto.total_spend ?? 0,
    currentThreshold: dto.current_threshold ?? 0,
    nextLevel: toTier(dto.next_level),
    nextThreshold: typeof dto.next_threshold === 'number' ? dto.next_threshold : null,
    ridesToNextLevel: dto.rides_to_next_level ?? 0,
    // Clamp defensively so a progress bar can bind to it directly.
    progressToNext: Math.min(1, Math.max(0, dto.progress_to_next ?? 0)),
    perks: dto.perks ?? [],
  };
}

export async function fetchCustomerLevel(): Promise<CustomerLevel> {
  const response = await getAppBackendClient().get<Envelope<CustomerLevelDto>>('/v1/customer/level');
  return toDomain(response.data.data);
}
