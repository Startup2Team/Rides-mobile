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

// Stats shape is backend-defined; return it loosely for the stats screen to read.
export async function getDriverStats(): Promise<Record<string, unknown>> {
  const response = await getAppBackendClient().get<Envelope<Record<string, unknown>>>('/v1/driver/stats');
  return response.data.data ?? {};
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
