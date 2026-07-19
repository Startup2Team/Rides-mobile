import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Driver ride-credit packages under /api/v1/driver/packages.
// Two purchase paths: MoMo API (auto) and manual (pay → submit proof → admin).

export interface RidePackage {
  id: string;
  name: string;
  vehicleType: VehicleType | null;
  rideCount: number;
  bonusRides: number;
  validityDays: number;
  priceRwf: number;
  isPromotional: boolean;
}

interface PackageDto {
  id: string;
  name: string;
  vehicle_type_code: string;
  ride_count: number;
  bonus_rides: number;
  validity_days: number;
  price_rwf: number;
  is_promotional: boolean;
}

interface Envelope<T> {
  data: T;
}

function toPackage(dto: PackageDto): RidePackage {
  return {
    id: dto.id,
    name: dto.name,
    vehicleType: fromBackendTransportType(dto.vehicle_type_code),
    rideCount: dto.ride_count,
    bonusRides: dto.bonus_rides,
    validityDays: dto.validity_days,
    priceRwf: dto.price_rwf,
    isPromotional: dto.is_promotional,
  };
}

export async function listRidePackages(): Promise<RidePackage[]> {
  const response = await getAppBackendClient().get<Envelope<PackageDto[] | null>>('/v1/driver/packages');
  return (response.data.data ?? []).map(toPackage);
}

// GET /driver/campaigns/active — currently-running campaigns (resolution
// overrides). Only APPROVED drivers can list them.
export interface CampaignDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string; // GLOBAL|VEHICLE_TYPE|PACKAGE|FIRST_PURCHASE|REFERRAL
  target_vehicle_type_code?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  override_price_rwf?: number | null;
  override_rides?: number | null;
  override_bonus_rides?: number | null;
}

export async function listActiveCampaigns(): Promise<CampaignDto[]> {
  const response = await getAppBackendClient().get<Envelope<CampaignDto[] | null>>(
    '/v1/driver/campaigns/active',
  );
  return response.data.data ?? [];
}

export interface PurchasePackageInput {
  packageId: string;
  idempotencyKey: string;
  momoPhone?: string;
  momoProvider?: 'mtn' | 'airtel';
}

// POST /driver/packages/purchase — MoMo path pushes a PIN prompt to momo_phone.
export async function purchasePackage(input: PurchasePackageInput): Promise<{ purchaseId: string; status: string }> {
  const body: Record<string, unknown> = {
    package_id: input.packageId,
    idempotency_key: input.idempotencyKey,
  };
  if (input.momoPhone) body.momo_phone = input.momoPhone;
  if (input.momoProvider) body.momo_provider = input.momoProvider;
  const response = await getAppBackendClient().post<Envelope<{ id: string; status: string }>>(
    '/v1/driver/packages/purchase',
    { body },
  );
  return { purchaseId: response.data.data.id, status: response.data.data.status };
}

export async function getPurchaseStatus(purchaseId: string): Promise<Record<string, unknown>> {
  const response = await getAppBackendClient().get<Envelope<Record<string, unknown>>>(
    `/v1/driver/packages/purchases/${purchaseId}`,
  );
  return response.data.data ?? {};
}

export interface ManualPaymentInfo {
  payCode: string; // merchant MoMo code the driver pays to (backend: momo_code)
  momoName: string; // merchant display name (backend: momo_name)
  instructions: string;
  enabled: boolean; // false when the merchant code is unconfigured
}

// Backend shape: { data: { momo_code, momo_name, instructions, enabled } }
// (internal/packages/handler.go ManualPaymentInfo).
interface ManualPaymentInfoDto {
  momo_code?: string;
  momo_name?: string;
  instructions?: string;
  enabled?: boolean;
}

// GET /driver/packages/payment-info — where to send a manual payment.
export async function getManualPaymentInfo(): Promise<ManualPaymentInfo> {
  const response = await getAppBackendClient().get<Envelope<ManualPaymentInfoDto | null>>(
    '/v1/driver/packages/payment-info',
  );
  const dto = response.data.data ?? {};
  return {
    payCode: dto.momo_code ?? '',
    momoName: dto.momo_name ?? '',
    instructions: dto.instructions ?? '',
    enabled: dto.enabled ?? false,
  };
}

// Matches the backend's ProofInput (internal/packages/purchase.go): the driver
// must provide at least a transaction `reference` OR a `screenshotUrl`.
export interface PaymentProofInput {
  reference?: string; // MoMo transaction id from the SMS
  phone?: string; // number they paid from
  screenshotUrl?: string; // optional; uploaded via the upload API
  note?: string; // optional free text
}

// POST /driver/packages/purchases/{id}/proof — submit manual-payment proof for admin review.
export async function submitPaymentProof(purchaseId: string, proof: PaymentProofInput): Promise<void> {
  const body: Record<string, unknown> = {};
  if (proof.reference !== undefined) body.reference = proof.reference;
  if (proof.phone !== undefined) body.phone = proof.phone;
  if (proof.screenshotUrl !== undefined) body.screenshot_url = proof.screenshotUrl;
  if (proof.note !== undefined) body.note = proof.note;
  await getAppBackendClient().post(`/v1/driver/packages/purchases/${purchaseId}/proof`, { body });
}

export async function getPurchaseHistory(): Promise<unknown[]> {
  const response = await getAppBackendClient().get<Envelope<unknown[] | null>>(
    '/v1/driver/packages/history',
  );
  return response.data.data ?? [];
}
