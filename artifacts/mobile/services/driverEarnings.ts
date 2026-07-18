import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Driver earnings, stats, and ride credits under /api/v1/driver.

export interface DriverEarnings {
  totalRwf: number;
  rides: number;
  period: string;
}

interface EarningsDto {
  total_rwf: number;
  rides_today?: number;
  rides?: number;
  period: string;
}

interface Envelope<T> {
  data: T;
}

function toEarnings(dto: EarningsDto): DriverEarnings {
  return {
    totalRwf: dto.total_rwf,
    rides: dto.rides_today ?? dto.rides ?? 0,
    period: dto.period,
  };
}

export async function getDailyEarnings(): Promise<DriverEarnings> {
  const response = await getAppBackendClient().get<Envelope<EarningsDto>>('/v1/driver/earnings/daily');
  return toEarnings(response.data.data);
}

export async function getWeeklyEarnings(): Promise<DriverEarnings> {
  const response = await getAppBackendClient().get<Envelope<EarningsDto>>('/v1/driver/earnings/weekly');
  return toEarnings(response.data.data);
}

// Backend-authoritative driver performance stats from GET /driver/stats.
// acceptance_rate and completion_rate are percentages (0..100); priority_tier
// is an integer tier. total_rides is the driver's all-time completed-ride count.
export interface DriverStats {
  totalRides: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  priorityTier: number | null;
}

interface DriverStatsDto {
  total_rides?: number;
  acceptance_rate?: number;
  completion_rate?: number;
  priority_tier?: number;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function getDriverStats(): Promise<DriverStats> {
  const response = await getAppBackendClient().get<Envelope<DriverStatsDto | null>>('/v1/driver/stats');
  const dto = response.data.data ?? {};
  return {
    totalRides: Math.max(0, finiteNumber(dto.total_rides) ?? 0),
    acceptanceRate: finiteNumber(dto.acceptance_rate),
    completionRate: finiteNumber(dto.completion_rate),
    priorityTier: finiteNumber(dto.priority_tier),
  };
}

export interface DriverCredits {
  totalRemaining: number;
  entitlements: unknown[];
}

export async function getDriverCredits(): Promise<DriverCredits> {
  const response = await getAppBackendClient().get<
    Envelope<{ total_remaining: number; entitlements: unknown[] | null }>
  >('/v1/driver/credits');
  return {
    totalRemaining: response.data.data.total_remaining ?? 0,
    entitlements: response.data.data.entitlements ?? [],
  };
}
