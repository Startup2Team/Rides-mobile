import { api } from './api';
import { LEGACY_TO_API_VEHICLE, type LegacyVehicleType } from './vehicleTypes';
import { normalizeRwandaPlateNumber, normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import type { DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';

/**
 * Submit a driver application to the backend (POST /driver/apply).
 * Maps the mobile onboarding form (camelCase, local vehicle codes) to the
 * backend contract (snake_case, MOTO_BIKE/CAB_TAXI/…). On success the backend
 * creates the driver_profiles row as PENDING and flips the user to DRIVER_PENDING
 * so it shows up in the admin approval queue. A 409 means an application already
 * exists — treated as success (already awaiting review).
 */
/**
 * Convert the onboarding date-of-birth (stored as DD/MM/YYYY by the date picker)
 * to the backend's required YYYY-MM-DD. Passes through values that are already
 * ISO (YYYY-MM-DD or an ISO datetime).
 */
function toISODate(value: string): string {
  const s = (value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return s; // unparseable — let the backend reject it with a clear error
}

export async function applyDriver(form: DriverOnboardingForm): Promise<void> {
  const payload = {
    transport_type: LEGACY_TO_API_VEHICLE[form.vehicleType as LegacyVehicleType] ?? 'MOTO_BIKE',
    vehicle_plate: normalizeRwandaPlateNumber(form.plateNumber),
    license_number: form.licenseNumber.trim(),
    date_of_birth: toISODate(form.dob), // DD/MM/YYYY → YYYY-MM-DD
    // Backend requires a non-null city; Rwanda's city-level admin unit is the district.
    city: form.district,
    momo_pay_code: normalizeRwandaPhoneNumber(form.momoCode) ?? form.momoCode,
    momo_provider: form.momoProvider,
    province: form.province,
    district: form.district,
    sector: form.sector,
    cell: form.cell,
    village: form.village,
    passenger_seats: form.passengerSeats ? parseInt(form.passengerSeats, 10) : undefined,
    load_capacity_kg: form.loadCapacityKg ? parseInt(form.loadCapacityKg, 10) : undefined,
  };
  try {
    await api.post('/driver/apply', payload);
  } catch (err: any) {
    if (err?.response?.status === 409) return; // already applied — awaiting review
    throw err;
  }
}

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
  // 5 s timeout — location updates are fire-and-forget. If this one misses,
  // the next GPS ping (every 5 s) will carry the same position. A 15 s timeout
  // lets up to 3 stale requests pile up in the ngrok tunnel simultaneously.
  await api.post('/driver/location', { lat, lng }, { timeout: 5000 });
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

export async function sendDriverNegotiationMessage(rideId: string, text: string) {
  await api.post(`/driver/rides/${rideId}/negotiation/message`, { text });
}

export async function getDriverNegotiationHistory(rideId: string) {
  const { data } = await api.get(`/driver/rides/${rideId}/negotiation/history`);
  return Array.isArray(data) ? data : [];
}

// ─── Earnings & Stats ────────────────────────────────────────────────────────

export interface DailyEarnings {
  total_rwf: number;
  /** Rides completed today (backend-computed). */
  rides_today: number;
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

export interface RidePackage {
  id: string;
  code: string;
  name: string;
  vehicle_type_code: string;
  // v4 fields: base vs campaign price, and the rides/bonus split.
  normal_price_rwf: number;
  current_price_rwf: number;
  included_rides: number;
  bonus_rides: number;
  total_credits: number;
  launch_offer: boolean;
  version_id: string;
  campaign_code?: string | null;
  // Legacy mirrors (kept for older screens).
  ride_count: number;
  validity_days: number;
  price_rwf: number;
  is_promotional: boolean;
}

/** The buyable package catalog for a vehicle type (GET /driver/packages). */
export async function getDriverPackages(vehicleType: string): Promise<RidePackage[]> {
  const { data } = await api.get(`/driver/packages?vehicle_type=${encodeURIComponent(vehicleType)}`);
  return Array.isArray(data) ? (data as RidePackage[]) : [];
}

export interface DriverCampaign {
  id: string;
  code: string;
  name: string;
  type: string;
  override_price_rwf?: number | null;
  override_rides?: number | null;
  override_bonus_rides?: number | null;
}

/** Active campaigns/promotions for a vehicle type (GET /driver/campaigns/active). */
export async function getActiveCampaigns(vehicleType: string): Promise<DriverCampaign[]> {
  try {
    const { data } = await api.get(`/driver/campaigns/active?vehicle_type=${encodeURIComponent(vehicleType)}`);
    return Array.isArray(data) ? (data as DriverCampaign[]) : [];
  } catch {
    return [];
  }
}

export interface PackagePurchase {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  package_id: string;
  package_name: string;
  price_paid_rwf: number;
  rides_granted: number;
  bonus_rides_granted: number;
  vehicle_type_code: string;
  payment_ref: string;
  created_at: string;
  paid_at?: string | null;
}

/**
 * Buy a package (POST /driver/packages/purchase). Free/promotional packages are
 * granted immediately (status PAID); paid packages open a PENDING MoMo charge —
 * poll getPurchaseStatus until PAID. Idempotent via idempotency_key.
 */
export async function purchaseDriverPackage(
  packageId: string,
  opts?: { momoPhone?: string; momoProvider?: 'mtn' | 'airtel'; idempotencyKey?: string },
): Promise<PackagePurchase> {
  const idempotency_key =
    opts?.idempotencyKey ?? `pur-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const { data } = await api.post('/driver/packages/purchase', {
    package_id: packageId,
    idempotency_key,
    momo_phone: opts?.momoPhone,
    momo_provider: opts?.momoProvider,
  });
  return data as PackagePurchase;
}

/** Poll a purchase's status (GET /driver/packages/purchases/{id}). */
export async function getPurchaseStatus(purchaseId: string): Promise<PackagePurchase> {
  const { data } = await api.get(`/driver/packages/purchases/${purchaseId}`);
  return data as PackagePurchase;
}

/** The driver's purchase history (GET /driver/packages/history). */
export async function getPurchaseHistory(): Promise<PackagePurchase[]> {
  try {
    const { data } = await api.get('/driver/packages/history');
    return (data?.purchases ?? []) as PackagePurchase[];
  } catch {
    return [];
  }
}

export interface DriverEntitlement {
  vehicle_type_code: string;
  rides_remaining: number;
  bonus_remaining: number;
  total_remaining: number;
}

/** Per-vehicle-type credit balances from the ledger (GET /driver/entitlements). */
export async function getDriverEntitlements(): Promise<DriverEntitlement[]> {
  try {
    const { data } = await api.get('/driver/entitlements');
    return (data?.entitlements ?? []) as DriverEntitlement[];
  } catch {
    return [];
  }
}

/** Active ride-credits remaining for this driver (GET /driver/credits). 0 = none. */
export async function getDriverCredits(): Promise<number> {
  try {
    const { data } = await api.get('/driver/credits');
    // total_remaining sums every active grant; fall back to the single credit.
    return data?.total_remaining ?? data?.credit?.rides_remaining ?? 0;
  } catch {
    return 0;
  }
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
