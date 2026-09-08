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

// Wire status values from internal/packages/purchase.go's Purchase.Status —
// uppercase, set by the purchase repository (never invented client-side).
export type RemotePackagePurchaseStatus = 'PENDING' | 'PAID' | 'FAILED';

// Domain shape of internal/packages/purchase.go's Purchase struct, returned by
// both POST /driver/packages/purchase and GET /driver/packages/purchases/{id}.
// This is the REAL backend purchase (automatic MoMo RequestToPay path) — do not
// confuse with the client-only entitlement simulation in domain/driverRidePackages
// or the manual proof-based claim in domains/package-payments.
export interface RemotePackagePurchase {
  id: string;
  status: RemotePackagePurchaseStatus;
  packageId: string;
  packageName: string;
  packageVersion: number;
  campaignCode: string | null;
  pricePaidRwf: number;
  ridesGranted: number;
  bonusRidesGranted: number;
  vehicleTypeCode: string;
  paymentProvider: string | null;
  paymentRef: string;
  createdAt: string;
  paidAt: string | null;
}

interface PurchaseDto {
  id: string;
  status: string;
  package_id: string;
  package_name: string;
  package_version: number;
  campaign_code?: string | null;
  price_paid_rwf: number;
  rides_granted: number;
  bonus_rides_granted: number;
  vehicle_type_code: string;
  payment_provider?: string | null;
  payment_ref: string;
  created_at: string;
  paid_at?: string | null;
}

function toRemotePackagePurchaseStatus(value: string): RemotePackagePurchaseStatus {
  return value === 'PAID' || value === 'FAILED' ? value : 'PENDING';
}

function toRemotePackagePurchase(dto: PurchaseDto): RemotePackagePurchase {
  return {
    id: dto.id,
    status: toRemotePackagePurchaseStatus(dto.status),
    packageId: dto.package_id,
    packageName: dto.package_name,
    packageVersion: dto.package_version,
    campaignCode: dto.campaign_code ?? null,
    pricePaidRwf: dto.price_paid_rwf,
    ridesGranted: dto.rides_granted,
    bonusRidesGranted: dto.bonus_rides_granted,
    vehicleTypeCode: dto.vehicle_type_code,
    paymentProvider: dto.payment_provider ?? null,
    paymentRef: dto.payment_ref,
    createdAt: dto.created_at,
    paidAt: dto.paid_at ?? null,
  };
}

// POST /driver/packages/purchase — MoMo path pushes a PIN prompt to momo_phone.
// Idempotent on idempotency_key: a retried request with the same key returns the
// existing purchase instead of opening a second MoMo charge.
export async function purchasePackage(input: PurchasePackageInput): Promise<RemotePackagePurchase> {
  const body: Record<string, unknown> = {
    package_id: input.packageId,
    idempotency_key: input.idempotencyKey,
  };
  if (input.momoPhone) body.momo_phone = input.momoPhone;
  if (input.momoProvider) body.momo_provider = input.momoProvider;
  const response = await getAppBackendClient().post<Envelope<PurchaseDto>>(
    '/v1/driver/packages/purchase',
    { body },
  );
  return toRemotePackagePurchase(response.data.data);
}

// GET /driver/packages/purchases/{id} — status poll. The backend settles a
// PENDING purchase on read (queries the MoMo gateway), so a poll can resolve
// PAID/FAILED within seconds of the driver approving/declining the PIN prompt.
export async function getPurchaseStatus(purchaseId: string): Promise<RemotePackagePurchase> {
  const response = await getAppBackendClient().get<Envelope<PurchaseDto>>(
    `/v1/driver/packages/purchases/${encodeURIComponent(purchaseId)}`,
  );
  return toRemotePackagePurchase(response.data.data);
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
