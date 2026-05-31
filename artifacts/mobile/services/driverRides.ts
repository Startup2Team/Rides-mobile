import { api } from './api';

export async function getRideForDriver(rideId: string) {
  const { data } = await api.get(`/driver/rides/${rideId}`);
  return data;
}

/** Returns the driver's active ride, or null if there is none (404 = idle state). */
export async function getActiveRideForDriver() {
  try {
    const { data } = await api.get('/driver/rides/active');
    return data ?? null;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function acceptRideRequest(rideId: string) {
  await api.post(`/driver/rides/${rideId}/accept`);
}

export async function declineRideRequest(rideId: string) {
  await api.post(`/driver/rides/${rideId}/decline`);
}

export async function cancelRideAsDriver(rideId: string) {
  await api.post(`/driver/rides/${rideId}/cancel`);
}

export async function markEnRoute(rideId: string) {
  await api.post(`/driver/rides/${rideId}/en-route`);
}

export async function markArrived(rideId: string) {
  await api.post(`/driver/rides/${rideId}/arrive`);
}

export async function startRide(rideId: string) {
  await api.post(`/driver/rides/${rideId}/start`);
}

export async function completeRide(rideId: string) {
  await api.post(`/driver/rides/${rideId}/complete`, {});
}

export async function setDriverAvailability(isOnline: boolean) {
  await api.post('/driver/availability', { is_online: isOnline });
}

export async function updateDriverLocation(lat: number, lng: number) {
  await api.post('/driver/location', { lat, lng });
}

export async function proposeDriverFare(rideId: string, amount: number) {
  await api.post(`/driver/rides/${rideId}/negotiation/propose`, { amount });
}

export async function acceptCustomerFare(rideId: string) {
  await api.post(`/driver/rides/${rideId}/negotiation/accept`);
}

export async function lockManualFare(rideId: string, amount: number) {
  await api.post(`/driver/rides/${rideId}/negotiation/lock-fare`, { amount });
}

// ─── Earnings & Stats ────────────────────────────────────────────────────────

export interface DailyEarnings {
  total_rwf: number;
  period: string;
}

export interface WeeklyEarnings {
  total_rwf: number;
  period: string;
}

export interface DriverStats {
  total_rides: number;
  acceptance_rate: number;
  completion_rate: number;
  /** Numeric tier — lower is better: 1 = Gold, 2 = Silver, 3 = Bronze */
  priority_tier: number;
}

export async function getDailyEarnings(): Promise<DailyEarnings> {
  const { data } = await api.get('/driver/earnings/daily');
  return data;
}

export async function getWeeklyEarnings(): Promise<WeeklyEarnings> {
  const { data } = await api.get('/driver/earnings/weekly');
  return data;
}

export async function getDriverStats(): Promise<DriverStats> {
  const { data } = await api.get('/driver/stats');
  return data;
}
